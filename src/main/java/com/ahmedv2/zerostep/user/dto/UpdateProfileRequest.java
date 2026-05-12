package com.ahmedv2.zerostep.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(

        @Size(max = 128, message = "Görünen ad en fazla 128 karakter olabilir")
        String displayName,

        @Email(message = "Geçerli bir e-posta adresi giriniz")
        @Size(max = 255)
        String email
) {}