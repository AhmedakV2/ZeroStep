// src/main/java/com/ahmedv2/zerostep/chat/service/ChatService.java
package com.ahmedv2.zerostep.chat.service;

import com.ahmedv2.zerostep.chat.dto.*;
import com.ahmedv2.zerostep.chat.entity.Conversation;
import com.ahmedv2.zerostep.chat.entity.Message;
import com.ahmedv2.zerostep.chat.repository.ConversationRepository;
import com.ahmedv2.zerostep.chat.repository.MessageRepository;
import com.ahmedv2.zerostep.common.exception.ConflictException;
import com.ahmedv2.zerostep.common.exception.ForbiddenException;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.notification.entity.NotificationType;
import com.ahmedv2.zerostep.notification.service.NotificationService;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;

    // Kullanıcının konuşmalarını listele
    @Transactional(readOnly = true)
    public Page<ConversationResponse> listConversations(Long userId, Pageable pageable) {
        return conversationRepository.findByParticipant(userId, pageable)
                .map(c -> toConversationResponse(c, userId));
    }

    // Konuşma başlat ya da mevcut olanı dön
    @Transactional
    public ConversationResponse startConversation(UUID targetPublicId, Long requesterId) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResourceNotFoundException("User", requesterId));
        User target = userRepository.findByPublicId(targetPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("User", targetPublicId));

        // Pasif veya silinmiş kullanıcı kontrolü
        if (!target.isEnabled() || target.getDeletedAt() != null) {
            throw new ConflictException("Bu kullaniciyla konusma baslatilamaz");
        }

        if (requester.getId().equals(target.getId())) {
            throw new ConflictException("Kendinizle konusma baslatamazsiniz");
        }

        // Normalize: küçük id her zaman userOne
        long oneId = Math.min(requester.getId(), target.getId());
        long twoId = Math.max(requester.getId(), target.getId());

        Conversation conv = conversationRepository.findByUserPair(oneId, twoId)
                .orElseGet(() -> {
                    User uOne = oneId == requester.getId() ? requester : target;
                    User uTwo = twoId == target.getId() ? target : requester;
                    Conversation c = new Conversation();
                    c.setUserOne(uOne);
                    c.setUserTwo(uTwo);
                    return conversationRepository.save(c);
                });

        return toConversationResponse(conv, requesterId);
    }

    // Mesaj gönder
    @Transactional
    public MessageResponse sendMessage(UUID convPublicId, String content, Long senderId) {
        Conversation conv = findConvOrThrow(convPublicId);
        checkParticipant(conv, senderId);

        Message msg = new Message();
        msg.setConversation(conv);
        msg.setSender(userRepository.getReferenceById(senderId));
        msg.setContent(content);
        Message saved = messageRepository.save(msg);

        // Konuşma preview güncelle
        String preview = content.length() > 100 ? content.substring(0, 100) + "..." : content;
        conv.setLastMessageAt(saved.getSentAt());
        conv.setLastMessagePreview(preview);
        conversationRepository.save(conv);

        MessageResponse response = toMessageResponse(saved, false);

        // Karşı tarafa WebSocket push
        Long recipientId = getOtherId(conv, senderId);
        User recipient = userRepository.findById(recipientId)
                .orElse(null);

        // Recipient aktif ve silinmemişse bildirimi/mesajı ilet
        if (recipient != null && recipient.isEnabled() && recipient.getDeletedAt() == null) {
            messagingTemplate.convertAndSendToUser(
                    recipient.getUsername(), "/queue/chat", response);

            // Faz 8 bildirim entegrasyonu
            notificationService.send(
                    recipientId,
                    NotificationType.NEW_MESSAGE,
                    "Yeni Mesaj",
                    userRepository.findById(senderId).map(User::getUsername).orElse("Biri")
                            + " size mesaj gonderdi.",
                    "/chat/" + convPublicId
            );
        }

        log.debug("Mesaj gonderildi: conv={} sender={}", convPublicId, senderId);
        return response;
    }

    // Mesajları listele (kullanıcı; silinmişler hariç)
    @Transactional
    public Page<MessageResponse> getMessages(UUID convPublicId, Long userId, Pageable pageable) {
        Conversation conv = findConvOrThrow(convPublicId);
        checkParticipant(conv, userId);

        // Okuma anında karşı tarafın mesajlarını okundu olarak işaretle
        int marked = messageRepository.markConversationRead(conv.getId(), userId, Instant.now());
        if (marked > 0) {
            log.debug("Okundu islemi: conv={} count={}", convPublicId, marked);
        }

        return messageRepository.findByConversation(conv.getId(), pageable)
                .map(m -> toMessageResponse(m, false));
    }

    // Tek mesajı okundu olarak işaretle
    @Transactional
    public MessageResponse markRead(UUID msgPublicId, Long userId) {
        Message msg = messageRepository.findByPublicId(msgPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", msgPublicId));
        checkParticipant(msg.getConversation(), userId);

        if (msg.getSender().getId().equals(userId)) {
            throw new ConflictException("Kendi mesajinizi okundu olarak isaretleyemezsiniz");
        }
        if (msg.getReadAt() == null && !msg.isDeleted()) {
            msg.setReadAt(Instant.now());
            messageRepository.save(msg);
        }
        return toMessageResponse(msg, false);
    }

    // Soft delete (sadece mesajın sahibi)
    @Transactional
    public void deleteMessage(UUID msgPublicId, Long userId) {
        Message msg = messageRepository.findByPublicId(msgPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", msgPublicId));

        if (!msg.getSender().getId().equals(userId)) {
            throw new ForbiddenException("Sadece kendi mesajlarinizi silebilirsiniz");
        }
        msg.setDeleted(true);
        messageRepository.save(msg);
        log.debug("Mesaj silindi (soft): {}", msgPublicId);
    }

    // Okunmamış mesaj sayısı
    @Transactional(readOnly = true)
    public UnreadMessageCountResponse unreadCount(Long userId) {
        return new UnreadMessageCountResponse(messageRepository.countUnreadByUser(userId));
    }

    // ADMIN

    @Transactional(readOnly = true)
    public Page<AdminConversationResponse> adminListConversations(String search, Pageable pageable) {
        String s = search == null ? "" : search.trim();
        return conversationRepository.findAllForAdmin(s, pageable)
                .map(this::toAdminConversationResponse);
    }

    // Admin mesajları okur; silinmişler dahil, içerik maskelenmez
    @Transactional(readOnly = true)
    public Page<MessageResponse> adminGetMessages(UUID convPublicId, Pageable pageable) {
        Conversation conv = conversationRepository.findByPublicId(convPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation", convPublicId));
        return messageRepository.findByConversationAdmin(conv.getId(), pageable)
                .map(m -> toMessageResponse(m, true));
    }

    // YARDIMCILAR

    private Conversation findConvOrThrow(UUID publicId) {
        return conversationRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation", publicId));
    }

    private void checkParticipant(Conversation conv, Long userId) {
        boolean isParticipant = conv.getUserOne().getId().equals(userId)
                || conv.getUserTwo().getId().equals(userId);
        if (!isParticipant) {
            throw new ForbiddenException("Bu konusmaya erisim yetkiniz yok");
        }
    }

    private Long getOtherId(Conversation conv, Long myId) {
        return conv.getUserOne().getId().equals(myId)
                ? conv.getUserTwo().getId()
                : conv.getUserOne().getId();
    }

    private ConversationResponse toConversationResponse(Conversation c, Long viewerId) {
        User other = c.getUserOne().getId().equals(viewerId) ? c.getUserTwo() : c.getUserOne();
        return new ConversationResponse(
                c.getPublicId(),
                new ConversationResponse.ParticipantDto(
                        other.getPublicId(), other.getUsername(), other.getDisplayName()),
                c.getLastMessagePreview(),
                c.getLastMessageAt(),
                c.getCreatedAt()
        );
    }

    private AdminConversationResponse toAdminConversationResponse(Conversation c) {
        return new AdminConversationResponse(
                c.getPublicId(),
                new ConversationResponse.ParticipantDto(
                        c.getUserOne().getPublicId(),
                        c.getUserOne().getUsername(),
                        c.getUserOne().getDisplayName()),
                new ConversationResponse.ParticipantDto(
                        c.getUserTwo().getPublicId(),
                        c.getUserTwo().getUsername(),
                        c.getUserTwo().getDisplayName()),
                c.getLastMessagePreview(),
                c.getLastMessageAt(),
                c.getCreatedAt()
        );
    }

    private MessageResponse toMessageResponse(Message m, boolean adminView) {
        // Admin veya normal kullanıcı görünümü: silinen mesajlarda içerik maskelenir
        String content = (m.isDeleted() && !adminView) ? null : m.getContent();
        return new MessageResponse(
                m.getPublicId(),
                m.getSender().getUsername(),
                content,
                m.isDeleted(),
                m.getSentAt(),
                m.getReadAt()
        );
    }
}