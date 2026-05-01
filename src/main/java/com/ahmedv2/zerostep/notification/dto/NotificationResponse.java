package com.ahmedv2.zerostep.notification.dto;

import com.ahmedv2.zerostep.notification.entity.NotificationType;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID publicId,
        NotificationType type,
        String title,
        String message,
        String link,
        boolean read,
        Instant readAt,
        Instant createdAt
) {}