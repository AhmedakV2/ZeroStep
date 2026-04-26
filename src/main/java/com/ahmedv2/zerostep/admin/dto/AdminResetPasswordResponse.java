package com.ahmedv2.zerostep.admin.dto;

public record AdminResetPasswordResponse(

        String username,
        String temporaryPassword,
        String message
) {}
