package com.ahmedv2.zerostep.admin.controller;

import com.ahmedv2.zerostep.admin.dto.AdminAuditResponse;
import com.ahmedv2.zerostep.audit.entity.AuditEvent;
import com.ahmedv2.zerostep.audit.repository.AuditEventRepository;
import com.ahmedv2.zerostep.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/audit")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin - Audit", description = "Admin denetim günlüğü yönetimi")
@SecurityRequirement(name = "bearerAuth")
public class AdminAuditController {

    private final AuditEventRepository auditEventRepository;

    @Operation(summary = "Denetim günlüklerini (Audit) listele")
    @GetMapping
    public ApiResponse<Page<AdminAuditResponse>> listAuditLogs(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String action, // Frontend'den 'action' olarak geliyor
            @PageableDefault(size = 15, sort = "occurredAt", direction = Sort.Direction.DESC) Pageable pageable) {

        Page<AuditEvent> events;

        if (search != null && !search.isBlank()) {
            events = auditEventRepository.findByActorNameContainingIgnoreCaseOrderByOccurredAtDesc(search, pageable);
        } else if (action != null && !action.isBlank()) {
            // 'action' parametresini 'eventType' sütununda arıyoruz
            events = auditEventRepository.findByEventTypeOrderByOccurredAtDesc(action, pageable);
        } else {
            events = auditEventRepository.findByOrderByOccurredAtDesc(pageable);
        }

        // Entity -> DTO Dönüşümü
        Page<AdminAuditResponse> responsePage = events.map(event -> {
            AdminAuditResponse dto = new AdminAuditResponse();
            dto.setTimestamp(event.getOccurredAt());
            dto.setUsername(event.getActorName());
            dto.setAction(event.getEventType());

            // Resource Name'i birleştiriyoruz (örn: USER-15)
            String resource = event.getEntityType();
            if (resource != null && event.getEntityId() != null) {
                resource += " (ID: " + event.getEntityId() + ")";
            }
            dto.setResourceName(resource);
            dto.setIpAddress(event.getIpAddress());

            // Eğer veritabanına özel bir statü kaydetmiyorsanız şimdilik her şey başarılı varsayılır
            dto.setStatus("SUCCESS");
            dto.setDetails(event.getPayload());

            return dto;
        });

        return ApiResponse.ok(responsePage);
    }
}