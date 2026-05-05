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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExecutionService {

    private static final int MAX_CONCURRENT_PER_USER = 3;

    private final ExecutionRepository           executionRepository;
    private final ExecutionStepResultRepository stepResultRepository;
    private final ExecutionLogRepository        logRepository;
    private final ScenarioRepository            scenarioRepository;
    private final TestStepRepository            stepRepository;
    private final UserRepository                userRepository;
    private final ExecutionRunner               executionRunner;
    private final AuditService                  auditService;

    // ── Başlatma ──────────────────────────────────────────
    @Transactional
    public ExecutionResponse startExecution(UUID scenarioPublicId,
                                            ExecutionStartRequest request,
                                            String username,
                                            Set<String> roles) {

        Scenario scenario = scenarioRepository.findByPublicIdActive(scenarioPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Scenario", scenarioPublicId));

        checkExecuteAccess(scenario, username, roles);

        if (scenario.getStatus() == ScenarioStatus.ARCHIVED) {
            throw new ForbiddenException("Arşivlenmiş senaryo çalıştırılamaz");
        }

        long stepCount = stepRepository.countByScenarioIdAndDeletedAtIsNull(scenario.getId());
        if (stepCount == 0) {
            throw new ConflictException("Senaryoda çalıştırılacak adım yok");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));

        long activeCount = executionRepository.countActiveByUser(user.getId());
        if (activeCount >= MAX_CONCURRENT_PER_USER) {
            throw new ConflictException(
                    "Maksimum " + MAX_CONCURRENT_PER_USER
                            + " paralel execution çalıştırabilirsiniz; aktif: " + activeCount);
        }

        Execution execution = new Execution();
        execution.setScenario(scenario);
        execution.setTriggeredBy(user);
        execution.setTriggeredByName(username);
        execution.setTriggerType(TriggerType.MANUAL);
        execution.setStatus(ExecutionStatus.QUEUED);

        Execution saved = executionRepository.save(execution);
        final Long savedId = saved.getId();

        log.info("Execution kuyruğa alındı: id={} scenario={} user={}",
                savedId, scenario.getName(), username);

        auditService.record("EXECUTION_STARTED", "EXECUTION", savedId,
                Map.of("scenarioId",   scenario.getId(),
                        "scenarioName", scenario.getName(),
                        "stepCount",    stepCount));

        /*
         * KÖK NEDEN DÜZELTMESİ
         * ─────────────────────
         * Eski kod: executionRunner.run(savedId)
         *   → @Async yeni thread'i HEMEN başlatır.
         *   → Bu metod hâlâ @Transactional içinde → DB COMMIT olmadı.
         *   → Runner findByIdWithAllRelations() ile sorguladığında
         *     kayıt DB'de yok → "Execution bulunamadı: 14" hatası.
         *
         * Yeni kod: TransactionSynchronizationManager.registerSynchronization()
         *   → afterCommit() hook'u transaction COMMIT'İNDEN SONRA çalışır.
         *   → O an kayıt DB'de kesinlikle mevcut.
         *   → @Async runner thread-safe biçimde başlatılır.
         */
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        log.debug("TX commit OK → ExecutionRunner başlatılıyor: id={}", savedId);
                        executionRunner.run(savedId);
                    }
                }
        );

        return toResponse(saved);
    }

    // ── Sorgular ──────────────────────────────────────────

    @Transactional(readOnly = true)
    public ExecutionResponse getExecution(UUID publicId, String username, Set<String> roles) {
        Execution execution = findExecutionOrThrow(publicId);
        checkReadAccess(execution.getScenario(), username, roles);
        return toResponse(execution);
    }

    @Transactional(readOnly = true)
    public List<ExecutionStepResultResponse> getStepResults(UUID publicId,
                                                            String username,
                                                            Set<String> roles) {
        Execution execution = findExecutionOrThrow(publicId);
        checkReadAccess(execution.getScenario(), username, roles);
        return stepResultRepository.findByExecutionIdOrdered(execution.getId()).stream()
                .map(this::toStepResultResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<ExecutionLogResponse> getLogs(UUID publicId, String username,
                                              Set<String> roles, Pageable pageable) {
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

    // ── İptal ─────────────────────────────────────────────
    @Transactional
    public ExecutionResponse cancelExecution(UUID publicId, String username, Set<String> roles) {
        Execution execution = findExecutionOrThrow(publicId);
        checkExecuteAccess(execution.getScenario(), username, roles);

        if (execution.getStatus().isTerminal()) {
            throw new ConflictException(
                    "Bu execution zaten tamamlanmış: " + execution.getStatus());
        }

        if (execution.getStatus() == ExecutionStatus.QUEUED) {
            execution.setStatus(ExecutionStatus.CANCELLED);
            execution.setCancelledBy(username);
            executionRepository.save(execution);
        } else {
            boolean signaled = executionRunner.requestCancel(execution.getId());
            if (signaled) {
                execution.setCancelledBy(username);
                executionRepository.save(execution);
            }
        }

        auditService.record("EXECUTION_CANCELLED", "EXECUTION", execution.getId(),
                Map.of("scenarioId", execution.getScenario().getId(),
                        "username",   username));

        return toResponse(execution);
    }

    // ── Yardımcı ──────────────────────────────────────────

    private Execution findExecutionOrThrow(UUID publicId) {
        // JOIN FETCH → lazy proxy "no session" hatasını önler
        return executionRepository.findByPublicIdWithScenario(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", publicId));
    }

    private void checkReadAccess(Scenario s, String username, Set<String> roles) {
        if (roles.contains("ROLE_ADMIN") || roles.contains("ROLE_VIEWER")) return;
        if (!s.getOwner().getUsername().equals(username)) {
            throw new ForbiddenException("Bu execution'a erişim yetkiniz yok");
        }
    }

    private void checkExecuteAccess(Scenario s, String username, Set<String> roles) {
        if (roles.contains("ROLE_VIEWER") && !roles.contains("ROLE_ADMIN")) {
            throw new ForbiddenException("VIEWER rolü ile execution çalıştırılamaz");
        }
        if (roles.contains("ROLE_ADMIN")) return;
        if (!s.getOwner().getUsername().equals(username)) {
            throw new ForbiddenException("Bu senaryo size ait değil");
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