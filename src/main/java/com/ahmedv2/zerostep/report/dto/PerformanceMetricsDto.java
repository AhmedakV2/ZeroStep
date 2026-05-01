// src/main/java/com/ahmedv2/zerostep/report/dto/PerformanceMetricsDto.java
package com.ahmedv2.zerostep.report.dto;

import java.util.List;

// java.util.List explicit; OpenPDF List'i ile karışma olmaz
public record PerformanceMetricsDto(
        long totalDurationMs,
        double avgStepDurationMs,
        StepResultReportDto slowestStep,
        StepResultReportDto fastestStep,
        double passRate,
        List<StepResultReportDto> failedSteps,
        int screenshotCount
) {}