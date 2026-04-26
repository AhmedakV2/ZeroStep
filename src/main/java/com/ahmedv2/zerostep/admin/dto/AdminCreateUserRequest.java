package com.ahmedv2.zerostep.admin.dto;

import jakarta.validation.constraints.*;

import java.util.Set;

public record AdminCreateUserRequest(

        @NotBlank
        @Size(min = 3, max = 64)
        @Pattern(regexp = "^[a-zA-Z0-9_.-]+$",
                message = "Kullanici adi harf/rakam/_/./-")
        String username,


        @NotBlank
        @Email
        @Size(max = 255)
        String email,

        @Size(max = 255)
        String displayName,

        @NotEmpty(message = "En az bir rol secilmeli")
        Set<String> roles
) {}
