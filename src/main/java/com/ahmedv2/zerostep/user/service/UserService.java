package com.ahmedv2.zerostep.user.service;

import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.common.exception.UnauthorizedException;
import com.ahmedv2.zerostep.security.jwt.RefreshTokenService;
import com.ahmedv2.zerostep.user.dto.ChangePasswordRequest;
import com.ahmedv2.zerostep.user.dto.UserResponse;
import com.ahmedv2.zerostep.user.entity.Role;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;

    // Kullanicinin kendi profilini getir
    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(String username) {
        User user = userRepository.findByUsernameWithRoles(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));
        return toResponse(user);
    }

    // Sifre degisikligi; mevcut sifreyi dogrula, yeniyi hash'le, tum oturumlari kapat
    @Transactional
    public void changePassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            log.warn("Sifre degistirme basarisiz; mevcut sifre yanlis: {}", username);
            throw new UnauthorizedException("Mevcut sifre hatali");
        }

        // Ayni sifreyi tekrar kullanmasin
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Yeni sifre eskisiyle ayni olamaz");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangeRequired(false);
        userRepository.save(user);

        // Guvenlik: sifre degisince tum refresh token'lari iptal et
        refreshTokenService.revokeAll(user);
        log.info("Sifre basariyla degistirildi: {}", username);
    }

    // User entity -> UserResponse DTO donusumu
    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getPublicId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                user.isEnabled(),
                user.isPasswordChangeRequired(),
                user.getRoles().stream().map(Role::getName).collect(Collectors.toSet()),
                user.getCreatedAt(),
                user.getLastLoginAt()
        );
    }
}