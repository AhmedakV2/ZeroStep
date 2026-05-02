package com.ahmedv2.zerostep.extension.entity;

import com.ahmedv2.zerostep.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "extension_api_tokens")
@Getter
@Setter
@NoArgsConstructor
public class ExtensionApiToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", unique = true, nullable = false, updatable = false)
    private UUID publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    // Token'a kullanıcının verdiği isim (örn. "Chrome Extension - Ev")
    @Column(nullable = false, length = 128)
    private String name;

    // SHA-256 hash; plain token asla DB'de saklanmaz
    @Column(name = "token_hash", nullable = false, unique = true, length = 128)
    private String tokenHash;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    // NULL = sonsuz geçerlilik
    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (publicId == null) publicId = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
    }

    // Token aktif mi? Revoke edilmemiş ve süresi dolmamış
    public boolean isActive() {
        if (revokedAt != null) return false;
        if (expiresAt != null && expiresAt.isBefore(Instant.now())) return false;
        return true;
    }
}