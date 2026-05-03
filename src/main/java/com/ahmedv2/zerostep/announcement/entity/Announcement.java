package com.ahmedv2.zerostep.announcement.entity;


import com.ahmedv2.zerostep.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "announcements")
@Getter
@Setter
@NoArgsConstructor
public class Announcement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", unique = true, nullable = false, updatable = false)
    private UUID publicId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable= false, columnDefinition = "TEXT")
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AnnouncementSeverity severity = AnnouncementSeverity.INFO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false,length = 16)
    private AnnouncementTargetType targetType = AnnouncementTargetType.ALL;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "target_roles", nullable = false, columnDefinition = "text[]")
    private String[] targetRoles = new String[0];

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "target_user_ids", nullable = false, columnDefinition = "bigint[]")
    private Long[] targetUserIds = new Long[0];

    @Column(name = "is_published", nullable = false)
    private boolean published = false;

    @Column(name = "publish_at")
    private Instant publishAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if(publicId == null ) publicId = UUID.randomUUID();
        Instant now = Instant.now();
        if(createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

}
