package com.ahmedv2.zerostep.execution.sse;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// 15 saniyede bir tum aktif SSE bagli execution'lara heartbeat
// Reverse proxy / load balancer idle bagligi kapatmasin diye
@Component
@RequiredArgsConstructor
public class SseHeartbeatScheduler {

    private final SseEventBroadcaster broadcaster;

    @Scheduled(fixedDelay = 15_000L)
    public void heartbeat() {
        for (Long execId : broadcaster.activeExecutionIds()) {
            broadcaster.heartbeat(execId);
        }
    }
}