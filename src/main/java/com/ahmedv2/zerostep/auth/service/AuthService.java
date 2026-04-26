package com.ahmedv2.zerostep.auth.service;

import com.ahmedv2.zerostep.auth.dto.AuthResponse;
import com.ahmedv2.zerostep.auth.dto.LoginRequest;
import com.ahmedv2.zerostep.auth.dto.RegisterRequest;
import com.ahmedv2.zerostep.common.exception.ConflictException;
import com.ahmedv2.zerostep.common.exception.ForbiddenException;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.common.exception.UnauthorizedException;
import com.ahmedv2.zerostep.config.properties.AppProperties;
import com.ahmedv2.zerostep.security.jwt.JwtTokenProvider;
import com.ahmedv2.zerostep.security.jwt.RefreshTokenService;
import com.ahmedv2.zerostep.security.service.LoginAttemptService;
import com.ahmedv2.zerostep.user.entity.RefreshToken;
import com.ahmedv2.zerostep.user.entity.Role;
import com.ahmedv2.zerostep.user.entity.RoleName;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.RoleRepository;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;
    private final LoginAttemptService loginAttemptService;
    private final AppProperties appProperties;

    // @Transactional YOK; login'de exception olursa loginFailed()'in commit olmasini istiyoruz
    // Ic metodlar kendi transaction'larini yonetir
    public AuthResponse login(LoginRequest request, String userAgent, String ipAddress) {
        // Kullaniciyi rolleriyle birlikte cek; burada zaten read-only bir okuma
        User user = userRepository.findByUsernameWithRoles(request.username())
                .orElseThrow(() -> new BadCredentialsException("Kullanici adi veya sifre hatali"));

        // Enabled degilse direkt reddet
        if (!user.isEnabled()) {
            log.warn("Disabled kullanici login denedi: {}", user.getUsername());
            throw new ForbiddenException("Hesap devre disi birakilmis");
        }

        // Zaten kilitli mi?
        if (loginAttemptService.isBlocked(user)) {
            log.warn("Kilitli hesap login denedi: {}", user.getUsername());
            throw new ForbiddenException(
                    "Hesap gecici olarak kilitli. Lutfen bir sure sonra tekrar deneyin.");
        }

        // Sifre dogrulama
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            // REQUIRES_NEW ile calisir; exception atilinca bu kayit kaybolmaz
            loginAttemptService.loginFailed(user.getUsername());
            throw new BadCredentialsException("Kullanici adi veya sifre hatali");
        }

        // Basarili giris; sayaci sifirla
        loginAttemptService.loginSucceeded(user);

        // Token uret
        return buildAuthResponse(user, userAgent, ipAddress);
    }

    // Refresh basarisiz olursa bir sey kaybetmiyoruz, bu yuzden @Transactional uygun
    @Transactional
    public AuthResponse refresh(String refreshTokenValue, String userAgent, String ipAddress) {
        RefreshToken existing = refreshTokenService.validate(refreshTokenValue)
                .orElseThrow(() -> new UnauthorizedException("Refresh token gecersiz veya suresi dolmus"));

        User user = existing.getUser();
        if (!user.isEnabled() || loginAttemptService.isBlocked(user)) {
            throw new ForbiddenException("Hesap uygun durumda degil");
        }

        String newRefreshToken = refreshTokenService.rotate(existing, userAgent, ipAddress);
        String newAccessToken = jwtTokenProvider.generateAccessToken(user);

        return mapToResponse(user, newAccessToken, newRefreshToken);
    }

    @Transactional
    public void logout(String username) {
        userRepository.findByUsername(username)
                .ifPresent(refreshTokenService::revokeAll);
        log.info("Logout: {}", username);
    }

    @Transactional
    public AuthResponse register(RegisterRequest request, boolean createdByAdmin) {
        if (userRepository.existsByUsername(request.username())) {
            throw new ConflictException("Kullanici adi zaten kullanimda");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("E-posta zaten kullanimda");
        }

        Role defaultRole = roleRepository.findByName(RoleName.TESTER)
                .orElseThrow(() -> new ResourceNotFoundException("Varsayilan rol bulunamadi: TESTER"));

        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName());
        user.setEnabled(true);
        user.setPasswordChangeRequired(createdByAdmin);
        user.setRoles(Set.of(defaultRole));

        User saved = userRepository.save(user);
        log.info("Yeni kullanici olusturuldu: {} (admin tarafindan: {})",
                saved.getUsername(), createdByAdmin);

        return mapToResponse(saved, null, null);
    }

    private AuthResponse buildAuthResponse(User user, String userAgent, String ipAddress) {
        String accessToken = jwtTokenProvider.generateAccessToken(user);
        String refreshToken = refreshTokenService.issue(user, userAgent, ipAddress);
        return mapToResponse(user, accessToken, refreshToken);
    }

    private AuthResponse mapToResponse(User user, String accessToken, String refreshToken) {
        Set<String> roleNames = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toSet());
        long accessTtlSec = Duration.ofMinutes(
                appProperties.getSecurity().getJwt().getAccessTokenTtlMinutes()).toSeconds();

        return new AuthResponse(
                accessToken,
                refreshToken,
                "Bearer",
                accessTtlSec,
                user.getPublicId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                roleNames,
                user.isPasswordChangeRequired()
        );
    }
}