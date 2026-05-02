package com.ahmedv2.zerostep.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
        @NotBlank(message = "Mesaj bos olamaz")
        @Size(max = 10000)
        String content
) {}