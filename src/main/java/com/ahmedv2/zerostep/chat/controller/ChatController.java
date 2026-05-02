// src/main/java/com/ahmedv2/zerostep/chat/controller/ChatController.java
package com.ahmedv2.zerostep.chat.controller;

import com.ahmedv2.zerostep.chat.dto.*;
import com.ahmedv2.zerostep.chat.service.ChatService;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.user.repository.UserRepository;
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
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Chat", description = "1-1 mesajlasma")
@SecurityRequirement(name = "bearerAuth")
public class ChatController {

    private final ChatService chatService;
    private final UserRepository userRepository;

    @Operation(summary = "Konuşma listesi (son mesaja göre sıralı)")
    @GetMapping("/conversations")
    public ApiResponse<Page<ConversationResponse>> listConversations(
            @PageableDefault(size = 20) Pageable pageable,
            Authentication auth) {
        return ApiResponse.ok(chatService.listConversations(resolveUserId(auth), pageable));
    }

    @Operation(summary = "Yeni konuşma başlat veya mevcut olanı getir")
    @PostMapping("/conversations")
    public ResponseEntity<ApiResponse<ConversationResponse>> startConversation(
            @Valid @RequestBody StartConversationRequest request,
            Authentication auth) {
        ConversationResponse response = chatService.startConversation(
                request.targetUserPublicId(), resolveUserId(auth));
        return ResponseEntity.status(HttpStatus.OK).body(ApiResponse.ok(response));
    }

    @Operation(summary = "Konuşmanın mesajları (eski → yeni, pagination)")
    @GetMapping("/conversations/{publicId}/messages")
    public ApiResponse<Page<MessageResponse>> getMessages(
            @PathVariable UUID publicId,
            @PageableDefault(size = 50, sort = "sentAt") Pageable pageable,
            Authentication auth) {
        return ApiResponse.ok(chatService.getMessages(publicId, resolveUserId(auth), pageable));
    }

    @Operation(summary = "Mesaj gönder")
    @PostMapping("/conversations/{publicId}/messages")
    public ResponseEntity<ApiResponse<MessageResponse>> sendMessage(
            @PathVariable UUID publicId,
            @Valid @RequestBody SendMessageRequest request,
            Authentication auth) {
        MessageResponse response = chatService.sendMessage(
                publicId, request.content(), resolveUserId(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @Operation(summary = "Okunmamış mesaj sayısı")
    @GetMapping("/unread-count")
    public ApiResponse<UnreadMessageCountResponse> unreadCount(Authentication auth) {
        return ApiResponse.ok(chatService.unreadCount(resolveUserId(auth)));
    }

    @Operation(summary = "Tek mesajı okundu yap")
    @PostMapping("/messages/{publicId}/read")
    public ApiResponse<MessageResponse> markRead(
            @PathVariable UUID publicId,
            Authentication auth) {
        return ApiResponse.ok(chatService.markRead(publicId, resolveUserId(auth)));
    }

    @Operation(summary = "Mesajı sil (soft; sadece kendi mesajın)")
    @DeleteMapping("/messages/{publicId}")
    public ApiResponse<Void> deleteMessage(
            @PathVariable UUID publicId,
            Authentication auth) {
        chatService.deleteMessage(publicId, resolveUserId(auth));
        return ApiResponse.message("Mesaj silindi");
    }

    private Long resolveUserId(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResourceNotFoundException("User", auth.getName()))
                .getId();
    }
}