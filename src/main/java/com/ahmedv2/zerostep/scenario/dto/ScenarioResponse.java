package com.ahmedv2.zerostep.scenario.dto;

import com.ahmedv2.zerostep.scenario.entity.BrowserConfig;
import com.ahmedv2.zerostep.scenario.entity.ScenarioStatus;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record ScenarioResponse(
        UUID publicId,
        String name,
        String description,
        ScenarioStatus status,
        String baseUrl,
        BrowserConfig browserConfig,
        Set<String> tags,
        OwnerSummary owner,
        Instant createdAt,
        Instant updatedAt
) {
    public record  OwnerSummary(UUID publicId,String username,String displayName) {}
}
