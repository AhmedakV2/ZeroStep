package com.ahmedv2.zerostep.extension.dto;

import com.ahmedv2.zerostep.step.dto.TestStepResponse;
import java.util.List;

public record BatchStepResponse(
        int added,
        List<TestStepResponse> steps
) {}