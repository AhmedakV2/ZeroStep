package com.ahmedv2.zerostep.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "Kullanici adi bos olamaz")
        @Size(min = 3, max = 64, message = "Kullanici adi 3-64 karakter")
        String username,

        @NotBlank(message = "Sifre bos olamaz")
        @Size(min = 8,max = 100,message = "Sifre 8-100 karakter")
        String password
) {}
