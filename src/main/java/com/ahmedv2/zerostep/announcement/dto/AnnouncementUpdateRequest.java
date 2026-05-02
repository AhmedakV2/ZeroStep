package com.ahmedv2.zerostep.announcement.dto;

import com.ahmedv2.zerostep.announcement.entity.AnnouncementSeverity;
import com.ahmedv2.zerostep.announcement.entity.AnnouncementTargetType;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AnnouncementUpdateRequest(

        @Size(max = 255) String title,
        String body,
        AnnouncementSeverity severity,
        AnnouncementTargetType targetType,
        List<String> targetRoles,
        List<UUID> targetUserPublicIds,
        Instant publishAt,
        Instant expiresAt
) {}
