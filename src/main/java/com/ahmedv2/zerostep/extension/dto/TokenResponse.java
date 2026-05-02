package com.ahmedv2.zerostep.extension.dto;

import java.time.Instant;
import java.util.UUID;

// plainToken sadece oluşturulduğu anda dolu; list endpoint'te null gelir
public record TokenResponse(
        UUID publicId,
        String name,
        String plainToken,   // null (sadece create response'da dolu)
        Instant lastUsedAt,
        Instant expiresAt,
        Instant createdAt
) {}