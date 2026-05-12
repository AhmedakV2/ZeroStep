package com.ahmedv2.zerostep.notification.repository;

import com.ahmedv2.zerostep.notification.entity.NotificationPreference;
import com.ahmedv2.zerostep.notification.entity.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {

    List<NotificationPreference> findByUserId(Long userId);

    Optional<NotificationPreference> findByUserIdAndType(Long userId, NotificationType type);
}