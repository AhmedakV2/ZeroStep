package com.ahmedv2.zerostep.announcement.entity;

import com.ahmedv2.zerostep.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

@Entity
@Table(name = "announcement_dismissals")
@Getter
@Setter
@NoArgsConstructor
public class AnnouncementDismissal {

    @EmbeddedId
    private DismissalId id = new DismissalId();

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("announcementId")
    @JoinColumn(name = "announcement_id")
    private Announcement announcement;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "dismissed_at", nullable = false)
    private Instant dismissedAt;

    @PrePersist
    void prePersist() {
        if(dismissedAt == null) dismissedAt = Instant.now();
    }

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    public static class DismissalId implements Serializable {
        @Column(name = "announcement_id")
        private Long announcementId;

        @Column(name = "user_id")
        private Long userId;
    }
}
