package com.ahmedv2.zerostep.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record ConversationResponse(
        UUID publicId,
        ParticipantDto otherUser,   // çağıran açısından "karşı taraf"
        String lastMessagePreview,
        Instant lastMessageAt,
        Instant createdAt
) {
    public record ParticipantDto(UUID publicId, String username, String displayName) {}
}