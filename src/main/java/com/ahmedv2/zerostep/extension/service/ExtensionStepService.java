package com.ahmedv2.zerostep.extension.service;

import com.ahmedv2.zerostep.common.exception.ForbiddenException;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.extension.dto.BatchStepItem;
import com.ahmedv2.zerostep.extension.dto.BatchStepRequest;
import com.ahmedv2.zerostep.extension.dto.BatchStepResponse;
import com.ahmedv2.zerostep.extension.dto.ExtensionScenarioCreateRequest;
import com.ahmedv2.zerostep.scenario.dto.ScenarioCreateRequest;
import com.ahmedv2.zerostep.scenario.dto.ScenarioResponse;
import com.ahmedv2.zerostep.scenario.entity.Scenario;
import com.ahmedv2.zerostep.scenario.entity.ScenarioStatus;
import com.ahmedv2.zerostep.scenario.repository.ScenarioRepository;
import com.ahmedv2.zerostep.scenario.service.ScenarioService;
import com.ahmedv2.zerostep.step.dto.TestStepResponse;
import com.ahmedv2.zerostep.step.entity.TestStep;
import com.ahmedv2.zerostep.step.entity.TestStepConfig;
import com.ahmedv2.zerostep.step.repository.TestStepRepository;
import com.ahmedv2.zerostep.step.util.FractionalIndexer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExtensionStepService {

    private final ScenarioRepository scenarioRepository;
    private final ScenarioService scenarioService;
    private final TestStepRepository stepRepository;

    // Extension adına senaryo oluştur (DRAFT, browserConfig default)
    @Transactional
    public ScenarioResponse createScenario(ExtensionScenarioCreateRequest req, String username) {
        ScenarioCreateRequest inner = new ScenarioCreateRequest(
                req.name(),
                req.description(),
                req.baseUrl(),
                null, // browserConfig default
                null  // tags yok
        );
        return scenarioService.createScenario(inner, username);
    }

    // Toplu step ekleme; FractionalIndexer ile her adım mevcut sonuna eklenir
    @Transactional
    public BatchStepResponse batchAddSteps(UUID scenarioPublicId,
                                           BatchStepRequest request,
                                           String username) {
        Scenario scenario = scenarioRepository.findByPublicIdActive(scenarioPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Scenario", scenarioPublicId));

        // Sadece owner veya admin erişebilir; extension context'inde ADMIN rolü de olabilir
        if (!scenario.getOwner().getUsername().equals(username)) {
            throw new ForbiddenException("Bu senaryoya step ekleme yetkiniz yok");
        }
        if (scenario.getStatus() == ScenarioStatus.ARCHIVED) {
            throw new ForbiddenException("Arsivlenmis senaryoya step eklenemez");
        }

        // Mevcut son step'in order'ını bul; bunun üzerine ekle
        Double maxOrder = stepRepository.findMaxStepOrder(scenario.getId()).orElse(null);
        double currentOrder = maxOrder == null
                ? FractionalIndexer.INITIAL_ORDER
                : maxOrder + FractionalIndexer.APPEND_GAP;

        List<TestStepResponse> added = new ArrayList<>();

        for (BatchStepItem item : request.steps()) {
            TestStep step = new TestStep();
            step.setScenario(scenario);
            step.setStepOrder(currentOrder);
            step.setActionType(item.actionType());
            step.setSelectorType(item.selectorType());
            step.setSelectorValue(item.selectorValue());
            step.setInputValue(item.inputValue());
            step.setSecondaryValue(item.secondaryValue());
            // Açıklama boşsa otomatik üret
            step.setDescription(resolveDescription(item));
            step.setConfig(item.config() != null ? item.config() : new TestStepConfig());
            step.setEnabled(true);

            TestStep saved = stepRepository.save(step);
            added.add(toResponse(saved));

            currentOrder += FractionalIndexer.APPEND_GAP;
        }

        log.info("Extension batch step eklendi: scenario={} count={} user={}",
                scenarioPublicId, added.size(), username);

        return new BatchStepResponse(added.size(), added);
    }

    // description boş/null gelirse "ACTION on selectorValue" formatında üret
    private String resolveDescription(BatchStepItem item) {
        if (item.description() != null && !item.description().isBlank()) {
            return item.description();
        }
        String action = item.actionType().name();
        if (item.selectorValue() != null && !item.selectorValue().isBlank()) {
            // Uzun selector'ü kısalt; okunabilirlik için max 60 char
            String sel = item.selectorValue().length() > 60
                    ? item.selectorValue().substring(0, 60) + "..."
                    : item.selectorValue();
            return switch (item.actionType()) {
                case TYPE, TYPE_SECRET -> action + " into " + sel;
                case NAVIGATE -> "Navigate to " + (item.inputValue() != null ? item.inputValue() : sel);
                default -> action + " on " + sel;
            };
        }
        if (item.inputValue() != null && !item.inputValue().isBlank()) {
            String val = item.inputValue().length() > 60
                    ? item.inputValue().substring(0, 60) + "..."
                    : item.inputValue();
            return action + ": " + val;
        }
        return action;
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