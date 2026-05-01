package com.ahmedv2.zerostep.execution.service;

import com.ahmedv2.zerostep.audit.service.AuditService;
import com.ahmedv2.zerostep.common.exception.ConflictException;
import com.ahmedv2.zerostep.common.exception.ForbiddenException;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.execution.dto.*;
import com.ahmedv2.zerostep.execution.entity.*;
import com.ahmedv2.zerostep.execution.repository.ExecutionLogRepository;
import com.ahmedv2.zerostep.execution.repository.ExecutionRepository;
import com.ahmedv2.zerostep.execution.repository.ExecutionStepResultRepository;
import com.ahmedv2.zerostep.execution.runner.ExecutionRunner;
import com.ahmedv2.zerostep.scenario.entity.Scenario;
import com.ahmedv2.zerostep.scenario.entity.ScenarioStatus;
import com.ahmedv2.zerostep.scenario.repository.ScenarioRepository;
import com.ahmedv2.zerostep.step.repository.TestStepRepository;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExecutionService {

    // Kullanici basina ayni anda max kac execution
    private static final int MAX_CONCURRENT_PER_USER = 3;

    private final ExecutionRepository executionRepository;
    private final ExecutionStepResultRepository stepResultRepository;
    private final ExecutionLogRepository logRepository;
    private final ScenarioRepository scenarioRepository;
    private final TestStepRepository stepRepository;
    private final UserRepository userRepository;
    private final ExecutionRunner executionRunner;
    private final AuditService auditService;

    // ============================================================
    // BAS LATMA
    // ============================================================
    @Transactional
    public ExecutionResponse startExecution(UUID scenarioPublicId, ExecutionStartRequest request,
                                            String username, Set<String> roles) {
        Scenario scenario = scenarioRepository.findByPublicIdActive(scenarioPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Scenario", scenarioPublicId));

        checkExecuteAccess(scenario, username, roles);

        if (scenario.getStatus() == ScenarioStatus.ARCHIVED) {
            throw new ForbiddenException("Arsivlenmis senaryo calistirilamaz");
        }

        // Senaryoda en az 1 aktif step var mi?
        long stepCount = stepRepository.countByScenarioIdAndDeletedAtIsNull(scenario.getId());
        if (stepCount == 0) {
            throw new ConflictException("Senaryoda calistirilacak adim yok");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));

        // Concurrent execution limiti
        long activeCount = executionRepository.countActiveByUser(user.getId());
        if (activeCount >= MAX_CONCURRENT_PER_USER) {
            throw new ConflictException(
                    "Maksimum " + MAX_CONCURRENT_PER_USER +
                            " paralel execution calistirabilirsiniz; aktif: " + activeCount);
        }

        // Execution kaydi olustur
        Execution execution = new Execution();
        execution.setScenario(scenario);
        execution.setTriggeredBy(user);
        execution.setTriggeredByName(username);
        execution.setTriggerType(TriggerType.MANUAL);
        execution.setStatus(ExecutionStatus.QUEUED);

        Execution saved = executionRepository.save(execution);
        log.info("Execution kuyruga alindi: id={} scenario={} user={}",
                saved.getId(), scenario.getName(), username);

        auditService.record("EXECUTION_STARTED", "EXECUTION", saved.getId(),
                Map.of("scenarioId", scenario.getId(),
                        "scenarioName", scenario.getName(),
                        "stepCount", stepCount));

        // Async runner'i tetikle; transaction commit'inden sonra calismasi icin
        // ayni transaction icinde @Async cagirinca Spring zaten ayri thread'e atar
        executionRunner.run(saved.getId());

        return toResponse(saved);
    }

    // ============================================================
    // SORGU
    // ============================================================

    @Transactional(readOnly = true)
    public ExecutionResponse getExecution(UUID publicId, String username, Set<String> roles) {
        Execution execution = findExecutionOrThrow(publicId);
        checkReadAccess(execution.getScenario(), username, roles);
        return toResponse(execution);
    }

    @Transactional(readOnly = true)
    public List<ExecutionStepResultResponse> getStepResults(UUID publicId, String username, Set<String> roles) {
        Execution execution = findExecutionOrThrow(publicId);
        checkReadAccess(execution.getScenario(), username, roles);

        return stepResultRepository.findByExecutionIdOrdered(execution.getId()).stream()
                .map(this::toStepResultResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<ExecutionLogResponse> getLogs(UUID publicId, String username, Set<String> roles,
                                              Pageable pageable) {
        Execution execution = findExecutionOrThrow(publicId);
        checkReadAccess(execution.getScenario(), username, roles);

        return logRepository.findByExecutionId(execution.getId(), pageable)
                .map(this::toLogResponse);
    }

    @Transactional(readOnly = true)
    public Page<ExecutionResponse> listByScenario(UUID scenarioPublicId, String username,
                                                  Set<String> roles, Pageable pageable) {
        Scenario scenario = scenarioRepository.findByPublicIdActive(scenarioPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Scenario", scenarioPublicId));
        checkReadAccess(scenario, username, roles);

        return executionRepository.findByScenarioId(scenario.getId(), pageable)
                .map(this::toResponse);
    }

    // ============================================================
    // CANCEL
    // ============================================================
    @Transactional
    public ExecutionResponse cancelExecution(UUID publicId, String username, Set<String> roles) {
        Execution execution = findExecutionOrThrow(publicId);
        checkExecuteAccess(execution.getScenario(), username, roles);

        if (execution.getStatus().isTerminal()) {
            throw new ConflictException("Bu execution zaten tamamlanmis: " + execution.getStatus());
        }

        // QUEUED ise direkt CANCELLED'a gec; runner bunu zaten gormeyecek
        // RUNNING ise runner'a flag gonder; runner bir sonraki step oncesi gorur
        if (execution.getStatus() == ExecutionStatus.QUEUED) {
            execution.setStatus(ExecutionStatus.CANCELLED);
            execution.setCancelledBy(username);
            executionRepository.save(execution);
        } else {
            // RUNNING; cancel flag set
            boolean signaled = executionRunner.requestCancel(execution.getId());
            if (signaled) {
                execution.setCancelledBy(username);
                executionRepository.save(execution);
                log.info("Cancel sinyali gonderildi: id={}", execution.getId());
            } else {
                log.warn("Cancel sinyali gonderilemedi (runner yok): id={}", execution.getId());
            }
        }

        auditService.record("EXECUTION_CANCELLED", "EXECUTION", execution.getId(),
                Map.of("scenarioId", execution.getScenario().getId(),
                        "username", username));

        return toResponse(execution);
    }

    // ============================================================
    // YARDIMCILAR
    // ============================================================

    private Execution findExecutionOrThrow(UUID publicId) {
        return executionRepository.findByPublicIdWithScenario(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", publicId));
    }

    // Okuma: senaryo erisim kurali ile ayni
    private void checkReadAccess(Scenario s, String username, Set<String> roles) {
        if (roles.contains("ROLE_ADMIN") || roles.contains("ROLE_VIEWER")) return;
        if (!s.getOwner().getUsername().equals(username)) {
            throw new ForbiddenException("Bu execution'a erisim yetkiniz yok");
        }
    }

    // Calistirma: VIEWER asla, TESTER kendi senaryosu, ADMIN her sey
    private void checkExecuteAccess(Scenario s, String username, Set<String> roles) {
        if (roles.contains("ROLE_VIEWER") && !roles.contains("ROLE_ADMIN")) {
            throw new ForbiddenException("VIEWER rolu ile execution calistirilamaz");
        }
        if (roles.contains("ROLE_ADMIN")) return;
        if (!s.getOwner().getUsername().equals(username)) {
            throw new ForbiddenException("Bu senaryo size ait degil");
        }
    }

    private ExecutionResponse toResponse(Execution e) {
        return new ExecutionResponse(
                e.getPublicId(),
                e.getScenario().getPublicId(),
                e.getScenario().getName(),
                e.getTriggeredByName(),
                e.getTriggerType(),
                e.getStatus(),
                e.getQueuedAt(),
                e.getStartedAt(),
                e.getFinishedAt(),
                e.getDurationMs(),
                e.getTotalSteps(),
                e.getPassedSteps(),
                e.getFailedSteps(),
                e.getSkippedSteps(),
                e.getErrorMessage(),
                e.getCancelledBy()
        );
    }

    private ExecutionStepResultResponse toStepResultResponse(ExecutionStepResult sr) {
        return new ExecutionStepResultResponse(
                sr.getId(),
                sr.getStepOrder(),
                sr.getActionType(),
                sr.getDescription(),
                sr.getStatus(),
                sr.getStartedAt(),
                sr.getFinishedAt(),
                sr.getDurationMs(),
                sr.getErrorMessage(),
                sr.getScreenshotPath()
        );
    }

    private ExecutionLogResponse toLogResponse(ExecutionLog l) {
        return new ExecutionLogResponse(
                l.getId(),
                l.getStepResult() != null ? l.getStepResult().getId() : null,
                l.getLogLevel(),
                l.getMessage(),
                l.getOccurredAt()
        );
    }
}