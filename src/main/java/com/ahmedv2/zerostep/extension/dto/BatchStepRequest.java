package com.ahmedv2.zerostep.extension.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BatchStepRequest(
        @NotEmpty(message = "steps listesi bos olamaz")
        @Size(max = 200, message = "Tek batch'te max 200 step gönderilebilir")
        @Valid
        List<BatchStepItem> steps
) {}