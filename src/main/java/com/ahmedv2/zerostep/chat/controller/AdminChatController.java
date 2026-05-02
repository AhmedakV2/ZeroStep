// src/main/java/com/ahmedv2/zerostep/chat/controller/AdminChatController.java
package com.ahmedv2.zerostep.chat.controller;

import com.ahmedv2.zerostep.chat.dto.AdminConversationResponse;
import com.ahmedv2.zerostep.chat.dto.MessageResponse;
import com.ahmedv2.zerostep.chat.service.ChatService;
import com.ahmedv2.zerostep.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/chat")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin - Chat", description = "Konusma compliance goruntuleme")
@SecurityRequirement(name = "bearerAuth")
public class AdminChatController {

    private final ChatService chatService;

    @Operation(summary = "Tum konusmalar (username ile arama destekli)")
    @GetMapping("/conversations")
    public ApiResponse<Page<AdminConversationResponse>> listConversations(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(chatService.adminListConversations(search, pageable));
    }

    @Operation(summary = "Konusmanin tum mesajlari; silinmisler dahil, admin icerigi gorur")
    @GetMapping("/conversations/{publicId}/messages")
    public ApiResponse<Page<MessageResponse>> getMessages(
            @PathVariable UUID publicId,
            @PageableDefault(size = 50) Pageable pageable) {
        return ApiResponse.ok(chatService.adminGetMessages(publicId, pageable));
    }
}