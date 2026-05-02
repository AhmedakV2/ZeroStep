package com.ahmedv2.zerostep.extension.repository;

import com.ahmedv2.zerostep.extension.entity.ExtensionApiToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExtensionApiTokenRepository extends JpaRepository<ExtensionApiToken, Long> {

    Optional<ExtensionApiToken> findByTokenHash(String tokenHash);

    // Kullanıcının aktif (revoke edilmemiş) tokenları
    @Query("""
        SELECT t FROM ExtensionApiToken t
        WHERE t.user.id = :userId AND t.revokedAt IS NULL
        ORDER BY t.createdAt DESC
        """)
    List<ExtensionApiToken> findActiveByUserId(@Param("userId") Long userId);

    Optional<ExtensionApiToken> findByPublicIdAndUserId(UUID publicId, Long userId);

    // Süresi dolmuş ve revoke edilmemiş tokenları temizle (scheduler için)
    @Modifying
    @Query("UPDATE ExtensionApiToken t SET t.revokedAt = :now WHERE t.expiresAt < :now AND t.revokedAt IS NULL")
    int revokeExpired(@Param("now") Instant now);
}