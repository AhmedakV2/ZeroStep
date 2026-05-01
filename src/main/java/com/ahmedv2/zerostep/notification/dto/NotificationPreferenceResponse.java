package com.ahmedv2.zerostep.notification.dto;

import com.ahmedv2.zerostep.notification.entity.NotificationType;

import java.util.List;

public record NotificationPreferenceResponse(
        NotificationType type,
        boolean enabled,
        List<String> channels
) {}