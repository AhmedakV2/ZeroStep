package com.ahmedv2.zerostep.user.controller;

import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.user.dto.ChangePasswordRequest;
import com.ahmedv2.zerostep.user.dto.UserResponse;
import com.ahmedv2.zerostep.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "Kullanici profili")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    @Operation(summary = "Mevcut kullanicinin profilini getir")
    @GetMapping("/me")
    public ApiResponse<UserResponse> getMyProfile(Authentication authentication) {
        UserResponse response = userService.getCurrentUser(authentication.getName());
        return ApiResponse.ok(response);
    }

    @Operation(summary = "Sifre degistir; sonrasinda tum oturumlar kapanir, yeniden login gerekir")
    @PostMapping("/me/change-password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                            Authentication authentication) {
        userService.changePassword(authentication.getName(), request);
        return ApiResponse.message("Sifre basariyla degistirildi. Lutfen yeniden giris yapin.");
    }
}