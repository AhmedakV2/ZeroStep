package com.ahmedv2.zerostep.report.dto;

import java.util.List;

// Bir senaryonun tarihsel özeti
public record ScenarioSummaryDto(
        String scenarioPublicId,
        String scenarioName,
        int totalRuns,
        double avgDurationMs,
        double overallPassRate,
        List<ReportListItemDto> last10Executions
) {}
