package com.ahmedv2.zerostep.step.dto;

import java.util.UUID;

// Drag-drop sonrasi yeni pozisyon
public record TestStepReorderRequest(
        UUID afterStepPublicId,
        UUID beforeStepPublicId
) {
    public boolean isValid() {
        return afterStepPublicId != null || beforeStepPublicId != null;
    }
}