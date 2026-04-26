package com.ahmedv2.zerostep.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record RefreshTokenRequest(
        @NotBlank(message = "Refresh token bos olamaz")
        String refreshToken
) {}