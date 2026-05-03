package com.ahmedv2.zerostep.report.service;

import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.execution.entity.Execution;
import com.ahmedv2.zerostep.execution.entity.ExecutionStatus;
import com.ahmedv2.zerostep.execution.entity.ExecutionStepResult;
import com.ahmedv2.zerostep.execution.repository.ExecutionRepository;
import com.ahmedv2.zerostep.execution.repository.ExecutionStepResultRepository;
import com.ahmedv2.zerostep.report.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {

    private final ExecutionRepository executionRepo;
    private final ExecutionStepResultRepository stepResultRepo;

    public ExecutionReportDto buildExecutionReport(UUID executionPublicId) {
        // findByPublicId yerine mevcut method kullanılıyor
        Execution exec = executionRepo.findByPublicIdWithScenario(executionPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", executionPublicId));

        // Mevcut repository method adına göre çağrı
        List<ExecutionStepResult> stepResults =
                stepResultRepo.findByExecutionIdOrdered(exec.getId());

        List<StepResultReportDto> stepDtos = stepResults.stream()
                .map(this::toStepDto)
                .toList();

        return new ExecutionReportDto(
                exec.getPublicId().toString(),
                exec.getScenario().getPublicId().toString(),
                exec.getScenario().getName(),
                exec.getScenario().getDescription(),
                exec.getScenario().getOwner().getUsername(),
                exec.getStatus().name(),
                exec.getTriggerType().name(),
                exec.getQueuedAt(),
                exec.getStartedAt(),
                exec.getFinishedAt(),
                exec.getTotalSteps(),
                exec.getPassedSteps(),
                exec.getFailedSteps(),
                exec.getSkippedSteps(),
                stepDtos,
                buildMetrics(exec, stepDtos)
        );
    }

    public Page<ReportListItemDto> listReports(ReportFilterDto filter, Pageable pageable) {
        // Parametre çözümlemeleri method çağrısının dışında yapılıyor
        UUID scenarioId = null;
        if (filter.scenarioPublicId() != null && !filter.scenarioPublicId().isBlank()) {
            scenarioId = UUID.fromString(filter.scenarioPublicId());
        }

        ExecutionStatus executionStatus = null;
        if (filter.status() != null && !filter.status().isBlank()) {
            executionStatus = ExecutionStatus.valueOf(filter.status());
        }

        String username = filter.username() != null ? filter.username() : "";

        return executionRepo.findAllFiltered(
                scenarioId,
                executionStatus,
                username,
                filter.fromDate(),
                filter.toDate(),
                pageable
        ).map(this::toListItem);
    }

    public ScenarioSummaryDto buildScenarioSummary(UUID scenarioPublicId) {
        Object[] agg = executionRepo.findAggregatesByScenario(scenarioPublicId);
        long totalRuns  = ((Number) agg[0]).longValue();
        double avgDuration = ((Number) agg[1]).doubleValue();

        List<Execution> last10 = executionRepo.findLastNByScenario(
                scenarioPublicId, PageRequest.of(0, 10));

        double overallPassRate = last10.isEmpty() ? 0.0 :
                last10.stream()
                .mapToDouble(e -> e.getTotalSteps() == 0 ? 0
                                  : (double) e.getPassedSteps() / e.getTotalSteps() * 100)
                .average().orElse(0.0);

        String scenarioName = last10.isEmpty() ? "" :
                last10.get(0).getScenario().getName();

        return new ScenarioSummaryDto(
                scenarioPublicId.toString(),
                scenarioName,
                (int) totalRuns,
                avgDuration,
                overallPassRate,
                last10.stream().map(this::toListItem).toList()
        );
    }

    private PerformanceMetricsDto buildMetrics(Execution exec, List<StepResultReportDto> steps) {
        List<StepResultReportDto> timed = steps.stream()
                .filter(s -> s.durationMs() != null && s.durationMs() > 0)
                .toList();

        StepResultReportDto slowest = timed.stream()
                .max(Comparator.comparingLong(StepResultReportDto::durationMs)).orElse(null);
        StepResultReportDto fastest = timed.stream()
                .min(Comparator.comparingLong(StepResultReportDto::durationMs)).orElse(null);

        double avg = timed.stream()
                .mapToLong(StepResultReportDto::durationMs).average().orElse(0);

        double passRate = exec.getTotalSteps() == 0 ? 0 :
                (double) exec.getPassedSteps() / exec.getTotalSteps() * 100;

        // java.util.List — tam qualified name ile OpenPDF List çakışması engellendi
        List<StepResultReportDto> failed = steps.stream()
                .filter(s -> "FAILED".equals(s.status())).toList();

        long screenshotCount = steps.stream()
                .filter(s -> s.screenshotPath() != null).count();

        return new PerformanceMetricsDto(
                exec.getDurationMs() != null ? exec.getDurationMs() : 0L,
                avg,
                slowest,
                fastest,
                passRate,
                failed,
                (int) screenshotCount
        );
    }

    private StepResultReportDto toStepDto(ExecutionStepResult s) {
        // actionType enum olduğu için .name() ile String'e çevrilir
        return new StepResultReportDto(
                s.getId(),
                s.getStepOrder(),
                s.getActionType(),   // ActionType enum olarak tutuluyor
                s.getDescription(),
                s.getStatus().name(),
                s.getDurationMs(),
                s.getErrorMessage(),
                s.getScreenshotPath(),
                s.getStartedAt(),
                s.getFinishedAt()
        );
    }

    private ReportListItemDto toListItem(Execution e) {
        double passRate = e.getTotalSteps() == 0 ? 0 :
                (double) e.getPassedSteps() / e.getTotalSteps() * 100;
        return new ReportListItemDto(
                e.getPublicId().toString(),
                e.getScenario().getPublicId().toString(),
                e.getScenario().getName(),
                e.getStatus().name(),
                e.getTriggerType().name(),
                e.getStartedAt(),
                e.getFinishedAt(),
                e.getDurationMs(),
                e.getTotalSteps(),
                e.getPassedSteps(),
                e.getFailedSteps(),
                passRate
        );
    }
}