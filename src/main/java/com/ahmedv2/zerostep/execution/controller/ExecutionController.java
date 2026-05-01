package com.ahmedv2.zerostep.execution.controller;

import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.execution.dto.*;
import com.ahmedv2.zerostep.execution.repository.ExecutionRepository;
import com.ahmedv2.zerostep.execution.repository.ExecutionStepResultRepository;
import com.ahmedv2.zerostep.execution.service.ExecutionService;
import com.ahmedv2.zerostep.execution.sse.SseEventBroadcaster;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Executions", description = "Senaryo calistirmalari")
@SecurityRequirement(name = "bearerAuth")
@Slf4j
public class ExecutionController {

    // SSE timeout; 30 dakika (uzun senaryolar icin yeterli)
    private static final long SSE_TIMEOUT_MS = 30 * 60 * 1000L;

    private final ExecutionService executionService;
    private final ExecutionRepository executionRepository;
    private final ExecutionStepResultRepository stepResultRepository;
    private final SseEventBroadcaster sseBroadcaster;

    @Operation(summary = "Senaryoyu calistir; async kuyruga alinir")
    @PreAuthorize("hasAnyRole('TESTER', 'ADMIN')")
    @PostMapping("/scenarios/{scenarioPublicId}/execute")
    public ResponseEntity<ApiResponse<ExecutionResponse>> startExecution(
            @PathVariable UUID scenarioPublicId,
            @Valid @RequestBody(required = false) ExecutionStartRequest request,
            Authentication auth) {
        ExecutionResponse response = executionService.startExecution(
                scenarioPublicId,
                request != null ? request : new ExecutionStartRequest(null, null),
                auth.getName(),
                extractRoles(auth));
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.ok(response));
    }

    @Operation(summary = "Execution detayi")
    @GetMapping("/executions/{publicId}")
    public ApiResponse<ExecutionResponse> getExecution(@PathVariable UUID publicId,
                                                       Authentication auth) {
        return ApiResponse.ok(executionService.getExecution(publicId, auth.getName(),
                extractRoles(auth)));
    }

    @Operation(summary = "Execution adim sonuclari")
    @GetMapping("/executions/{publicId}/steps")
    public ApiResponse<List<ExecutionStepResultResponse>> getStepResults(
            @PathVariable UUID publicId, Authentication auth) {
        return ApiResponse.ok(executionService.getStepResults(publicId, auth.getName(),
                extractRoles(auth)));
    }

    @Operation(summary = "Execution log'lari (pagination)")
    @GetMapping("/executions/{publicId}/logs")
    public ApiResponse<Page<ExecutionLogResponse>> getLogs(
            @PathVariable UUID publicId,
            @PageableDefault(size = 100, sort = "occurredAt") Pageable pageable,
            Authentication auth) {
        return ApiResponse.ok(executionService.getLogs(publicId, auth.getName(),
                extractRoles(auth), pageable));
    }

    @Operation(summary = "Senaryonun execution gecmisi")
    @GetMapping("/scenarios/{scenarioPublicId}/executions")
    public ApiResponse<Page<ExecutionResponse>> listByScenario(
            @PathVariable UUID scenarioPublicId,
            @PageableDefault(size = 20, sort = "queuedAt") Pageable pageable,
            Authentication auth) {
        return ApiResponse.ok(executionService.listByScenario(scenarioPublicId,
                auth.getName(), extractRoles(auth), pageable));
    }

    @Operation(summary = "Execution iptal et")
    @PreAuthorize("hasAnyRole('TESTER', 'ADMIN')")
    @PostMapping("/executions/{publicId}/cancel")
    public ApiResponse<ExecutionResponse> cancelExecution(@PathVariable UUID publicId,
                                                          Authentication auth) {
        return ApiResponse.ok(executionService.cancelExecution(publicId, auth.getName(),
                extractRoles(auth)));
    }

    // ============================================================
    // Faz 5C/1: SSE Live Log Stream
    // ============================================================
    @Operation(summary = "Canli log akisi (SSE); browser EventSource ile dinler")
    @GetMapping(value = "/executions/{publicId}/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamLogs(@PathVariable UUID publicId, Authentication auth) {
        // Authorization: kullanicinin bu execution'i goruntuleme yetkisi var mi?
        // ExecutionService.getExecution zaten check ediyor; cagirip throw bekleyelim
        executionService.getExecution(publicId, auth.getName(), extractRoles(auth));

        // Long-id'yi service uzerinden bul
        Long execId = executionRepository.findByPublicIdWithScenario(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", publicId))
                .getId();

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);

        // Acilis event'i; client connection'i hemen onaylar
        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(java.util.Map.of("executionId", publicId.toString())));
        } catch (Exception e) {
            log.warn("SSE acilis event'i gonderilemedi: {}", e.getMessage());
        }

        return sseBroadcaster.subscribe(execId, emitter);
    }

    // ============================================================
    // Faz 5C/1: Screenshot indir
    // ============================================================
    @Operation(summary = "Belirli bir step result'in screenshot'ini doner (PNG)")
    @GetMapping("/executions/{publicId}/screenshots/{stepResultId}")
    public ResponseEntity<Resource> getScreenshot(@PathVariable UUID publicId,
                                                  @PathVariable Long stepResultId,
                                                  Authentication auth) {
        // Authorization
        executionService.getExecution(publicId, auth.getName(), extractRoles(auth));

        var stepResult = stepResultRepository.findById(stepResultId)
                .orElseThrow(() -> new ResourceNotFoundException("StepResult", stepResultId));

        // StepResult bu execution'a ait mi? (yetki bypass'ini engelle)
        if (!stepResult.getExecution().getPublicId().equals(publicId)) {
            throw new ResourceNotFoundException("StepResult", stepResultId);
        }

        String path = stepResult.getScreenshotPath();
        if (path == null || path.isBlank()) {
            return ResponseEntity.notFound().build();
        }

        Path filePath = Paths.get(path);
        File file = filePath.toFile();
        if (!file.exists() || !file.isFile()) {
            log.warn("Screenshot dosyasi diskte yok: {}", path);
            return ResponseEntity.notFound().build();
        }

        try {
            byte[] bytes = FileUtils.readFileToByteArray(file);
            ByteArrayResource resource = new ByteArrayResource(bytes);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + file.getName() + "\"")
                    .contentType(MediaType.IMAGE_PNG)
                    .contentLength(bytes.length)
                    .body(resource);
        } catch (Exception e) {
            log.error("Screenshot okunamadi: {}", path, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    private Set<String> extractRoles(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }
}