package com.ahmedv2.zerostep.notification.controller;

import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.notification.dto.*;
import com.ahmedv2.zerostep.notification.service.NotificationService;
import com.ahmedv2.zerostep.user.repository.UserRepository;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "Kullanici bildirimleri")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @Operation(summary = "Kendi bildirimlerini listele (pagination)")
    @GetMapping
    public ApiResponse<Page<NotificationResponse>> list(
            @PageableDefault(size = 20) Pageable pageable,
            Authentication auth) {
        return ApiResponse.ok(notificationService.list(resolveUserId(auth), pageable));
    }

    @Operation(summary = "Okunmamis bildirim sayisi")
    @GetMapping("/unread-count")
    public ApiResponse<UnreadCountResponse> unreadCount(Authentication auth) {
        return ApiResponse.ok(notificationService.unreadCount(resolveUserId(auth)));
    }

    @Operation(summary = "Bildirimi okunmus yap")
    @PostMapping("/{publicId}/read")
    public ApiResponse<NotificationResponse> markRead(@PathVariable UUID publicId,
                                                      Authentication auth) {
        return ApiResponse.ok(notificationService.markRead(publicId, resolveUserId(auth)));
    }

    @Operation(summary = "Tum bildirimleri okunmus yap")
    @PostMapping("/read-all")
    public ApiResponse<Void> readAll(Authentication auth) {
        notificationService.markAllRead(resolveUserId(auth));
        return ApiResponse.message("Tum bildirimler okundu olarak isaretlendi");
    }

    @Operation(summary = "Bildirimi sil")
    @DeleteMapping("/{publicId}")
    public ApiResponse<Void> delete(@PathVariable UUID publicId, Authentication auth) {
        notificationService.delete(publicId, resolveUserId(auth));
        return ApiResponse.message("Bildirim silindi");
    }

    @Operation(summary = "Bildirim tercihlerini getir (tum tipler, eksikler default ile doner)")
    @GetMapping("/preferences")
    public ApiResponse<List<NotificationPreferenceResponse>> getPreferences(Authentication auth) {
        return ApiResponse.ok(notificationService.getPreferences(resolveUserId(auth)));
    }

    @Operation(summary = "Bildirim tercihini guncelle veya olustur")
    @PutMapping("/preferences")
    public ApiResponse<NotificationPreferenceResponse> updatePreference(
            @Valid @RequestBody PreferenceUpdateRequest request,
            Authentication auth) {
        return ApiResponse.ok(notificationService.updatePreference(resolveUserId(auth), request));
    }

    // Username -> userId donusumu; JWT filter principal'ini username olarak set ediyor
    private Long resolveUserId(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResourceNotFoundException("User", auth.getName()))
                .getId();
    }
}