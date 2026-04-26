package com.ahmedv2.zerostep.scenario.dto;

import com.ahmedv2.zerostep.scenario.entity.ScenarioStatus;
import jakarta.validation.constraints.NotNull;

public record ScenarioStatusRequest(
        @NotNull(message="Status bos olamaz")
        ScenarioStatus status
) {}
