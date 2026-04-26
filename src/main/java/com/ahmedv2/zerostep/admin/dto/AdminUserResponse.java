package com.ahmedv2.zerostep.admin.dto;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record AdminUserResponse(

        UUID publicId,
        String username,
        String email,
        String displayName,
        boolean enabled,
        boolean passwordChangeRequired,
        int failedLoginAttempts,
        Instant lockedUntil,
        boolean locked,
        Instant lastLoginAt,
        Instant createdAt,
        String createdBy,
        Instant updateAt,
        String updatedBy,
        Set<String> roles
) {}
