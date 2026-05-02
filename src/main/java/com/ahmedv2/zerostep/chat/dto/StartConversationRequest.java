package com.ahmedv2.zerostep.chat.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record StartConversationRequest(
        @NotNull(message = "Hedef kullanici publicId zorunlu")
        UUID targetUserPublicId
) {}