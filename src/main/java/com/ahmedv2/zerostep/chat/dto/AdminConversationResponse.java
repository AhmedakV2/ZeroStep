package com.ahmedv2.zerostep.chat.dto;

import java.time.Instant;
import java.util.UUID;

// Admin görünümü; iki tarafı da açıkça gösterir
public record AdminConversationResponse(
        UUID publicId,
        ConversationResponse.ParticipantDto userOne,
        ConversationResponse.ParticipantDto userTwo,
        String lastMessagePreview,
        Instant lastMessageAt,
        Instant createdAt
) {}