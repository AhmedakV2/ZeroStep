package com.ahmedv2.zerostep.user.service;

import com.ahmedv2.zerostep.common.exception.ConflictException;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.common.exception.UnauthorizedException;
import com.ahmedv2.zerostep.security.jwt.RefreshTokenService;
import com.ahmedv2.zerostep.user.dto.ChangePasswordRequest;
import com.ahmedv2.zerostep.user.dto.UpdateProfileRequest;
import com.ahmedv2.zerostep.user.dto.UserResponse;
import com.ahmedv2.zerostep.user.entity.Role;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    @Transactional(readOnly = true)
    public Page<UserResponse> searchUsers(String search, Pageable pageable) {
        // Arama terimi null ise boş stringe çeviriyoruz ki repository'deki query patlamasın
        String searchTerm = (search == null) ? "" : search.trim();
        Page<User> users = userRepository.searchActive(searchTerm, pageable);

        // Gelen User sayfasını UserResponse sayfasına dönüştürüyoruz
        return users.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(String username) {
        User user = userRepository.findByUsernameWithRoles(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));
        return toResponse(user);
    }

    // displayName ve/veya email güncelle; email değişirse çakışma kontrolü yapılır
    @Transactional
    public UserResponse updateProfile(String username, UpdateProfileRequest request) {
        User user = userRepository.findByUsernameWithRoles(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));

        if (request.displayName() != null) {
            user.setDisplayName(request.displayName().isBlank() ? null : request.displayName().trim());
        }

        if (request.email() != null && !request.email().equals(user.getEmail())) {
            // E-posta başka kullanıcıda kullanılıyor mu kontrol et
            if (userRepository.existsByEmail(request.email())) {
                throw new ConflictException("Bu e-posta adresi zaten kullanımda");
            }
            user.setEmail(request.email().trim());
        }

        User saved = userRepository.save(user);
        log.info("Profil guncellendi: {}", username);
        return toResponse(saved);
    }

    @Transactional
    public void changePassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            log.warn("Sifre degistirme basarisiz; mevcut sifre yanlis: {}", username);
            throw new UnauthorizedException("Mevcut sifre hatali");
        }

        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Yeni sifre eskisiyle ayni olamaz");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangeRequired(false);
        userRepository.save(user);

        refreshTokenService.revokeAll(user);
        log.info("Sifre basariyla degistirildi: {}", username);
    }

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