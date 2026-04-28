package com.ahmedv2.zerostep.step.controller;

import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.step.dto.ActionMetadataResponse;
import com.ahmedv2.zerostep.step.dto.TestStepCreateRequest;
import com.ahmedv2.zerostep.step.dto.TestStepReorderRequest;
import com.ahmedv2.zerostep.step.dto.TestStepResponse;
import com.ahmedv2.zerostep.step.dto.TestStepUpdateRequest;
import com.ahmedv2.zerostep.step.service.ActionMetadataRegistry;
import com.ahmedv2.zerostep.step.service.TestStepService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Test Steps", description = "Senaryo adimlari yonetimi")
@SecurityRequirement(name = "bearerAuth")
public class TestStepController {

    private final TestStepService stepService;
    private final ActionMetadataRegistry metadataRegistry;

    @Operation(summary = "Tum action tiplerinin metadatasi (frontend dinamik form icin)")
    @GetMapping("/steps/action-metadata")
    public ApiResponse<List<ActionMetadataResponse>> listActionMetadata() {
        return ApiResponse.ok(metadataRegistry.listAll());
    }

    @Operation(summary = "Senaryonun tum adimlarini sirali listele")
    @GetMapping("/scenarios/{scenarioPublicId}/steps")
    public ApiResponse<List<TestStepResponse>> listSteps(@PathVariable UUID scenarioPublicId,
                                                         Authentication auth) {
        return ApiResponse.ok(stepService.listSteps(scenarioPublicId, auth.getName(), extractRoles(auth)));
    }

    @Operation(summary = "Tek adim detayi")
    @GetMapping("/steps/{stepPublicId}")
    public ApiResponse<TestStepResponse> getStep(@PathVariable UUID stepPublicId, Authentication auth) {
        return ApiResponse.ok(stepService.getStep(stepPublicId, auth.getName(), extractRoles(auth)));
    }

    @Operation(summary = "Yeni adim ekle (TESTER veya ADMIN)")
    @PreAuthorize("hasAnyRole('TESTER', 'ADMIN')")
    @PostMapping("/scenarios/{scenarioPublicId}/steps")
    public ResponseEntity<ApiResponse<TestStepResponse>> createStep(
            @PathVariable UUID scenarioPublicId,
            @Valid @RequestBody TestStepCreateRequest request,
            Authentication auth) {
        TestStepResponse response = stepService.createStep(
                scenarioPublicId, request, auth.getName(), extractRoles(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @Operation(summary = "Adim guncelle (partial)")
    @PreAuthorize("hasAnyRole('TESTER', 'ADMIN')")
    @PatchMapping("/steps/{stepPublicId}")
    public ApiResponse<TestStepResponse> updateStep(
            @PathVariable UUID stepPublicId,
            @Valid @RequestBody TestStepUpdateRequest request,
            Authentication auth) {
        return ApiResponse.ok(stepService.updateStep(
                stepPublicId, request, auth.getName(), extractRoles(auth)));
    }

    @Operation(summary = "Adimi yeniden konumlandir (drag-drop)")
    @PreAuthorize("hasAnyRole('TESTER', 'ADMIN')")
    @PatchMapping("/steps/{stepPublicId}/reorder")
    public ApiResponse<TestStepResponse> reorderStep(
            @PathVariable UUID stepPublicId,
            @Valid @RequestBody TestStepReorderRequest request,
            Authentication auth) {
        return ApiResponse.ok(stepService.reorderStep(
                stepPublicId, request, auth.getName(), extractRoles(auth)));
    }

    @Operation(summary = "Adimi kopyala")
    @PreAuthorize("hasAnyRole('TESTER', 'ADMIN')")
    @PostMapping("/steps/{stepPublicId}/duplicate")
    public ResponseEntity<ApiResponse<TestStepResponse>> duplicateStep(
            @PathVariable UUID stepPublicId, Authentication auth) {
        TestStepResponse response = stepService.duplicateStep(
                stepPublicId, auth.getName(), extractRoles(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @Operation(summary = "Adimi sil (soft delete)")
    @PreAuthorize("hasAnyRole('TESTER', 'ADMIN')")
    @DeleteMapping("/steps/{stepPublicId}")
    public ApiResponse<Void> deleteStep(@PathVariable UUID stepPublicId, Authentication auth) {
        stepService.deleteStep(stepPublicId, auth.getName(), extractRoles(auth));
        return ApiResponse.message("Adim silindi");
    }

    private Set<String> extractRoles(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }
}