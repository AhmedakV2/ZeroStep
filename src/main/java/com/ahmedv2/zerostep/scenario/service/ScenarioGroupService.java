package com.ahmedv2.zerostep.scenario.service;

import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.scenario.dto.ScenarioGroupCreateRequest;
import com.ahmedv2.zerostep.scenario.dto.ScenarioGroupResponse;
import com.ahmedv2.zerostep.scenario.entity.Scenario;
import com.ahmedv2.zerostep.scenario.entity.ScenarioGroup;
import com.ahmedv2.zerostep.scenario.entity.ScenarioStatus;
import com.ahmedv2.zerostep.scenario.repository.ScenarioGroupRepository;
import com.ahmedv2.zerostep.scenario.repository.ScenarioRepository;
import com.ahmedv2.zerostep.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ScenarioGroupService {

    private final ScenarioGroupRepository groupRepository;
    private final ScenarioRepository scenarioRepository;

    @Transactional
    public ScenarioGroupResponse createGroup(ScenarioGroupCreateRequest request, User owner) {
        ScenarioGroup group = new ScenarioGroup();
        group.setName(request.getName());
        group.setDescription(request.getDescription());
        group.setOwner(owner);

        group = groupRepository.save(group);
        return mapToResponse(group, List.of()); // Yeni grubun senaryosu olmaz
    }

    @Transactional(readOnly = true)
    public Page<ScenarioGroupResponse> getGroups(User requester, String search, Pageable pageable) {
        boolean isAdmin = requester.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getName()));
        Page<ScenarioGroup> groups;
        if (search != null && !search.trim().isEmpty()) {
            groups = isAdmin
                    ? groupRepository.findByNameContainingIgnoreCaseAndDeletedAtIsNull(search, pageable)
                    : groupRepository.findByOwnerIdAndNameContainingIgnoreCaseAndDeletedAtIsNull(requester.getId(), search, pageable);
        } else {
            groups = isAdmin
                    ? groupRepository.findByDeletedAtIsNull(pageable)
                    : groupRepository.findByOwnerIdAndDeletedAtIsNull(requester.getId(), pageable);
        }

        return groups.map(group -> {
            List<Scenario> scenarios = scenarioRepository
                    .findByGroupIdAndOwnerIdAndDeletedAtIsNull(group.getId(), group.getOwner().getId(), Pageable.unpaged())
                    .getContent();
            return mapToResponse(group, scenarios);
        });
    }

    @Transactional(readOnly = true)
    public ScenarioGroup getGroupByPublicId(UUID publicId) {
        return groupRepository.findByPublicId(publicId)
                .filter(g -> g.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Modül/Grup bulunamadı"));
    }

    @Transactional
    public void deleteGroup(UUID publicId, User requester) {
        ScenarioGroup group = getGroupByPublicId(publicId);
        boolean isAdmin = requester.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getName()));
        if (!isAdmin && !group.getOwner().getId().equals(requester.getId())) {
            throw new SecurityException("Bu grubu silme yetkiniz yok");
        }

        group.setDeletedAt(Instant.now());
        groupRepository.save(group);

        List<Scenario> scenarios = scenarioRepository
                .findByGroupIdAndOwnerIdAndDeletedAtIsNull(group.getId(), group.getOwner().getId(), Pageable.unpaged())
                .getContent();
        scenarios.forEach(s -> s.setGroup(null));
        scenarioRepository.saveAll(scenarios);
    }

    private ScenarioGroupResponse mapToResponse(ScenarioGroup group, List<Scenario> scenarios) {
        ScenarioGroupResponse response = new ScenarioGroupResponse();
        response.setPublicId(group.getPublicId());
        response.setName(group.getName());
        response.setDescription(group.getDescription());
        response.setCreatedAt(group.getCreatedAt());

        if (scenarios != null) {
            response.setTotalScenarios(scenarios.size());
            response.setDraftScenarios(scenarios.stream().filter(s -> s.getStatus() == ScenarioStatus.DRAFT).count());
            response.setReadyScenarios(scenarios.stream().filter(s -> s.getStatus() == ScenarioStatus.READY).count());
            response.setArchivedScenarios(scenarios.stream().filter(s -> s.getStatus() == ScenarioStatus.ARCHIVED).count());
        }

        return response;
    }
}