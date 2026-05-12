package com.ahmedv2.zerostep.user.controller;

import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.user.dto.ChangePasswordRequest;
import com.ahmedv2.zerostep.user.dto.UpdateProfileRequest;
import com.ahmedv2.zerostep.user.dto.UserResponse;
import com.ahmedv2.zerostep.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "Kullanici profili")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    @Operation(summary = "Sistemdeki kullanicilari ara (Chat vb. islemler icin)")
    @GetMapping
    public ApiResponse<Page<UserResponse>> searchUsers(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return ApiResponse.ok(userService.searchUsers(search, pageable));
    }

    @Operation(summary = "Mevcut kullanicinin profilini getir")
    @GetMapping("/me")
    public ApiResponse<UserResponse> getMyProfile(Authentication authentication) {
        return ApiResponse.ok(userService.getCurrentUser(authentication.getName()));
    }

    @Operation(summary = "Profil bilgilerini guncelle (displayName, email)")
    @PatchMapping("/me")
    public ApiResponse<UserResponse> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            Authentication authentication) {
        return ApiResponse.ok(userService.updateProfile(authentication.getName(), request));
    }

    @Operation(summary = "Sifre degistir; sonrasinda tum oturumlar kapanir")
    @PostMapping("/me/change-password")
    public ApiResponse<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            Authentication authentication) {
        userService.changePassword(authentication.getName(), request);
        return ApiResponse.message("Sifre basariyla degistirildi. Lutfen yeniden giris yapin.");
    }
}