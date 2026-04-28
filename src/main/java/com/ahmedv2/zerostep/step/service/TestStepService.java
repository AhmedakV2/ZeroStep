package com.ahmedv2.zerostep.step.service;

import com.ahmedv2.zerostep.audit.service.AuditService;
import com.ahmedv2.zerostep.common.exception.ConflictException;
import com.ahmedv2.zerostep.common.exception.ForbiddenException;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.scenario.entity.Scenario;
import com.ahmedv2.zerostep.scenario.entity.ScenarioStatus;
import com.ahmedv2.zerostep.scenario.repository.ScenarioRepository;
import com.ahmedv2.zerostep.step.dto.TestStepCreateRequest;
import com.ahmedv2.zerostep.step.dto.TestStepReorderRequest;
import com.ahmedv2.zerostep.step.dto.TestStepResponse;
import com.ahmedv2.zerostep.step.dto.TestStepUpdateRequest;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import com.ahmedv2.zerostep.step.entity.TestStepConfig;
import com.ahmedv2.zerostep.step.repository.TestStepRepository;
import com.ahmedv2.zerostep.step.util.FractionalIndexer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TestStepService {

    private final TestStepRepository stepRepository;
    private final ScenarioRepository scenarioRepository;
    private final AuditService auditService;

    // === LISTELEME ===
    @Transactional(readOnly = true)
    public List<TestStepResponse> listSteps(UUID scenarioPublicId, String username, Set<String> roles) {
        Scenario scenario = findScenarioOrThrow(scenarioPublicId);
        checkReadAccess(scenario, username, roles);
        return stepRepository.findAllByScenarioOrdered(scenario.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    // === DETAY ===
    @Transactional(readOnly = true)
    public TestStepResponse getStep(UUID stepPublicId, String username, Set<String> roles) {
        TestStep step = findStepOrThrow(stepPublicId);
        checkReadAccess(step.getScenario(), username, roles);
        return toResponse(step);
    }

    // === EKLEME ===
    @Transactional
    public TestStepResponse createStep(UUID scenarioPublicId, TestStepCreateRequest request,
                                       String username, Set<String> roles) {
        Scenario scenario = findScenarioOrThrow(scenarioPublicId);
        checkWriteAccess(scenario, username, roles);
        ensureNotArchived(scenario);
        validateActionRequirements(request.actionType(), request.selectorValue(),
                request.inputValue(), request.secondaryValue());

        double newOrder = computeOrderForInsert(
                scenario.getId(),
                request.afterStepPublicId(),
                request.beforeStepPublicId()
        );

        TestStep step = new TestStep();
        step.setScenario(scenario);
        step.setStepOrder(newOrder);
        step.setActionType(request.actionType());
        step.setSelectorType(request.selectorType());
        step.setSelectorValue(request.selectorValue());
        step.setInputValue(request.inputValue());
        step.setSecondaryValue(request.secondaryValue());
        step.setDescription(request.description());
        step.setConfig(request.config() != null ? request.config() : new TestStepConfig());
        step.setEnabled(true);

        TestStep saved = stepRepository.save(step);
        log.info("Step eklendi: scenario={} action={} order={}",
                scenario.getName(), saved.getActionType(), saved.getStepOrder());

        auditService.record("STEP_CREATED", "TEST_STEP", saved.getId(),
                buildAuditPayload(saved));

        return toResponse(saved);
    }

    // === GUNCELLEME (Partial) ===
    @Transactional
    public TestStepResponse updateStep(UUID stepPublicId, TestStepUpdateRequest request,
                                       String username, Set<String> roles) {
        TestStep step = findStepOrThrow(stepPublicId);
        checkWriteAccess(step.getScenario(), username, roles);
        ensureNotArchived(step.getScenario());

        if (request.actionType() != null) step.setActionType(request.actionType());
        if (request.selectorType() != null) step.setSelectorType(request.selectorType());
        if (request.selectorValue() != null) step.setSelectorValue(request.selectorValue());
        if (request.inputValue() != null) step.setInputValue(request.inputValue());
        if (request.secondaryValue() != null) step.setSecondaryValue(request.secondaryValue());
        if (request.description() != null) step.setDescription(request.description());
        if (request.config() != null) step.setConfig(request.config());
        if (request.enabled() != null) step.setEnabled(request.enabled());

        // Update sonrasi requirement check (yeni action type'a uygun mu?)
        validateActionRequirements(step.getActionType(), step.getSelectorValue(),
                step.getInputValue(), step.getSecondaryValue());

        TestStep saved = stepRepository.save(step);

        auditService.record("STEP_UPDATED", "TEST_STEP", saved.getId(),
                Map.of("scenarioId", step.getScenario().getId(),
                        "actionType", saved.getActionType().name()));

        return toResponse(saved);
    }

    // === REORDER ===
    @Transactional
    public TestStepResponse reorderStep(UUID stepPublicId, TestStepReorderRequest request,
                                        String username, Set<String> roles) {
        if (!request.isValid()) {
            throw new ConflictException("afterStepPublicId veya beforeStepPublicId belirtilmeli");
        }

        TestStep step = findStepOrThrow(stepPublicId);
        checkWriteAccess(step.getScenario(), username, roles);
        ensureNotArchived(step.getScenario());

        // Step kendi pozisyonuna tasinmaya calisilirsa atla
        if (stepPublicId.equals(request.afterStepPublicId()) ||
                stepPublicId.equals(request.beforeStepPublicId())) {
            throw new ConflictException("Adim kendi pozisyonuna tasinamaz");
        }

        double newOrder = computeOrderForInsert(
                step.getScenario().getId(),
                request.afterStepPublicId(),
                request.beforeStepPublicId()
        );

        Double oldOrder = step.getStepOrder();
        step.setStepOrder(newOrder);
        TestStep saved = stepRepository.save(step);

        auditService.record("STEP_REORDERED", "TEST_STEP", saved.getId(),
                Map.of("from", oldOrder, "to", newOrder));

        return toResponse(saved);
    }

    // === KOPYALAMA ===
    @Transactional
    public TestStepResponse duplicateStep(UUID stepPublicId, String username, Set<String> roles) {
        TestStep original = findStepOrThrow(stepPublicId);
        checkWriteAccess(original.getScenario(), username, roles);
        ensureNotArchived(original.getScenario());

        double newOrder = computeOrderForInsert(
                original.getScenario().getId(),
                original.getPublicId(),
                null
        );

        TestStep copy = new TestStep();
        copy.setScenario(original.getScenario());
        copy.setStepOrder(newOrder);
        copy.setActionType(original.getActionType());
        copy.setSelectorType(original.getSelectorType());
        copy.setSelectorValue(original.getSelectorValue());
        copy.setInputValue(original.getInputValue());
        copy.setSecondaryValue(original.getSecondaryValue());
        copy.setDescription(prefixCopyMarker(original.getDescription()));
        copy.setConfig(original.getConfig());
        copy.setEnabled(true);

        TestStep saved = stepRepository.save(copy);

        auditService.record("STEP_DUPLICATED", "TEST_STEP", saved.getId(),
                Map.of("originalId", original.getId(),
                        "actionType", saved.getActionType().name()));

        return toResponse(saved);
    }

    // === SOFT DELETE ===
    @Transactional
    public void deleteStep(UUID stepPublicId, String username, Set<String> roles) {
        TestStep step = findStepOrThrow(stepPublicId);
        checkWriteAccess(step.getScenario(), username, roles);
        ensureNotArchived(step.getScenario());

        step.setDeletedAt(Instant.now());
        stepRepository.save(step);

        auditService.record("STEP_DELETED", "TEST_STEP", step.getId(),
                Map.of("scenarioId", step.getScenario().getId(),
                        "actionType", step.getActionType().name()));
    }

    // ============================================================
    // Yardimci metodlar
    // ============================================================

    // Action gereksinimleri validasyonu (selector/input/secondary zorunlu mu?)
    private void validateActionRequirements(ActionType action, String selector,
                                            String input, String secondary) {
        if (action.requiresSelector() && (selector == null || selector.isBlank())) {
            throw new ConflictException(
                    "Bu action selector_value gerektirir: " + action.name());
        }
        if (action.requiresInputValue() && (input == null || input.isBlank())) {
            throw new ConflictException(
                    "Bu action input_value gerektirir: " + action.name());
        }
        if (action.requiresSecondaryValue() && (secondary == null || secondary.isBlank())) {
            throw new ConflictException(
                    "Bu action secondary_value gerektirir: " + action.name());
        }
    }

    // Insert/reorder pozisyonunu hesapla
    private double computeOrderForInsert(Long scenarioId, UUID afterPublicId, UUID beforePublicId) {
        Double beforeOrder = null;
        Double afterOrder = null;

        if (afterPublicId != null) {
            TestStep afterStep = findStepOrThrow(afterPublicId);
            if (!afterStep.getScenario().getId().equals(scenarioId)) {
                throw new ConflictException("Hedef adim bu senaryoya ait degil");
            }
            beforeOrder = afterStep.getStepOrder();
            afterOrder = stepRepository.findNextStep(scenarioId, beforeOrder)
                    .map(TestStep::getStepOrder)
                    .orElse(null);
        } else if (beforePublicId != null) {
            TestStep beforeStep = findStepOrThrow(beforePublicId);
            if (!beforeStep.getScenario().getId().equals(scenarioId)) {
                throw new ConflictException("Hedef adim bu senaryoya ait degil");
            }
            afterOrder = beforeStep.getStepOrder();
            beforeOrder = stepRepository.findPreviousStep(scenarioId, afterOrder)
                    .map(TestStep::getStepOrder)
                    .orElse(null);
        } else {
            beforeOrder = stepRepository.findMaxStepOrder(scenarioId).orElse(null);
        }

        return FractionalIndexer.compute(beforeOrder, afterOrder);
    }

    private Scenario findScenarioOrThrow(UUID publicId) {
        return scenarioRepository.findByPublicIdActive(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Scenario", publicId));
    }

    private TestStep findStepOrThrow(UUID publicId) {
        return stepRepository.findByPublicIdActive(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("TestStep", publicId));
    }

    private void ensureNotArchived(Scenario scenario) {
        if (scenario.getStatus() == ScenarioStatus.ARCHIVED) {
            throw new ForbiddenException("Arsivlenmis senaryoda adim degisiklik yapilamaz");
        }
    }

    private void checkReadAccess(Scenario s, String username, Set<String> roles) {
        if (roles.contains("ROLE_ADMIN") || roles.contains("ROLE_VIEWER")) return;
        if (!s.getOwner().getUsername().equals(username)) {
            throw new ForbiddenException("Bu senaryonun adimlarina erisim yetkiniz yok");
        }
    }

    private void checkWriteAccess(Scenario s, String username, Set<String> roles) {
        if (roles.contains("ROLE_VIEWER") && !roles.contains("ROLE_ADMIN")) {
            throw new ForbiddenException("VIEWER rolu ile adim duzenlenemez");
        }
        if (roles.contains("ROLE_ADMIN")) return;
        if (!s.getOwner().getUsername().equals(username)) {
            throw new ForbiddenException("Bu senaryonun adimlarini duzenleme yetkiniz yok");
        }
    }

    private String prefixCopyMarker(String original) {
        if (original == null || original.isBlank()) return "(Kopya)";
        return "(Kopya) " + original;
    }

    // Audit payload; hassas veri (TYPE_SECRET) maskelenir
    private Map<String, Object> buildAuditPayload(TestStep step) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("scenarioId", step.getScenario().getId());
        payload.put("actionType", step.getActionType().name());
        payload.put("stepOrder", step.getStepOrder());
        if (step.getSelectorValue() != null) {
            payload.put("selector", step.getSelectorValue());
        }
        // Hassas action ise input/secondary maskele
        if (!step.getActionType().isSensitive()) {
            if (step.getInputValue() != null) {
                payload.put("inputValue", truncate(step.getInputValue(), 200));
            }
        } else {
            payload.put("inputValue", "***MASKED***");
        }
        return payload;
    }

    private String truncate(String s, int max) {
        if (s == null || s.length() <= max) return s;
        return s.substring(0, max) + "...";
    }

    private TestStepResponse toResponse(TestStep s) {
        return new TestStepResponse(
                s.getPublicId(),
                s.getStepOrder(),
                s.getActionType(),
                s.getSelectorType(),
                s.getSelectorValue(),
                s.getInputValue(),
                s.getSecondaryValue(),
                s.getDescription(),
                s.getConfig(),
                s.isEnabled(),
                s.getCreatedAt(),
                s.getUpdatedAt()
        );
    }
}