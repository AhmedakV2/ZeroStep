// src/main/java/com/ahmedv2/zerostep/announcement/controller/AnnouncementController.java
package com.ahmedv2.zerostep.announcement.controller;

import com.ahmedv2.zerostep.announcement.dto.AnnouncementResponse;
import com.ahmedv2.zerostep.announcement.service.AnnouncementService;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/announcements")
@RequiredArgsConstructor
@Tag(name = "Announcements", description = "Kullaniciya yonelik duyurular")
@SecurityRequirement(name = "bearerAuth")
public class AnnouncementController {

    private final AnnouncementService announcementService;
    private final UserRepository userRepository;

    @Operation(summary = "Bana gorunur aktif duyurular")
    @GetMapping
    public ApiResponse<List<AnnouncementResponse>> listVisible(Authentication auth) {
        Long userId = resolveUserId(auth);
        Set<String> roles = extractRoles(auth);
        return ApiResponse.ok(announcementService.listVisible(userId, roles));
    }

    @Operation(summary = "Duyuruyu kapat; bir daha gosterilmez")
    @PostMapping("/{publicId}/dismiss")
    public ApiResponse<Void> dismiss(@PathVariable UUID publicId, Authentication auth) {
        announcementService.dismiss(publicId, resolveUserId(auth));
        return ApiResponse.message("Duyuru kapatildi");
    }

    private Long resolveUserId(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResourceNotFoundException("User", auth.getName()))
                .getId();
    }

    private Set<String> extractRoles(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }
}