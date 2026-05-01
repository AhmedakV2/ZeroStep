package com.ahmedv2.zerostep.notification.repository;

import com.ahmedv2.zerostep.notification.entity.NotificationPreference;
import com.ahmedv2.zerostep.notification.entity.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {

    List<NotificationPreference> findByUserId(Long userId);

    Optional<NotificationPreference> findByUserIdAndType(Long userId, NotificationType type);

    // Bir tip icin preference yoksa default enabled kabul edilir
    @Query("SELECT CASE WHEN COUNT(p) = 0 THEN TRUE " +
            "ELSE (SELECT p2.enabled FROM NotificationPreference p2 " +
            "WHERE p2.user.id = :userId AND p2.type = :type) END " +
            "FROM NotificationPreference p WHERE p.user.id = :userId AND p.type = :type")
    Boolean isEnabled(@Param("userId") Long userId, @Param("type") NotificationType type);
}