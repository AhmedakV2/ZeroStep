package com.ahmedv2.zerostep.notification.service;

import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.notification.dto.*;
import com.ahmedv2.zerostep.notification.entity.*;
import com.ahmedv2.zerostep.notification.repository.NotificationPreferenceRepository;
import com.ahmedv2.zerostep.notification.repository.NotificationRepository;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // Yeni bildirim kaydet + WebSocket push
    // REQUIRES_NEW: caller transaction'indan bagimsiz commit edilmeli
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void send(Long recipientUserId, NotificationType type,
                     String title, String message, String link) {
        try {
            // Preference kontrolu; yoksa enabled kabul edilir
            boolean enabled = isEnabled(recipientUserId, type);
            if (!enabled) {
                log.debug("Bildirim engellendi (preference): userId={} type={}", recipientUserId, type);
                return;
            }

            User recipient = userRepository.findById(recipientUserId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", recipientUserId));

            Notification notification = new Notification();
            notification.setRecipient(recipient);
            notification.setType(type);
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setLink(link);

            Notification saved = notificationRepository.save(notification);
            log.debug("Bildirim kaydedildi: id={} type={} user={}", saved.getId(), type, recipientUserId);

            // IN_APP kanalinda WebSocket push
            if (hasChannel(recipientUserId, type, "IN_APP")) {
                pushWebSocket(recipient.getUsername(), toResponse(saved));
            }
        } catch (Exception e) {
            log.error("Bildirim gonderilemedi: userId={} type={}", recipientUserId, type, e);
        }
    }

    // Execution tamamlaninca notificationService.notifyExecutionFinished(execution) cagrir
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyExecutionFinished(Long recipientUserId, String scenarioName,
                                        String status, UUID executionPublicId) {
        boolean failed = "FAILED".equals(status) || "TIMEOUT".equals(status);
        NotificationType type = failed ? NotificationType.EXECUTION_FAILED
                : NotificationType.EXECUTION_COMPLETED;
        String title = failed ? "Senaryo Basarisiz" : "Senaryo Tamamlandi";
        String msg = scenarioName + " senaryosu " + status + " durumunda bitti.";
        String link = "/executions/" + executionPublicId;
        send(recipientUserId, type, title, msg, link);
    }

    // Schedule tetiklenince notifyScheduleTriggered cagrir
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyScheduleTriggered(Long recipientUserId, String scenarioName,
                                        UUID executionPublicId) {
        send(recipientUserId, NotificationType.SCHEDULE_TRIGGERED,
                "Zamanlı Görev Başladı",
                scenarioName + " senaryosu schedule ile tetiklendi.",
                "/executions/" + executionPublicId);
    }

    // Kullanicinin kendi bildirimleri
    @Transactional(readOnly = true)
    public Page<NotificationResponse> list(Long userId, Pageable pageable) {
        return notificationRepository.findByRecipientId(userId, pageable)
                .map(this::toResponse);
    }

    // Okunmamis bildirim sayisi
    @Transactional(readOnly = true)
    public UnreadCountResponse unreadCount(Long userId) {
        return new UnreadCountResponse(notificationRepository.countUnread(userId));
    }

    // Tek bildirimi okunmus yap
    @Transactional
    public NotificationResponse markRead(UUID publicId, Long userId) {
        Notification n = notificationRepository.findByPublicIdAndRecipientId(publicId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", publicId));
        if (!n.isRead()) {
            n.setRead(true);
            n.setReadAt(Instant.now());
            notificationRepository.save(n);
        }
        return toResponse(n);
    }

    // Tum bildirimleri okunmus yap
    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllRead(userId, Instant.now());
    }

    // Bildirimi sil
    @Transactional
    public void delete(UUID publicId, Long userId) {
        Notification n = notificationRepository.findByPublicIdAndRecipientId(publicId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", publicId));
        notificationRepository.delete(n);
    }

    // Kullanicinin tum preference'larini getir; eksik tipler default olarak donerr
    @Transactional(readOnly = true)
    public List<NotificationPreferenceResponse> getPreferences(Long userId) {
        List<NotificationPreference> existing = preferenceRepository.findByUserId(userId);
        return Arrays.stream(NotificationType.values())
                .map(type -> existing.stream()
                        .filter(p -> p.getType() == type)
                        .findFirst()
                        .map(this::toPrefResponse)
                        .orElse(new NotificationPreferenceResponse(type, true, List.of("IN_APP"))))
                .toList();
    }

    // Preference guncelle; yoksa upsert yap
    @Transactional
    public NotificationPreferenceResponse updatePreference(Long userId, PreferenceUpdateRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        NotificationPreference pref = preferenceRepository
                .findByUserIdAndType(userId, req.type())
                .orElseGet(() -> {
                    NotificationPreference p = new NotificationPreference();
                    p.setUser(user);
                    p.setType(req.type());
                    return p;
                });

        pref.setEnabled(req.enabled());
        if (req.channels() != null && !req.channels().isEmpty()) {
            pref.setChannels(req.channels().toArray(new String[0]));
        }
        return toPrefResponse(preferenceRepository.save(pref));
    }

    // WebSocket push; /user/{username}/queue/notifications destinasyonuna gider
    private void pushWebSocket(String username, NotificationResponse payload) {
        try {
            messagingTemplate.convertAndSendToUser(username, "/queue/notifications", payload);
            log.debug("WebSocket push: user={} type={}", username, payload.type());
        } catch (Exception e) {
            log.warn("WebSocket push basarisiz: user={}", username, e);
        }
    }

    // Preference DB'de yoksa true (enabled) varsayilir
    private boolean isEnabled(Long userId, NotificationType type) {
        return preferenceRepository.findByUserIdAndType(userId, type)
                .map(NotificationPreference::isEnabled)
                .orElse(true);
    }

    // IN_APP veya EMAIL kanal kontrolu
    private boolean hasChannel(Long userId, NotificationType type, String channel) {
        return preferenceRepository.findByUserIdAndType(userId, type)
                .map(p -> Arrays.asList(p.getChannels()).contains(channel))
                .orElse("IN_APP".equals(channel)); // default IN_APP aktif
    }

    private NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(
                n.getPublicId(),
                n.getType(),
                n.getTitle(),
                n.getMessage(),
                n.getLink(),
                n.isRead(),
                n.getReadAt(),
                n.getCreatedAt()
        );
    }

    private NotificationPreferenceResponse toPrefResponse(NotificationPreference p) {
        return new NotificationPreferenceResponse(
                p.getType(),
                p.isEnabled(),
                Arrays.asList(p.getChannels())
        );
    }
}