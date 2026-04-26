package com.ahmedv2.zerostep.scenario.service;

import com.ahmedv2.zerostep.audit.service.AuditService;
import com.ahmedv2.zerostep.common.exception.ConflictException;
import com.ahmedv2.zerostep.common.exception.ForbiddenException;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.scenario.dto.ScenarioCreateRequest;
import com.ahmedv2.zerostep.scenario.dto.ScenarioResponse;
import com.ahmedv2.zerostep.scenario.dto.ScenarioUpdateRequest;
import com.ahmedv2.zerostep.scenario.entity.BrowserConfig;
import com.ahmedv2.zerostep.scenario.entity.Scenario;
import com.ahmedv2.zerostep.scenario.entity.ScenarioStatus;
import com.ahmedv2.zerostep.scenario.repository.ScenarioRepository;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScenarioService {

    private final ScenarioRepository scenarioRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    // LISTELEME
    // ADMIN/VIEWER tum senaryolari, TESTER sadece kendininkini gorur
    @Transactional(readOnly = true)
    public Page<ScenarioResponse> listScenarios(String username, Set<String> roles,
                                                String search, ScenarioStatus status,
                                                Pageable pageable) {
        String normalizedSearch = (search == null) ? "" : search.trim();
        boolean canSeeAll = roles.contains("ROLE_ADMIN") || roles.contains("ROLE_VIEWER");

        Page<Scenario> page = canSeeAll
                ? scenarioRepository.searchAllActive(normalizedSearch, status, pageable)
                : scenarioRepository.searchByOwnerActive(username, normalizedSearch, status, pageable);

        return page.map(this::toResponse);
    }

    // TEK SENARYO
    @Transactional(readOnly = true)
    public ScenarioResponse getScenario(UUID publicId, String username, Set<String> roles) {
        Scenario s = findOrThrow(publicId);
        checkReadAccess(s, username, roles);
        return toResponse(s);
    }

    // OLUSTUR
    @Transactional
    public ScenarioResponse createScenario(ScenarioCreateRequest request, String username) {
        User owner = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));

        // Ayni kullanicinin aktif senaryolari arasinda ayni isim olmasin
        if (scenarioRepository.existsByNameAndOwnerIdAndDeletedAtIsNull(request.name(), owner.getId())) {
            throw new ConflictException("Ayni isimde bir senaryonuz zaten var");
        }

        Scenario scenario = new Scenario();
        scenario.setOwner(owner);
        scenario.setName(request.name());
        scenario.setDescription(request.description());
        scenario.setBaseUrl(request.baseUrl());
        scenario.setBrowserConfig(request.browserConfig() != null ? request.browserConfig() : new BrowserConfig());
        scenario.setTags(request.tags() != null ? request.tags().toArray(new String[0]) : new String[0]);
        scenario.setStatus(ScenarioStatus.DRAFT);

        Scenario saved = scenarioRepository.save(scenario);
        log.info("Senaryo olusturuldu: {} (owner: {})", saved.getName(), username);

        auditService.record("SCENARIO_CREATED", "SCENARIO", saved.getId(),
                Map.of("name", saved.getName(), "owner", username));

        return toResponse(saved);
    }

    //  GUNCELLE
    @Transactional
    public ScenarioResponse updateScenario(UUID publicId, ScenarioUpdateRequest request,
                                           String username, Set<String> roles) {
        Scenario s = findOrThrow(publicId);
        checkWriteAccess(s, username, roles);

        // Archive edilmis senaryo duzenlenemez
        if (s.getStatus() == ScenarioStatus.ARCHIVED) {
            throw new ForbiddenException("Arsivlenmis senaryo duzenlenemez");
        }

        // Partial update; sadece null olmayan alanlari guncelle
        if (request.name() != null && !request.name().equals(s.getName())) {
            // Yeni isim baska senaryoda kullanimda mi?
            if (scenarioRepository.existsByNameAndOwnerIdAndDeletedAtIsNull(
                    request.name(), s.getOwner().getId())) {
                throw new ConflictException("Ayni isimde bir senaryonuz zaten var");
            }
            s.setName(request.name());
        }
        if (request.description() != null) {
            s.setDescription(request.description());
        }
        if (request.baseUrl() != null) {
            s.setBaseUrl(request.baseUrl());
        }
        if (request.browserConfig() != null) {
            s.setBrowserConfig(request.browserConfig());
        }
        if (request.tags() != null) {
            s.setTags(request.tags().toArray(new String[0]));
        }

        Scenario saved = scenarioRepository.save(s);

        auditService.record("SCENARIO_UPDATED", "SCENARIO", saved.getId(),
                Map.of("name", saved.getName()));

        return toResponse(saved);
    }

    // DURUM DEGISIKLIGI
    @Transactional
    public ScenarioResponse changeStatus(UUID publicId, ScenarioStatus target,
                                         String username, Set<String> roles) {
        Scenario s = findOrThrow(publicId);
        checkWriteAccess(s, username, roles);

        ScenarioStatus old = s.getStatus();
        // State machine domain icinde
        try {
            switch (target) {
                case READY     -> s.markReady();
                case ARCHIVED  -> s.archive();
                case DRAFT     -> {
                    if (old == ScenarioStatus.ARCHIVED) s.unarchive();
                    else s.setStatus(ScenarioStatus.DRAFT);
                }
            }
        } catch (IllegalStateException e) {
            throw new ForbiddenException(e.getMessage());
        }

        Scenario saved = scenarioRepository.save(s);

        auditService.record("SCENARIO_STATUS_CHANGED", "SCENARIO", saved.getId(),
                Map.of("from", old.name(), "to", target.name()));

        return toResponse(saved);
    }

    // SILME (SOFT)
    @Transactional
    public void deleteScenario(UUID publicId, String username, Set<String> roles) {
        Scenario s = findOrThrow(publicId);
        checkWriteAccess(s, username, roles);

        if (s.getStatus() == ScenarioStatus.ARCHIVED) {
            throw new ForbiddenException("Arsivlenmis senaryo silinemez; once unarchive edin");
        }

        s.setDeletedAt(Instant.now());
        scenarioRepository.save(s);

        auditService.record("SCENARIO_DELETED", "SCENARIO", s.getId(),
                Map.of("name", s.getName()));
        log.info("Senaryo silindi (soft): {} (owner: {})", s.getName(), s.getOwner().getUsername());
    }


    // Yardimci metodlar
    private Scenario findOrThrow(UUID publicId) {
        return scenarioRepository.findByPublicIdActive(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Scenario", publicId));
    }

    // Okuma: ADMIN/VIEWER herkesi gorur, TESTER sadece kendi senaryosunu
    private void checkReadAccess(Scenario s, String username, Set<String> roles) {
        if (roles.contains("ROLE_ADMIN") || roles.contains("ROLE_VIEWER")) return;
        if (!s.getOwner().getUsername().equals(username)) {
            throw new ForbiddenException("Bu senaryoyu goruntuleme yetkiniz yok");
        }
    }

    // Yazma: ADMIN tumunu, TESTER sadece kendini; VIEWER hicbir zaman
    private void checkWriteAccess(Scenario s, String username, Set<String> roles) {
        if (roles.contains("ROLE_VIEWER") && !roles.contains("ROLE_ADMIN")) {
            throw new ForbiddenException("VIEWER rolu ile yazma islemi yapilamaz");
        }
        if (roles.contains("ROLE_ADMIN")) return;
        if (!s.getOwner().getUsername().equals(username)) {
            throw new ForbiddenException("Bu senaryoyu duzenleme yetkiniz yok");
        }
    }

    private ScenarioResponse toResponse(Scenario s) {
        Set<String> tagSet = new HashSet<>();
        if (s.getTags() != null) {
            for (String t : s.getTags()) tagSet.add(t);
        }
        return new ScenarioResponse(
                s.getPublicId(),
                s.getName(),
                s.getDescription(),
                s.getStatus(),
                s.getBaseUrl(),
                s.getBrowserConfig(),
                tagSet,
                new ScenarioResponse.OwnerSummary(
                        s.getOwner().getPublicId(),
                        s.getOwner().getUsername(),
                        s.getOwner().getDisplayName()),
                s.getCreatedAt(),
                s.getUpdatedAt()
        );
    }
}