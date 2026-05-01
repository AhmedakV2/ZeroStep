package com.ahmedv2.zerostep.execution.dto;

import com.ahmedv2.zerostep.execution.entity.StepResultStatus;
import com.ahmedv2.zerostep.step.entity.ActionType;

import java.time.Instant;

public record ExecutionStepResultResponse(
        Long id,
        Double stepOrder,
        ActionType actionType,
        String description,
        StepResultStatus status,
        Instant startedAt,
        Instant finishedAt,
        Long durationMs,
        String errorMessage,
        String screenshotPath
) {}