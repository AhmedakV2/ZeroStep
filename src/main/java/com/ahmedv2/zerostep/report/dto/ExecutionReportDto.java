package com.ahmedv2.zerostep.report.dto;

import java.time.Instant;
import java.util.List;

// Tek execution için zenginleştirilmiş rapor verisi
public record ExecutionReportDto(
        String executionPublicId,
        String scenarioPublicId,
        String scenarioName,
        String scenarioDescription,
        String ownerUsername,
        String status,
        String triggerType,
        Instant queuedAt,
        Instant startedAt,
        Instant finishedAt,
        int totalSteps,
        int passedSteps,
        int failedSteps,
        int skippedSteps,
        List<StepResultReportDto> stepResults,
        PerformanceMetricsDto metrics
) {}
