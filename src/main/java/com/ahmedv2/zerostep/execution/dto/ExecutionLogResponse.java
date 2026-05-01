package com.ahmedv2.zerostep.execution.dto;

import com.ahmedv2.zerostep.execution.entity.LogLevel;

import java.time.Instant;

public record ExecutionLogResponse(
        Long id,
        Long stepResultId,
        LogLevel logLevel,
        String message,
        Instant occurredAt
) {}