package com.ahmedv2.zerostep.step.dto;

import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.SelectorType;
import com.ahmedv2.zerostep.step.entity.TestStepConfig;
import jakarta.validation.constraints.Size;


public record TestStepUpdateRequest(
        ActionType actionType,
        SelectorType selectorType,

        @Size(max = 2048)
        String selectorValue,

        @Size(max = 100000)
        String inputValue,

        @Size(max = 100000)
        String secondaryValue,

        @Size(max = 500)
        String description,

        TestStepConfig config,

        Boolean enabled
) {}