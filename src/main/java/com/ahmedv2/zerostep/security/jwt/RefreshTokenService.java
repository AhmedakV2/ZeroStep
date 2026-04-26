package com.ahmedv2.zerostep.security.jwt;

import com.ahmedv2.zerostep.config.properties.AppProperties;
import com.ahmedv2.zerostep.user.entity.RefreshToken;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

// Refresh token uretim + hash + dogrulama + revoke
@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final AppProperties appProperties;
    private final SecureRandom secureRandom = new SecureRandom();

    // Token uret; DB'ye hash kaydedilir, plain token client'a donulur
    @Transactional
    public String issue(User user, String userAgent, String ipAddress) {
        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);
        String plainToken = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        RefreshToken rt = new RefreshToken();
        rt.setUser(user);
        rt.setTokenHash(hash(plainToken));
        rt.setExpiresAt(Instant.now().plus(
                Duration.ofDays(appProperties.getSecurity().getJwt().getRefreshTokenTtlDays())));
        rt.setUserAgent(truncate(userAgent, 255));
        rt.setIpAddress(truncate(ipAddress, 45));
        refreshTokenRepository.save(rt);

        return plainToken;
    }

    // Plain token'i dogrula; hash eslesirse ve valid ise RefreshToken doner
    @Transactional(readOnly = true)
    public Optional<RefreshToken> validate(String plainToken) {
        if (plainToken == null || plainToken.isBlank()) {
            return Optional.empty();
        }
        return refreshTokenRepository.findByTokenHash(hash(plainToken))
                .filter(RefreshToken::isValid);
    }

    // Rotate: eski token revoke, yenisini uret
    @Transactional
    public String rotate(RefreshToken oldToken, String userAgent, String ipAddress) {
        oldToken.setRevokedAt(Instant.now());
        refreshTokenRepository.save(oldToken);
        return issue(oldToken.getUser(), userAgent, ipAddress);
    }

    // Logout'ta kullanicinin tum refresh token'larini iptal et
    @Transactional
    public void revokeAll(User user) {
        int count = refreshTokenRepository.revokeAllByUser(user, Instant.now());
        log.info("Kullanicinin {} refresh token'i revoke edildi. user={}", count, user.getUsername());
    }

    // Hergun 03:00'te expired token'lari sil
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanupExpiredTokens() {
        int deleted = refreshTokenRepository.deleteAllExpired(Instant.now().minus(Duration.ofDays(30)));
        if (deleted > 0) {
            log.info("Expired refresh token cleanup: {} kayit silindi", deleted);
        }
    }

    // SHA-256 hash
    private String hash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hashBytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algoritmasi JVM'de yok", e);
        }
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return null;
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }
}