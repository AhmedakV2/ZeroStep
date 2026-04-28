package com.ahmedv2.zerostep.step.dto;

import com.ahmedv2.zerostep.step.entity.ActionType;

// Frontend dinamik form olusturmak icin: hangi action hangi alani ister?
public record ActionMetadataResponse(
        ActionType actionType,
        String category,
        String displayName,
        String description,
        boolean requiresSelector,
        boolean requiresInputValue,
        boolean requiresSecondaryValue,
        String inputValueHint,
        String secondaryValueHint,
        boolean sensitive
) {}