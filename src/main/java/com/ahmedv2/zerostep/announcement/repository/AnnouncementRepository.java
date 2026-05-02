package com.ahmedv2.zerostep.announcement.repository;

import com.ahmedv2.zerostep.announcement.entity.Announcement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    Optional<Announcement> findByPublicId(UUID publicId);

    Page<Announcement> findAllByOrderByCreatedAtDesc(Pageable pageable);

    // Yayınlanmış, süresi geçmemiş tüm aktif duyurular; filtreleme service'de yapılır
    @Query("""
        SELECT a FROM Announcement a
        WHERE a.published = TRUE
          AND a.publishAt <= :now
          AND (a.expiresAt IS NULL OR a.expiresAt > :now)
          AND a.id NOT IN (
              SELECT d.id.announcementId FROM AnnouncementDismissal d
              WHERE d.id.userId = :userId
          )
        ORDER BY a.severity DESC, a.publishAt DESC
        """)
    List<Announcement> findActiveNotDismissed(@Param("userId") Long userId,
                                              @Param("now") Instant now);
}