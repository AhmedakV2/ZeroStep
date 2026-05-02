// src/main/java/com/ahmedv2/zerostep/announcement/controller/AdminAnnouncementController.java
package com.ahmedv2.zerostep.announcement.controller;

import com.ahmedv2.zerostep.announcement.dto.*;
import com.ahmedv2.zerostep.announcement.service.AnnouncementService;
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

@RestController
@RequestMapping("/api/v1/admin/announcements")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin - Announcements", description = "Sistem duyuru yonetimi")
@SecurityRequirement(name = "bearerAuth")
public class AdminAnnouncementController {

    private final AnnouncementService announcementService;

    @Operation(summary = "Duyuru olustur (taslak; yayinlanmaz)")
    @PostMapping
    public ResponseEntity<ApiResponse<AnnouncementResponse>> create(
            @Valid @RequestBody AnnouncementCreateRequest request,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(announcementService.create(request, auth.getName())));
    }

    @Operation(summary = "Tum duyurulari listele")
    @GetMapping
    public ApiResponse<Page<AnnouncementResponse>> list(
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(announcementService.adminList(pageable));
    }

    @Operation(summary = "Duyuru guncelle (sadece taslak)")
    @PutMapping("/{publicId}")
    public ApiResponse<AnnouncementResponse> update(
            @PathVariable UUID publicId,
            @Valid @RequestBody AnnouncementUpdateRequest request) {
        return ApiResponse.ok(announcementService.update(publicId, request));
    }

    @Operation(summary = "Duyuruyu yayinla; hedef kullanicilara bildirim + WebSocket broadcast")
    @PostMapping("/{publicId}/publish")
    public ApiResponse<AnnouncementResponse> publish(@PathVariable UUID publicId) {
        return ApiResponse.ok(announcementService.publish(publicId));
    }

    @Operation(summary = "Duyuruyu sil (sadece taslak)")
    @DeleteMapping("/{publicId}")
    public ApiResponse<Void> delete(@PathVariable UUID publicId) {
        announcementService.delete(publicId);
        return ApiResponse.message("Duyuru silindi");
    }
}