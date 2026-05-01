package com.ahmedv2.zerostep.schedule.dto;

import com.ahmedv2.zerostep.schedule.entity.ScheduleFrequency;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ScheduleResponse(
        UUID publicId,
        UUID scenarioPublicId,
        String scenarioName,
        String createdByUsername,
        ScheduleFrequency frequency,
        String runTime,
        Short runDayOfWeek,
        String timezone,
        boolean enabled,
        Instant lastRunAt,
        Instant nextRunAt,
        List<String> recipients,
        boolean notifyOnFailureOnly,
        Instant createdAt
) {}