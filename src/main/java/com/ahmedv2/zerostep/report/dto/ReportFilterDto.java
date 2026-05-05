package com.ahmedv2.zerostep.report.dto;

import org.springframework.format.annotation.DateTimeFormat;

import java.time.Instant;

// Rapor liste filtre parametreleri (query params olarak gelir)
public record ReportFilterDto(
        String scenarioName,
        String status,
        String username,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        Instant fromDate,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        Instant toDate
) {}