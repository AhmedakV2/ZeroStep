package com.ahmedv2.zerostep.scenario.controller;

import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.scenario.dto.ScenarioCreateRequest;
import com.ahmedv2.zerostep.scenario.dto.ScenarioResponse;
import com.ahmedv2.zerostep.scenario.dto.ScenarioStatusRequest;
import com.ahmedv2.zerostep.scenario.dto.ScenarioUpdateRequest;
import com.ahmedv2.zerostep.scenario.entity.ScenarioStatus;
import com.ahmedv2.zerostep.scenario.service.ScenarioService;
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
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/scenarios")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name="Scenarios",description = "Test senaryoleri yonetimi")
@SecurityRequirement(name = "bearerAuth")
public class ScenarioController {

    private final ScenarioService scenarioService;

    @Operation(summary = "Senaryo listele (paqination + searc + status filter)")
    @GetMapping
    public ApiResponse<Page<ScenarioResponse>> listScenario(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ScenarioStatus status,
            @PageableDefault(size = 20,sort = "id") Pageable pegeable,
    Authentication auth) {
        return ApiResponse.ok(scenarioService.listScenarios(
                auth.getName(), extractRoles(auth), search, status ,pegeable));
    }

    @Operation(summary = "Tek senaryo detayi")
    @GetMapping("/{publicId}")
    public ApiResponse<ScenarioResponse> getScenario(@PathVariable UUID publicId,Authentication auth){
        return ApiResponse.ok(scenarioService.getScenario(publicId,auth.getName(), extractRoles(auth)));
    }

    @Operation(summary = "Yeni senaryo olustur (TESTER veya ADMIN)")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @PostMapping
    public ResponseEntity<ApiResponse<ScenarioResponse>> createScenario(
            @Valid @RequestBody ScenarioCreateRequest request,
            Authentication auth){
        ScenarioResponse response = scenarioService.createScenario(request, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));

    }

    @Operation(summary = "Senaryo guncelle (owner veya ADMIN)")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @PatchMapping("/{publicId}")
    public ApiResponse<ScenarioResponse> updateScenario(
            @PathVariable UUID publicId,
            @Valid @RequestBody ScenarioUpdateRequest request,
            Authentication auth){
        return ApiResponse.ok(scenarioService.updateScenario(
                publicId,request,auth.getName(),extractRoles(auth)));
    }


    @Operation(summary = "Senaryo durum degistir (DRAFT/READY/ARCHIVED)")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @PatchMapping("/{publicId}/status")
    public ApiResponse<ScenarioResponse> changeStatus(
            @PathVariable UUID publicId,
            @Valid @RequestBody ScenarioStatusRequest request,
            Authentication auth){
        return ApiResponse.ok(scenarioService.changeStatus(
                publicId,request.status(),auth.getName(),extractRoles(auth)));
    }

    @Operation(summary = "Senaryo sil (owner veya ADMIN; soft delete)")
    @PreAuthorize("hasAnyRole('TESTER', 'ADMIN')")
    @DeleteMapping("/{publicId}")
    public ApiResponse<Void> deleteScenario(@PathVariable UUID publicId, Authentication auth) {
        scenarioService.deleteScenario(publicId, auth.getName(), extractRoles(auth));
        return ApiResponse.message("Senaryo silindi");
    }

    private Set<String> extractRoles(Authentication auth){
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }

}
