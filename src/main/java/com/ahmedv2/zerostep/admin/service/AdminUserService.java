package com.ahmedv2.zerostep.admin.service;

import com.ahmedv2.zerostep.admin.dto.*;
import com.ahmedv2.zerostep.audit.service.AuditService;
import com.ahmedv2.zerostep.common.exception.ConflictException;
import com.ahmedv2.zerostep.common.exception.ForbiddenException;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.security.jwt.RefreshTokenService;
import com.ahmedv2.zerostep.user.entity.Role;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.RoleRepository;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;


@Service
@RequiredArgsConstructor
@Slf4j
public class AdminUserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordGenerator passwordGenerator;
    private final RefreshTokenService refreshTokenService;
    private final AuditService auditService;

    // LISTELEME
    @Transactional(readOnly = true)
    public Page<AdminUserResponse> listUsers(String search, Pageable pageable) {
        String normalizedSearch = (search == null) ? "" : search.trim();
        return userRepository.searchActive(normalizedSearch, pageable)
                .map(this::toAdminResponse);
    }

    // TEK KULLANICI
    @Transactional(readOnly = true)
    public AdminUserResponse getUser(UUID publicId){
        User user = findOrThrow(publicId);
        return toAdminResponse(user);
    }

    // OLUSTUR
    @Transactional
    public AdminCreateUserResponse createUser(AdminCreateUserRequest request){
        if(userRepository.existsByUsername(request.username())){
            throw new ConflictException("Kullanici adi zaten kullanimda");
        }
        if(userRepository.existsByEmail(request.email())){
            throw new ConflictException("E-posta zaten kullanimda");
        }

        Set<Role> roles = resolveRoles(request.roles());

        String temporaryPassword = passwordGenerator.generate();

        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        user.setDisplayName(request.displayName());
        user.setEnabled(true);
        user.setPasswordChangeRequired(true);
        user.setRoles(roles);

        User saved = userRepository.save(user);
        log.info("Admin kullanici olusturdu: {} (roller={})",saved.getUsername(), request.roles());

        auditService.record("USER_CREATED","USER",saved.getId(),
                Map.of("username",saved.getUsername(),
                        "email",saved.getEmail(),
                        "roles",request.roles()));

        return new AdminCreateUserResponse(
                saved.getPublicId(),
                saved.getUsername(),
                saved.getEmail(),
                temporaryPassword,
                "Kullanici olusturuldu. Gecici sifreyi kullaniciya guvenli sekilde iletin. Ilk giriste sifresini degistirmek zorunda kalacak."
        );

    }

    // AKTIF / PASIF
    @Transactional
    public void setEnabled(UUID publicId,boolean enabled,String actingUsername){
        User user  = findOrThrow(publicId);

        if(user.getUsername().equals(actingUsername)&& !enabled){
            throw new ForbiddenException("Kendi hesabinizi disi birakamazsiniz");
        }
        if(!enabled && hasAdminRole(user) && userRepository.countActiveAdmins() <= 1){
            throw new ForbiddenException("Sistemdeki son admin devre disi birakilamaz");
        }
        if(user.isEnabled()==enabled){
            return;
        }

        user.setEnabled(enabled);
        userRepository.save(user);

        if(!enabled){
            refreshTokenService.revokeAll(user);
        }

        auditService.record(enabled ? "USER_ENABLED" : "USER_DISABLED","USER",user.getId(),
                Map.of("username",user.getUsername()));
        log.info("Admin kullaniciyi {} yapti: {}",enabled ? "aktif" : "pasif", user.getUsername());
    }

    // KILIDI ACMA MANUEL
    @Transactional
    public void unlocUser(UUID publicId){
        User user = findOrThrow(publicId);
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        auditService.record("USER_UNLOCKED","USER",user.getId(),
                Map.of("username",user.getUsername()));
        log.info("Admin kullanicinin kilidini acti: {}",user.getUsername());
    }


    // ROL DEGISTIRME
    @Transactional
    public AdminUserResponse updateRoles(UUID publicId, AdminUpdateRolesRequest request, String actingUsername) {
        User user = findOrThrow(publicId);
        Set<String> oldRolesNames = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        Set<Role> newRoles = resolveRoles(request.roles());
        Set<String> newRolesNames = newRoles.stream().map(Role::getName).collect(Collectors.toSet());

        // FIX: && !newRolesNames.contains("ADMIN") - admin'ken admin'ligini kaldirmaya calisirsa
        if (user.getUsername().equals(actingUsername) &&
                oldRolesNames.contains("ADMIN") && !newRolesNames.contains("ADMIN")) {
            throw new ForbiddenException("Kendi admin yetkinizi kaldiramazsiniz");
        }

        if (hasAdminRole(user) && !newRolesNames.contains("ADMIN") &&
                userRepository.countActiveAdmins() <= 1) {
            throw new ForbiddenException("Sistemdeki son adminin rolu kaldirilamaz");
        }

        user.setRoles(newRoles);
        userRepository.save(user);

        refreshTokenService.revokeAll(user);

        auditService.record("USER_ROLES_CHANGED", "USER", user.getId(),
                Map.of("username", user.getUsername(),
                        "oldRoles", oldRolesNames,
                        "newRoles", newRolesNames));
        log.info("Admin rol degistirdi: {} ({} -> {})", user.getUsername(), oldRolesNames, newRolesNames);
        return toAdminResponse(user);
    }

    // SIFRE SIFIRLAMA
    @Transactional
    public AdminResetPasswordResponse resetPasswordResponse(UUID publicId){
        User user = findOrThrow(publicId);

        String newPassword = passwordGenerator.generate();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordChangeRequired(true);
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);


        refreshTokenService.revokeAll(user);

        auditService.record("USER_PASSWORD_RESET","USER",user.getId(),
                Map.of("username",user.getUsername()));
        log.info("Admin sifre sifirladi: {}",user.getUsername());

        return new AdminResetPasswordResponse(
                user.getUsername(),
                newPassword,
                "Sifre sifirlandi. Yeni gecici sifreyi kullaniciya guvenli iletin. Ilk giriste degistirmek zorunda kalacak."
        );
    }


    // SILME (HARD DELETE)
    @Transactional
    public void deleteUser(UUID publicId,String actingUsername) {
        User user = findOrThrow(publicId);

        if (user.getUsername().equals(actingUsername)) {
            throw new ForbiddenException("Kendi hesabinizi silemezsiniz");
        }
        if (hasAdminRole(user) && userRepository.countActiveAdmins() <= 1) {
            throw new ForbiddenException("Sistemdeki son admin silinemez");
        }

        // Önce token'ları iptal et
        refreshTokenService.revokeAll(user);

        // Audit kaydını tut
        auditService.record("USER_DELETED", "USER", user.getId(),
                Map.of("username", user.getUsername(), "action", "HARD_DELETE"));

        // Veritabanından tamamen sil
        userRepository.delete(user);

        log.info("Admin kullanici sildi (hard delete): {}", user.getUsername());
    }

    // YARDIMCI METODLAR
    private User findOrThrow(UUID publicId){
        return userRepository.findByPublicIdWithRoles(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("USER",publicId));
    }

    private Set<Role> resolveRoles(Set<String> rolesNames){
        Set<Role> roles = new HashSet<>();
        for(String name : rolesNames) {
            Role role = roleRepository.findByName(name.toUpperCase())
                    .orElseThrow(() -> new ResourceNotFoundException("Role",name));
            roles.add(role);
        }
        return roles;
    }

    private boolean hasAdminRole(User user){
        return user.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getName()));
    }

    private AdminUserResponse toAdminResponse(User user){
        return new AdminUserResponse(
                user.getPublicId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                user.isEnabled(),
                user.isPasswordChangeRequired(),
                user.getFailedLoginAttempts(),
                user.getLockedUntil(),
                user.isLocked(),
                user.getLastLoginAt(),
                user.getCreatedAt(),
                user.getCreatedBy(),
                user.getUpdatedAt(),
                user.getUpdatedBy(),
                user.getRoles().stream().map(Role::getName).collect(Collectors.toSet())

        );
    }
}
