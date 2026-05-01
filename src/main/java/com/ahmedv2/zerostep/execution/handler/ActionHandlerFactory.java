package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.step.entity.ActionType;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class ActionHandlerFactory {

    private final List<ActionHandler> handlers;
    private final Map<ActionType, ActionHandler> registry = new HashMap<>();

    @PostConstruct
    void init() {
        for (ActionHandler handler : handlers) {
            ActionType type = handler.supports();
            if(registry.containsKey(type)) {
                throw new IllegalStateException(
                        "ActionType" + type + "icin birden fazla handler kayitli");
            }
            registry.put(type, handler);
        }
        log.info("ActionHandlerFactory hazir; {} handler kayitli ", registry.size());
    }

    public Optional<ActionHandler> find(ActionType type){
        return Optional.ofNullable(registry.get(type));
    }

    public ActionHandler require(ActionType type) {
        return find(type).orElseThrow(() -> new UnsupportedOperationException(
                "Bu action tipi icin handler henuz implement edilmedi:" + type));
    }
}
