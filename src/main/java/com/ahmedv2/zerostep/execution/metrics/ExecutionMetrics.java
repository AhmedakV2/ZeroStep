package com.ahmedv2.zerostep.execution.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;

// Execution ve WebDriver pool metriklerini Prometheus'a açar
@Component
@RequiredArgsConstructor
public class ExecutionMetrics {

    private final MeterRegistry meterRegistry;

    private Counter startedCounter;
    private Counter completedCounter;
    private Counter failedCounter;
    private final AtomicInteger driversInUse = new AtomicInteger(0);

    @PostConstruct
    void init() {
        startedCounter   = Counter.builder("zerostep.executions.started")
                .description("Baslayan execution sayisi")
                .register(meterRegistry);

        completedCounter = Counter.builder("zerostep.executions.completed")
                .description("Tamamlanan execution sayisi")
                .register(meterRegistry);

        failedCounter    = Counter.builder("zerostep.executions.failed")
                .description("Basarisiz execution sayisi")
                .register(meterRegistry);

        // Anlık aktif driver sayısı — gauge
        Gauge.builder("zerostep.drivers.in_use", driversInUse, AtomicInteger::get)
                .description("Anlık kullanımda WebDriver sayisi")
                .register(meterRegistry);
    }

    public void recordStarted()   { startedCounter.increment(); }
    public void recordCompleted() { completedCounter.increment(); }
    public void recordFailed()    { failedCounter.increment(); }

    public void driverAcquired()  { driversInUse.incrementAndGet(); }
    public void driverReleased()  { driversInUse.decrementAndGet(); }
}