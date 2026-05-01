package com.ahmedv2.zerostep.notification.dto;

import com.ahmedv2.zerostep.notification.entity.NotificationType;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record PreferenceUpdateRequest(
        @NotNull NotificationType type,
        @NotNull Boolean enabled,
        List<String> channels
) {}