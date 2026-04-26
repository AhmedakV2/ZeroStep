package com.ahmedv2.zerostep.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "Mevcut sifre bos olamaz")
        String currentPassword,

        @NotBlank
        @Size(min = 8, max = 100)
        @Pattern(regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,100}$",
                message = "Yeni sifre en az 8 karakter, 1 buyuk, 1 kucuk, 1 rakam, 1 ozel karakter icermeli")
        String newPassword
) {}