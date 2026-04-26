package com.ahmedv2.zerostep.admin.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.Set;

public record AdminUpdateRolesRequest(

        @NotEmpty(message = "En az bir rol secilmeli")
        Set<String> roles
) {}
