package com.ahmedv2.zerostep.announcement.dto;

import com.ahmedv2.zerostep.announcement.entity.AnnouncementSeverity;
import com.ahmedv2.zerostep.announcement.entity.AnnouncementTargetType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AnnouncementResponse(
        UUID publicId,
        String title,
        String body,
        AnnouncementSeverity severity,
        AnnouncementTargetType targetType,
        List<String> targetRoles,
        boolean published,
        Instant publishAt,
        Instant expiresAt,
        String createdByUsername,
        Instant createdAt
) {}
