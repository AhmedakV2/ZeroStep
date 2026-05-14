package com.ahmedv2.zerostep.scenario.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ScenarioGroupCreateRequest {

    @NotBlank(message = "Grup/Modül adı boş olamaz")
    @Size(min = 3, max = 255, message = "Ad 3 ile 255 karakter arasında olmalıdır")
    private String name;

    @Size(max = 500, message = "Açıklama en fazla 500 karakter olabilir")
    private String description;
}