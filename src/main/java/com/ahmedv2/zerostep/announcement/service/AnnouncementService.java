package com.ahmedv2.zerostep.announcement.service;

import com.ahmedv2.zerostep.announcement.dto.*;
import com.ahmedv2.zerostep.announcement.entity.*;
import com.ahmedv2.zerostep.announcement.repository.*;
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
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnnouncementService {

    private final AnnouncementRepository announcementRepository;
    private final AnnouncementDismissalRepository dismissalRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    //  ADMIN

    @Transactional
    public AnnouncementResponse create(AnnouncementCreateRequest request, String adminUsername) {
        User admin = findUser(adminUsername);
        validateTargetFields(request.targetType(), request.targetRoles(),
                request.targetUserPublicIds());

        Announcement a = new Announcement();
        a.setTitle(request.title());
        a.setBody(request.body());
        a.setSeverity(request.severity());
        a.setTargetType(request.targetType());
        a.setTargetRoles(toArray(request.targetRoles()));
        a.setTargetUserIds(resolveUserIds(request.targetUserPublicIds()));
        a.setPublishAt(request.publishAt() != null ? request.publishAt() : null);
        a.setExpiresAt(request.expiresAt());
        a.setCreatedBy(admin);

        return toResponse(announcementRepository.save(a));
    }

    @Transactional(readOnly = true)
    public Page<AnnouncementResponse> adminList(Pageable pageable) {
        return announcementRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(this::toResponse);
    }

    @Transactional
    public AnnouncementResponse update(UUID publicId, AnnouncementUpdateRequest request) {
        Announcement a = findOrThrow(publicId);
        if (a.isPublished()) {
            throw new ForbiddenException("Yayinlanmis duyuru duzenlenemez");
        }
        if (request.title() != null)    a.setTitle(request.title());
        if (request.body() != null)     a.setBody(request.body());
        if (request.severity() != null) a.setSeverity(request.severity());
        if (request.targetType() != null) {
            a.setTargetType(request.targetType());
            a.setTargetRoles(toArray(request.targetRoles()));
            a.setTargetUserIds(resolveUserIds(request.targetUserPublicIds()));
        }
        if (request.publishAt() != null)  a.setPublishAt(request.publishAt());
        if (request.expiresAt() != null)  a.setExpiresAt(request.expiresAt());
        return toResponse(announcementRepository.save(a));
    }

    // Duyuruyu yayınla; hedef kullanıcılara bildirim gönder + WebSocket broadcast
    @Transactional
    public AnnouncementResponse publish(UUID publicId) {
        Announcement a = findOrThrow(publicId);
        if (a.isPublished()) {
            throw new ConflictException("Duyuru zaten yayinlandi");
        }
        a.setPublished(true);
        a.setPublishAt(Instant.now());
        Announcement saved = announcementRepository.save(a);

        // Hedef kullanıcıları çöz ve bildirim gönder
        List<User> targets = resolveTargetUsers(saved);
        log.info("Duyuru yayinlandi: publicId={} hedef={}", publicId, targets.size());

        String link = "/announcements/" + saved.getPublicId();
        for (User user : targets) {
            notificationService.send(
                    user.getId(),
                    NotificationType.ADMIN_ANNOUNCEMENT,
                    saved.getTitle(),
                    saved.getBody().length() > 200
                            ? saved.getBody().substring(0, 200) + "..." : saved.getBody(),
                    link
            );
        }

        // Online herkese WebSocket broadcast; client filtre uygular
        messagingTemplate.convertAndSend("/topic/announcements", toResponse(saved));
        log.debug("WebSocket broadcast gonderildi: /topic/announcements");

        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID publicId) {
        Announcement a = findOrThrow(publicId);
        if (a.isPublished()) {
            throw new ForbiddenException("Yayinlanmis duyuru silinemez; once expire edilin");
        }
        announcementRepository.delete(a);
    }

    // USER

    // Kullanıcıya görünür aktif duyurular; hedef + dismiss filtresi
    @Transactional(readOnly = true)
    public List<AnnouncementResponse> listVisible(Long userId, Set<String> userRoles) {
        List<Announcement> active = announcementRepository.findActiveNotDismissed(
                userId, Instant.now());

        return active.stream()
                .filter(a -> isVisibleFor(a, userId, userRoles))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // Kullanıcı duyuruyu dismiss eder; bir daha gösterilmez
    @Transactional
    public void dismiss(UUID publicId, Long userId) {
        Announcement a = findOrThrow(publicId);
        AnnouncementDismissal.DismissalId id = new AnnouncementDismissal.DismissalId();
        id.setAnnouncementId(a.getId());
        id.setUserId(userId);

        if (dismissalRepository.existsById(id)) return;

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        AnnouncementDismissal dismissal = new AnnouncementDismissal();
        dismissal.setId(id);
        dismissal.setAnnouncement(a);
        dismissal.setUser(user);
        dismissalRepository.save(dismissal);
        log.debug("Duyuru dismiss edildi: userId={} announcementId={}", userId, a.getId());
    }

    // PRIVATE

    private boolean isVisibleFor(Announcement a, Long userId, Set<String> roles) {
        return switch (a.getTargetType()) {
            case ALL -> true;
            case ROLE -> {
                // Kullanıcının rollerinden herhangi biri hedef rollerde var mı?
                Set<String> targets = Set.of(a.getTargetRoles());
                yield roles.stream().map(r -> r.replace("ROLE_", ""))
                        .anyMatch(targets::contains);
            }
            case USERS -> Arrays.asList(a.getTargetUserIds()).contains(userId);
        };
    }

    private List<User> resolveTargetUsers(Announcement a) {
        return switch (a.getTargetType()) {
            case ALL -> userRepository.findAll().stream()
                    .filter(u -> u.isEnabled() && u.getDeletedAt() == null)
                    .collect(Collectors.toList());
            case ROLE -> {
                Set<String> roles = Set.of(a.getTargetRoles());
                yield userRepository.findAll().stream()
                        .filter(u -> u.isEnabled() && u.getDeletedAt() == null)
                        .filter(u -> u.getRoles().stream()
                                .anyMatch(r -> roles.contains(r.getName())))
                        .collect(Collectors.toList());
            }
            case USERS -> Arrays.stream(a.getTargetUserIds())
                    .map(id -> userRepository.findById(id).orElse(null))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        };
    }

    private void validateTargetFields(AnnouncementTargetType type,
                                      List<String> roles, List<UUID> userIds) {
        if (type == AnnouncementTargetType.ROLE
                && (roles == null || roles.isEmpty())) {
            throw new ConflictException("ROLE hedefleme icin targetRoles zorunlu");
        }
        if (type == AnnouncementTargetType.USERS
                && (userIds == null || userIds.isEmpty())) {
            throw new ConflictException("USERS hedefleme icin targetUserPublicIds zorunlu");
        }
    }

    private Long[] resolveUserIds(List<UUID> publicIds) {
        if (publicIds == null || publicIds.isEmpty()) return new Long[0];
        return publicIds.stream()
                .map(pid -> userRepository.findByPublicId(pid)
                        .map(User::getId)
                        .orElseThrow(() -> new ResourceNotFoundException("User", pid)))
                .toArray(Long[]::new);
    }

    private String[] toArray(List<String> list) {
        return list == null ? new String[0] : list.toArray(new String[0]);
    }

    private Announcement findOrThrow(UUID publicId) {
        return announcementRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Announcement", publicId));
    }

    private User findUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));
    }

    private AnnouncementResponse toResponse(Announcement a) {
        return new AnnouncementResponse(
                a.getPublicId(),
                a.getTitle(),
                a.getBody(),
                a.getSeverity(),
                a.getTargetType(),
                Arrays.asList(a.getTargetRoles()),
                a.isPublished(),
                a.getPublishAt(),
                a.getExpiresAt(),
                a.getCreatedBy().getUsername(),
                a.getCreatedAt()
        );
    }
}