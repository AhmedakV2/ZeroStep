package com.ahmedv2.zerostep.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(
        UUID publicId,
        String senderUsername,
        // deleted=true ise null; admin endpoint'te ham içerik dönülür
        String content,
        boolean deleted,
        Instant sentAt,
        Instant readAt
) {}