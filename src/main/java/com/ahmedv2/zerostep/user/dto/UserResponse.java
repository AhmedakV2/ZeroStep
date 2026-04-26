package com.ahmedv2.zerostep.user.dto;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record UserResponse(
        UUID publicId,
        String username,
        String email,
        String displayName,
        boolean enabled,
        boolean passwordChangeRequired,
        Set<String> roles,
        Instant createdAt,
        Instant lastLoginAt
) {}