package com.ahmedv2.zerostep.admin.controller;

import com.ahmedv2.zerostep.admin.dto.*;
import com.ahmedv2.zerostep.admin.service.AdminUserService;
import com.ahmedv2.zerostep.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

// Sadece ADMIN rolu; class seviyesinde @PreAuthorize + method seviyesinde pekistirildi
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin - Users", description = "Admin kullanici yonetimi")
@SecurityRequirement(name = "bearerAuth")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @Operation(summary = "Tum kullanicilari listele; search + pagination destekli")
    @GetMapping
    public ApiResponse<Page<AdminUserResponse>> listUsers(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        return ApiResponse.ok(adminUserService.listUsers(search, pageable));
    }

    @Operation(summary = "Tek kullanici detayi")
    @GetMapping("/{publicId}")
    public ApiResponse<AdminUserResponse> getUser(@PathVariable UUID publicId) {
        return ApiResponse.ok(adminUserService.getUser(publicId));
    }

    @Operation(summary = "Yeni kullanici olustur; gecici sifre response'da donulur")
    @PostMapping
    public ResponseEntity<ApiResponse<AdminCreateUserResponse>> createUser(
            @Valid @RequestBody AdminCreateUserRequest request) {
        AdminCreateUserResponse response = adminUserService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @Operation(summary = "Kullaniciyi aktif et")
    @PatchMapping("/{publicId}/enable")
    public ApiResponse<Void> enableUser(@PathVariable UUID publicId, Authentication auth) {
        adminUserService.setEnabled(publicId, true, auth.getName());
        return ApiResponse.message("Kullanici aktif edildi");
    }

    @Operation(summary = "Kullaniciyi pasif et")
    @PatchMapping("/{publicId}/disable")
    public ApiResponse<Void> disableUser(@PathVariable UUID publicId, Authentication auth) {
        adminUserService.setEnabled(publicId, false, auth.getName());
        return ApiResponse.message("Kullanici pasif edildi");
    }

    @Operation(summary = "Manuel kilit ac; failed attempts'i sifirlar, locked_until'i temizler")
    @PatchMapping("/{publicId}/unlock")
    public ApiResponse<Void> unlockUser(@PathVariable UUID publicId) {
        adminUserService.unlocUser(publicId);
        return ApiResponse.message("Kullanicinin kilidi acildi");
    }

    @Operation(summary = "Kullanici rollerini degistir")
    @PatchMapping("/{publicId}/roles")
    public ApiResponse<AdminUserResponse> updateRoles(
            @PathVariable UUID publicId,
            @Valid @RequestBody AdminUpdateRolesRequest request,
            Authentication auth) {
        return ApiResponse.ok(adminUserService.updateRoles(publicId, request, auth.getName()));
    }

    @Operation(summary = "Sifre sifirla; yeni gecici sifre donulur")
    @PostMapping("/{publicId}/reset-password")
    public ApiResponse<AdminResetPasswordResponse> resetPassword(@PathVariable UUID publicId) {
        return ApiResponse.ok(adminUserService.resetPasswordResponse(publicId));
    }

    @Operation(summary = "Kullaniciyi sil (soft delete)")
    @DeleteMapping("/{publicId}")
    public ApiResponse<Void> deleteUser(@PathVariable UUID publicId, Authentication auth) {
        adminUserService.deleteUser(publicId, auth.getName());
        return ApiResponse.message("Kullanici silindi");
    }
}