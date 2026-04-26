package com.ahmedv2.zerostep.admin.dto;

import java.util.UUID;

public record AdminCreateUserResponse(
        UUID publicId,
        String username,
        String email,
        String temporaryPassword,
        String message
) {}