// src/main/java/com/ahmedv2/zerostep/report/dto/StepResultReportDto.java
package com.ahmedv2.zerostep.report.dto;

import com.ahmedv2.zerostep.step.entity.ActionType;
import java.time.Instant;

// Entity'nin gerçek field tiplerine birebir uyan rapor DTO'su
public record StepResultReportDto(
        Long id,
        Double stepOrder,       // entity'de Double
        ActionType actionType,  // entity'de enum, String değil
        String description,
        String status,
        Long durationMs,
        String errorMessage,
        String screenshotPath,
        Instant startedAt,
        Instant finishedAt
) {}