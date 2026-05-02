package com.ahmedv2.zerostep.extension.service;

import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.extension.dto.TokenCreateRequest;
import com.ahmedv2.zerostep.extension.dto.TokenResponse;
import com.ahmedv2.zerostep.extension.entity.ExtensionApiToken;
import com.ahmedv2.zerostep.extension.repository.ExtensionApiTokenRepository;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExtensionTokenService {

    private final ExtensionApiTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    // Token oluştur; plainToken sadece burada döner, bir daha gösterilmez
    @Transactional
    public TokenResponse create(String username, TokenCreateRequest request) {
        User user = findUser(username);

        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);
        String plainToken = "zs_ext_" + Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        ExtensionApiToken token = new ExtensionApiToken();
        token.setUser(user);
        token.setName(request.name());
        token.setTokenHash(hash(plainToken));
        token.setExpiresAt(request.expiresAt());

        ExtensionApiToken saved = tokenRepository.save(token);
        log.info("Extension token olusturuldu: user={} name={}", username, request.name());

        return new TokenResponse(
                saved.getPublicId(),
                saved.getName(),
                plainToken, // sadece bu response'da dolu
                null,
                saved.getExpiresAt(),
                saved.getCreatedAt()
        );
    }

    // Kullanıcının aktif tokenlarını listele; plainToken null döner
    @Transactional(readOnly = true)
    public List<TokenResponse> list(String username) {
        User user = findUser(username);
        return tokenRepository.findActiveByUserId(user.getId()).stream()
                .map(t -> new TokenResponse(t.getPublicId(), t.getName(), null,
                        t.getLastUsedAt(), t.getExpiresAt(), t.getCreatedAt()))
                .toList();
    }

    // Token'ı revoke et
    @Transactional
    public void revoke(String username, UUID publicId) {
        User user = findUser(username);
        ExtensionApiToken token = tokenRepository.findByPublicIdAndUserId(publicId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("ExtensionApiToken", publicId));
        token.setRevokedAt(Instant.now());
        tokenRepository.save(token);
        log.info("Extension token revoke edildi: user={} publicId={}", username, publicId);
    }

    // Hash ile token doğrula; lastUsedAt güncelle
    @Transactional
    public ExtensionApiToken validateAndTouch(String plainToken) {
        String h = hash(plainToken);
        ExtensionApiToken token = tokenRepository.findByTokenHash(h)
                .orElse(null);
        if (token == null || !token.isActive()) return null;
        // lastUsedAt güncellemesi; çok sık yazma yapmamak için production'da debounce eklenebilir
        token.setLastUsedAt(Instant.now());
        return tokenRepository.save(token);
    }

    // Gece 02:00'de süresi dolmuş tokenları revoke et
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void cleanupExpired() {
        int count = tokenRepository.revokeExpired(Instant.now());
        if (count > 0) log.info("Expire olmus extension token revoke edildi: {}", count);
    }

    public String hash(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 JVM'de yok", e);
        }
    }

    private User findUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));
    }
}