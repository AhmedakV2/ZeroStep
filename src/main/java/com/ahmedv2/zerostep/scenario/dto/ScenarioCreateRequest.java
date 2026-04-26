package com.ahmedv2.zerostep.scenario.dto;

import com.ahmedv2.zerostep.scenario.entity.BrowserConfig;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

import java.util.Set;

public record ScenarioCreateRequest(

        @NotBlank(message = "Senaryo adi bos olamaz")
        @Size(min = 3, max = 255, message = "Senaryo adi 3-25 karakter")
        String name,

        @Size(max = 5000)
        String description,

        @URL(message = "Gecerli bir URL olmali")
        @Size(max = 1024)
        String baseUrl,

        BrowserConfig browserConfig,

        Set<@NotBlank @Size(max = 64) String> tags


) {}
