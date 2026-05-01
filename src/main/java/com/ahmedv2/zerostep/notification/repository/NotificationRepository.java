package com.ahmedv2.zerostep.notification.repository;

import com.ahmedv2.zerostep.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    // Kullanicinin bildirimleri, sayfalanmis
    @Query("SELECT n FROM Notification n WHERE n.recipient.id = :userId ORDER BY n.createdAt DESC")
    Page<Notification> findByRecipientId(@Param("userId") Long userId, Pageable pageable);

    // Okunmamis bildirim sayisi
    @Query("SELECT COUNT(n) FROM Notification n WHERE n.recipient.id = :userId AND n.read = FALSE")
    long countUnread(@Param("userId") Long userId);

    Optional<Notification> findByPublicIdAndRecipientId(UUID publicId, Long recipientId);

    // Tum bildirimleri okunmus yap
    @Modifying
    @Query("UPDATE Notification n SET n.read = TRUE, n.readAt = :now " +
            "WHERE n.recipient.id = :userId AND n.read = FALSE")
    int markAllRead(@Param("userId") Long userId, @Param("now") Instant now);

    Optional<Notification> findByPublicId(UUID publicId);
}