package com.ahmedv2.zerostep.admin.controller;

import com.ahmedv2.zerostep.admin.dto.RoleResponse;
import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.user.repository.RoleRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/roles")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name="Adim - Roles", description = "Sistem rolleri")
@SecurityRequirement(name = "bearerAuth")
public class AdminRoleController {

    private final RoleRepository roleRepository;

    @Operation(summary = "Sistemdeki tüm rolleri listele")
    @GetMapping
    public ApiResponse<List<RoleResponse>> listRoles(){
        List<RoleResponse> roles = roleRepository.findAll().stream()
                .map(r -> new RoleResponse(r.getId(),r.getName(),r.getDescription()))
                .toList();
        return ApiResponse.ok(roles);
    }
}
