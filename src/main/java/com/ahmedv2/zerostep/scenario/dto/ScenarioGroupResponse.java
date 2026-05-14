package com.ahmedv2.zerostep.scenario.dto;

import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
public class ScenarioGroupResponse {
    private UUID publicId;
    private String name;
    private String description;
    private Instant createdAt;


    private long totalScenarios;
    private long readyScenarios;
    private long draftScenarios;
    private long archivedScenarios;
}