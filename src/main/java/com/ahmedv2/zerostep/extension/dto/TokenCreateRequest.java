package com.ahmedv2.zerostep.extension.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record TokenCreateRequest(
        @NotBlank @Size(max = 128)
        String name,

        // NULL = sonsuz; ISO-8601 instant
        Instant expiresAt
) {}