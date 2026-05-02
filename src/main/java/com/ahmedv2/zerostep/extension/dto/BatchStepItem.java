package com.ahmedv2.zerostep.extension.dto;

import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.SelectorType;
import com.ahmedv2.zerostep.step.entity.TestStepConfig;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BatchStepItem(
        @NotNull ActionType actionType,
        SelectorType selectorType,

        @Size(max = 2048)
        String selectorValue,

        @Size(max = 100000)
        String inputValue,

        @Size(max = 100000)
        String secondaryValue,

        // Boş/null gelirse actionType + selectorValue'dan otomatik üretilir
        @Size(max = 500)
        String description,

        TestStepConfig config
) {}