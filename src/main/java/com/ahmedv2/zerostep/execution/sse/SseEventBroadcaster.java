package com.ahmedv2.zerostep.execution.sse;

import com.ahmedv2.zerostep.execution.dto.ExecutionLogResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
@Slf4j
public class SseEventBroadcaster {

    private final ConcurrentHashMap<Long, CopyOnWriteArrayList<SseEmitter>> subscribers =
            new ConcurrentHashMap<>();

    // Yeni abone kaydet; lifecycle callback'leri ayarla
    public SseEmitter subscribe(Long executionId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> list = subscribers
                .computeIfAbsent(executionId, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);

        emitter.onCompletion(() -> remove(executionId, emitter));
        emitter.onTimeout(() -> remove(executionId, emitter));
        emitter.onError(t -> remove(executionId, emitter));

        log.debug("SSE subscribed: execId={} totalSubs={}", executionId, list.size());
        return emitter;
    }

    // Yeni log satiri abonelere push
    public void publishLog(Long executionId, ExecutionLogResponse logEvent) {
        CopyOnWriteArrayList<SseEmitter> list = subscribers.get(executionId);
        if (list == null || list.isEmpty()) return;

        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event()
                        .name("log")
                        .id(String.valueOf(logEvent.id()))
                        .data(logEvent));
            } catch (IOException e) {
                remove(executionId, emitter);
            } catch (IllegalStateException e) {
                remove(executionId, emitter);
            }
        }
    }

    // Execution bitti; abonelere completion eventi gonder ve emitter complete et
    public void publishCompletion(Long executionId, String finalStatus) {
        CopyOnWriteArrayList<SseEmitter> list = subscribers.get(executionId);
        if (list == null || list.isEmpty()) return;

        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event()
                        .name("execution-finished")
                        .data(java.util.Map.of("status", finalStatus)));
                emitter.complete();
            } catch (Exception ignored) {}
        }
        subscribers.remove(executionId);
        log.debug("SSE completion broadcast: execId={} status={}", executionId, finalStatus);
    }

    // Heartbeat; reverse proxy idle bagligi kapatmasin
    public void heartbeat(Long executionId) {
        CopyOnWriteArrayList<SseEmitter> list = subscribers.get(executionId);
        if (list == null || list.isEmpty()) return;

        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().comment("ping"));
            } catch (Exception e) {
                remove(executionId, emitter);
            }
        }
    }

    // Heartbeat scheduler'in kullandigi metod
    public List<Long> activeExecutionIds() {
        return List.copyOf(subscribers.keySet());
    }

    private void remove(Long executionId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> list = subscribers.get(executionId);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) {
                subscribers.remove(executionId);
            }
        }
    }
}