package com.ahmedv2.zerostep.auth.controller;

import com.ahmedv2.zerostep.auth.dto.AuthResponse;
import com.ahmedv2.zerostep.auth.dto.LoginRequest;
import com.ahmedv2.zerostep.auth.dto.RefreshTokenRequest;
import com.ahmedv2.zerostep.auth.service.AuthService;
import com.ahmedv2.zerostep.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Kimlik dogrulama ve token yonetimi")
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "Login; access + refresh token doner")
    @SecurityRequirements
    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                           HttpServletRequest httpRequest) {
        AuthResponse response = authService.login(
                request,
                httpRequest.getHeader("User-Agent"),
                extractIp(httpRequest)
        );
        return ApiResponse.ok(response);
    }

    @Operation(summary = "Refresh token ile yeni access token uret")
    @SecurityRequirements
    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request,
                                             HttpServletRequest httpRequest) {
        AuthResponse response = authService.refresh(
                request.refreshToken(),
                httpRequest.getHeader("User-Agent"),
                extractIp(httpRequest)
        );
        return ApiResponse.ok(response);
    }

    @Operation(summary = "Logout; kullanicinin tum refresh token'lari iptal edilir")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/logout")
    public ApiResponse<Void> logout(Authentication authentication) {
        authService.logout(authentication.getName());
        return ApiResponse.message("Cikis yapildi");
    }


    private String extractIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}