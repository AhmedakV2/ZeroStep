package com.ahmedv2.zerostep.announcement.repository;

import com.ahmedv2.zerostep.announcement.entity.AnnouncementDismissal;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnnouncementDismissalRepository
        extends JpaRepository<AnnouncementDismissal, AnnouncementDismissal.DismissalId> {

    boolean existsByIdAnnouncementIdAndIdUserId(Long announcementId, Long userId);
}