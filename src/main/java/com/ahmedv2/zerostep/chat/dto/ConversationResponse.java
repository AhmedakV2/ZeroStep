package com.ahmedv2.zerostep.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record ConversationResponse(
        UUID publicId,
        ParticipantDto otherUser,
        String lastMessagePreview,
        Instant lastMessageAt,
        Instant createdAt,
        long unreadCount
) {
    public record ParticipantDto(UUID publicId, String username, String displayName) {}
}