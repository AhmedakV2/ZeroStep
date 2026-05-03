package com.ahmedv2.zerostep.security.service;

import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

// Basarisiz giris sayacini yonetir; N basarisiz -> hesap kilidi
@Service
@RequiredArgsConstructor
@Slf4j
public class LoginAttemptService {

    private static final int MAX_ATTEMPTS = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final UserRepository userRepository;

    // REQUIRES_NEW: dis transaction rollback olsa bile sayac commit edilmeli
    // BadCredentialsException disinda fail olsa bile, sayac artisi kalici olmali
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void loginFailed(String username) {
        userRepository.findByUsername(username).ifPresent(user -> {
            user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
            if (user.getFailedLoginAttempts() >= MAX_ATTEMPTS) {
                user.setLockedUntil(Instant.now().plus(LOCK_DURATION));
                log.warn("Hesap kilitlendi: {} - {} basarisiz deneme",
                        username, user.getFailedLoginAttempts());
            }
            userRepository.save(user);
            log.debug("Failed login attempt kaydedildi: {} -> {}",
                    username, user.getFailedLoginAttempts());
        });
    }

    // Basarili giris; sayaci sifirla, son login zamanini guncelle
    @Transactional
    public void loginSucceeded(User user) {
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
    }

    // Hesap halihazirda kilitli mi?
    @Transactional(readOnly = true)
    public boolean isBlocked(User user) {
        return userRepository.findById(user.getId())
                .map(User::isLocked)
                .orElse(false);
    }
}