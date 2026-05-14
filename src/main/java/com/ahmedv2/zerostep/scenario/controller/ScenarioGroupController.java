package com.ahmedv2.zerostep.scenario.controller;

import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.scenario.dto.ScenarioGroupCreateRequest;
import com.ahmedv2.zerostep.scenario.dto.ScenarioGroupResponse;
import com.ahmedv2.zerostep.scenario.service.ScenarioGroupService;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.service.UserService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/scenario-groups")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Scenario Groups", description = "Senaryo gruplari (moduller)")
@SecurityRequirement(name = "bearerAuth")
public class ScenarioGroupController {

    private final ScenarioGroupService groupService;
    private final UserService userService;

    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @PostMapping
    public ApiResponse<ScenarioGroupResponse> createGroup(
            @Valid @RequestBody ScenarioGroupCreateRequest request,
            Authentication auth) {
        User owner = userService.findByUsername(auth.getName());
        ScenarioGroupResponse response = groupService.createGroup(request, owner);
        return ApiResponse.ok(response, "Modül başarıyla oluşturuldu");
    }

    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @GetMapping
    public ApiResponse<Page<ScenarioGroupResponse>> getGroups(
            @RequestParam(required = false) String search,
            Pageable pageable,
            Authentication auth) {
        User requester = userService.findByUsername(auth.getName());
        Page<ScenarioGroupResponse> groups = groupService.getGroups(requester, search, pageable);
        return ApiResponse.ok(groups, "Modüller listelendi");
    }

    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    @DeleteMapping("/{publicId}")
    public ApiResponse<Void> deleteGroup(
            @PathVariable UUID publicId,
            Authentication auth) {
        User requester = userService.findByUsername(auth.getName());
        groupService.deleteGroup(publicId, requester);
        return ApiResponse.message("Modül başarıyla silindi");
    }
}