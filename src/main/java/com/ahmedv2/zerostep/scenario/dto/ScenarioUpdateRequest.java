package com.ahmedv2.zerostep.scenario.dto;

import com.ahmedv2.zerostep.scenario.entity.BrowserConfig;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

import java.util.Set;

public record ScenarioUpdateRequest(

        @Size(min = 3, max = 255)
        String name,

        @Size(max = 5000)
        String description,

        @URL
        @Size(max = 1024)
        String baseUrl,

        BrowserConfig browserConfig,

        Set<String> tags
) {}
