package com.ahmedv2.zerostep.auth.dto;

import java.util.Set;
import java.util.UUID;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long accessTokenExpiresIn,
        UUID userPublicId,
        String username,
        String email,
        String displayName,
        Set<String> roles,
        boolean passwordChangeRequired
) {}
