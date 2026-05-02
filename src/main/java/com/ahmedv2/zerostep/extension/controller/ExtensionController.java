package com.ahmedv2.zerostep.extension.controller;

import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.extension.dto.BatchStepRequest;
import com.ahmedv2.zerostep.extension.dto.BatchStepResponse;
import com.ahmedv2.zerostep.extension.dto.ExtensionScenarioCreateRequest;
import com.ahmedv2.zerostep.extension.service.ExtensionStepService;
import com.ahmedv2.zerostep.scenario.dto.ScenarioResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

// X-AFT-Token veya Bearer JWT ile erişilebilir
// ExtensionTokenAuthenticationFilter bu path'i yakalar
@RestController
@RequestMapping("/api/v1/extension")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Extension - Batch", description = "Chrome Extension senaryo ve step yonetimi")
public class ExtensionController {

    private final ExtensionStepService extensionStepService;

    @Operation(summary = "Extension adina senaryo olustur (DRAFT, default browser config)")
    @PostMapping("/scenarios")
    public ResponseEntity<ApiResponse<ScenarioResponse>> createScenario(
            @Valid @RequestBody ExtensionScenarioCreateRequest request,
            Authentication auth) {
        ScenarioResponse response = extensionStepService.createScenario(request, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @Operation(summary = "Senaryoya toplu step ekle; max 200 step / request; description bos gelirse auto-generate edilir")
    @PostMapping("/scenarios/{scenarioPublicId}/steps/batch")
    public ResponseEntity<ApiResponse<BatchStepResponse>> batchAddSteps(
            @PathVariable UUID scenarioPublicId,
            @Valid @RequestBody BatchStepRequest request,
            Authentication auth) {
        BatchStepResponse response = extensionStepService.batchAddSteps(
                scenarioPublicId, request, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }
}