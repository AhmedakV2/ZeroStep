package com.ahmedv2.zerostep.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(

        @NotBlank
        @Size(min = 3,max = 64)
        @Pattern(regexp = "^[a-zA-Z0-9_.-]+$", message = "Kullanici adi harf/rakam/_/./-")
        String username,


        @NotBlank
        @Email
        @Size(max = 255)
        String email,

        @NotBlank
        @Pattern(regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,100}$",
                message = "Sifre en az 8 karakter, 1 buyuk, 1 kucuk, 1 rakam, 1 ozel karakter icermeli")
        String password,

        @Size(max = 128)
        String displayName
) {}
