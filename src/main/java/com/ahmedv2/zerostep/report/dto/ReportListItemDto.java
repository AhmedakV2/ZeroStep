package com.ahmedv2.zerostep.report.dto;

import java.time.Instant;

// Rapor liste sayfasında tek satır
public record ReportListItemDto(
        String executionPublicId,
        String scenarioPublicId,
        String scenarioName,
        String status,
        String triggerType,
        Instant startedAt,
        Instant finishedAt,
        Long durationMs,
        int totalSteps,
        int passedSteps,
        int failedSteps,
        double passRate
) {}