package com.ahmedv2.zerostep.announcement.dto;

import com.ahmedv2.zerostep.announcement.entity.AnnouncementSeverity;
import com.ahmedv2.zerostep.announcement.entity.AnnouncementTargetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record AnnouncementCreateRequest(
        @NotBlank @Size(max = 255)
        String title,

        @NotBlank
        String body,

        @NotNull
        AnnouncementSeverity severity,

        @NotNull
        AnnouncementTargetType targetType,

        List<String> targetRoles,

        List<java.util.UUID> targetUserPublicIds,

        Instant publishAt,

        Instant expiresAt

) {}
