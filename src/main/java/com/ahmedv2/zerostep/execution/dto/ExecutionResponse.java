package com.ahmedv2.zerostep.execution.dto;

import com.ahmedv2.zerostep.execution.entity.ExecutionStatus;
import com.ahmedv2.zerostep.execution.entity.TriggerType;

import java.time.Instant;
import java.util.UUID;

public record ExecutionResponse(
        UUID publicId,
        UUID scenarioPublicId,
        String scenarioName,
        String triggeredByName,
        TriggerType triggerType,
        ExecutionStatus status,
        Instant queuedAt,
        Instant startedAt,
        Instant finishedAt,
        Long durationMs,
        Integer totalSteps,
        int passedSteps,
        int failedSteps,
        int skippedSteps,
        String errorMessage,
        String cancelledBy
) {}