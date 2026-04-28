package com.ahmedv2.zerostep.step.dto;

import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.SelectorType;
import com.ahmedv2.zerostep.step.entity.TestStepConfig;

import java.time.Instant;
import java.util.UUID;

public record TestStepResponse(
        UUID publicId,
        Double stepOrder,
        ActionType actionType,
        SelectorType selectorType,
        String selectorValue,
        String inputValue,
        String secondaryValue,
        String description,
        TestStepConfig config,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {}