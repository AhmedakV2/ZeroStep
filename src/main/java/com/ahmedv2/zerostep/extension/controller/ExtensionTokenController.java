package com.ahmedv2.zerostep.extension.controller;

import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.extension.dto.TokenCreateRequest;
import com.ahmedv2.zerostep.extension.dto.TokenResponse;
import com.ahmedv2.zerostep.extension.service.ExtensionTokenService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/extension/tokens")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Extension - Tokens", description = "Chrome Extension API token yönetimi")
@SecurityRequirement(name = "bearerAuth")
public class ExtensionTokenController {

    private final ExtensionTokenService tokenService;

    @Operation(summary = "Yeni extension token olustur; plainToken sadece bu response'da gorunur")
    @PostMapping
    public ResponseEntity<ApiResponse<TokenResponse>> create(
            @Valid @RequestBody TokenCreateRequest request,
            Authentication auth) {
        TokenResponse response = tokenService.create(auth.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @Operation(summary = "Kendi aktif tokenlarini listele (plainToken null)")
    @GetMapping
    public ApiResponse<List<TokenResponse>> list(Authentication auth) {
        return ApiResponse.ok(tokenService.list(auth.getName()));
    }

    @Operation(summary = "Token'i revoke et; sonrasinda 401 doner")
    @DeleteMapping("/{publicId}")
    public ApiResponse<Void> revoke(@PathVariable UUID publicId, Authentication auth) {
        tokenService.revoke(auth.getName(), publicId);
        return ApiResponse.message("Token revoke edildi");
    }
}