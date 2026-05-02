package com.ahmedv2.zerostep.extension.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

public record ExtensionScenarioCreateRequest(
        @NotBlank @Size(min = 3, max = 255)
        String name,

        @Size(max = 5000)
        String description,

        @URL @Size(max = 1024)
        String baseUrl
) {}