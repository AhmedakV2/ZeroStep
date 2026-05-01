package com.ahmedv2.zerostep.schedule.controller;

import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.execution.dto.ExecutionResponse;
import com.ahmedv2.zerostep.execution.dto.ExecutionStartRequest;
import com.ahmedv2.zerostep.execution.service.ExecutionService;
import com.ahmedv2.zerostep.schedule.dto.*;
import com.ahmedv2.zerostep.schedule.service.ScheduleService;
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
@RequestMapping("/api/v1/schedules")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Schedules", description = "Periyodik senaryo çalıştırma")
@SecurityRequirement(name = "bearerAuth")
public class ScheduleController {

    private final ScheduleService scheduleService;
    private final ExecutionService executionService;

    @Operation(summary = "Senaryoya schedule ekle")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @PostMapping("/scenarios/{scenarioPublicId}")
    public ResponseEntity<ApiResponse<ScheduleResponse>> create(
            @PathVariable UUID scenarioPublicId,
            @Valid @RequestBody ScheduleCreateRequest request,
            Authentication auth) {
        ScheduleResponse response = scheduleService.create(
                scenarioPublicId, request, auth.getName(), extractRoles(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @Operation(summary = "Kendi schedule'larını listele")
    @GetMapping
    public ApiResponse<Page<ScheduleResponse>> listMine(
            @PageableDefault(size = 20) Pageable pageable,
            Authentication auth) {
        return ApiResponse.ok(scheduleService.listMine(auth.getName(), pageable));
    }

    @Operation(summary = "Schedule detayı")
    @GetMapping("/{publicId}")
    public ApiResponse<ScheduleResponse> getOne(@PathVariable UUID publicId, Authentication auth) {
        return ApiResponse.ok(scheduleService.getOne(publicId, auth.getName(), extractRoles(auth)));
    }

    @Operation(summary = "Schedule güncelle")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @PutMapping("/{publicId}")
    public ApiResponse<ScheduleResponse> update(
            @PathVariable UUID publicId,
            @Valid @RequestBody ScheduleUpdateRequest request,
            Authentication auth) {
        return ApiResponse.ok(scheduleService.update(publicId, request, auth.getName(), extractRoles(auth)));
    }

    @Operation(summary = "Schedule sil")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @DeleteMapping("/{publicId}")
    public ApiResponse<Void> delete(@PathVariable UUID publicId, Authentication auth) {
        scheduleService.delete(publicId, auth.getName(), extractRoles(auth));
        return ApiResponse.message("Schedule silindi");
    }

    @Operation(summary = "Schedule'ı etkinleştir")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @PostMapping("/{publicId}/enable")
    public ApiResponse<ScheduleResponse> enable(@PathVariable UUID publicId, Authentication auth) {
        return ApiResponse.ok(scheduleService.setEnabled(publicId, true, auth.getName(), extractRoles(auth)));
    }

    @Operation(summary = "Schedule'ı devre dışı bırak")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @PostMapping("/{publicId}/disable")
    public ApiResponse<ScheduleResponse> disable(@PathVariable UUID publicId, Authentication auth) {
        return ApiResponse.ok(scheduleService.setEnabled(publicId, false, auth.getName(), extractRoles(auth)));
    }

    @Operation(summary = "Schedule'ı manuel tetikle (test amaçlı)")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @PostMapping("/{publicId}/trigger-now")
    public ResponseEntity<ApiResponse<ExecutionResponse>> triggerNow(
            @PathVariable UUID publicId,
            Authentication auth) {
        // Schedule'ı bul → senaryosunu al → normal execution başlat
        ScheduleResponse schedule = scheduleService.getOne(publicId, auth.getName(), extractRoles(auth));
        ExecutionResponse execution = executionService.startExecution(
                schedule.scenarioPublicId(),
                new ExecutionStartRequest(null, null),
                auth.getName(),
                extractRoles(auth));
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.ok(execution));
    }

    private Set<String> extractRoles(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }
}