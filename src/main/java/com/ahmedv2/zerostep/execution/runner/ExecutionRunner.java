package com.ahmedv2.zerostep.execution.runner;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.WebDriverPool;
import com.ahmedv2.zerostep.execution.entity.Execution;
import com.ahmedv2.zerostep.execution.entity.ExecutionStatus;
import com.ahmedv2.zerostep.execution.entity.ExecutionStepResult;
import com.ahmedv2.zerostep.execution.entity.StepResultStatus;
import com.ahmedv2.zerostep.execution.handler.ActionHandler;
import com.ahmedv2.zerostep.execution.handler.ActionHandlerFactory;
import com.ahmedv2.zerostep.execution.metrics.ExecutionMetrics;
import com.ahmedv2.zerostep.execution.repository.ExecutionRepository;
import com.ahmedv2.zerostep.execution.repository.ExecutionStepResultRepository;
import com.ahmedv2.zerostep.execution.service.ExecutionLogService;
import com.ahmedv2.zerostep.notification.service.NotificationService;
import com.ahmedv2.zerostep.scenario.entity.Scenario;
import com.ahmedv2.zerostep.step.entity.TestStep;
import com.ahmedv2.zerostep.step.repository.TestStepRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.WebDriver;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExecutionRunner {

    private final ExecutionRepository          executionRepository;
    private final ExecutionStepResultRepository stepResultRepository;
    private final TestStepRepository            stepRepository;
    private final ExecutionLogService           logService;
    private final WebDriverPool                 webDriverPool;
    private final ActionHandlerFactory          handlerFactory;
    private final com.ahmedv2.zerostep.execution.sse.SseEventBroadcaster sseBroadcaster;
    private final NotificationService           notificationService;
    private final ExecutionMetrics              executionMetrics;

    private final ConcurrentHashMap<Long, AtomicBoolean> cancelFlags = new ConcurrentHashMap<>();

    @Async("taskExecutor")
    public void run(Long executionId) {
        log.info("Execution başlatılıyor: id={}", executionId);
        AtomicBoolean cancelFlag = new AtomicBoolean(false);
        cancelFlags.put(executionId, cancelFlag);
        try {
            executeInternal(executionId, cancelFlag);
        } catch (Exception e) {
            log.error("Execution beklenmedik hata: id={}", executionId, e);
            markFailed(executionId, "Beklenmedik hata: " + e.getMessage());
        } finally {
            cancelFlags.remove(executionId);
        }
    }

    public boolean requestCancel(Long executionId) {
        AtomicBoolean flag = cancelFlags.get(executionId);
        if (flag == null) return false;
        flag.set(true);
        return true;
    }

    // ── Ana Execution Döngüsü ─────────────────────────────
    private void executeInternal(Long executionId, AtomicBoolean cancelFlag) {
        // Execution + tüm lazy ilişkileri tek @Transactional içinde yükle
        ExecutionSnapshot snap = loadExecutionSnapshot(executionId);
        if (snap == null) return;

        List<TestStep> steps = stepRepository.findAllByScenarioOrdered(snap.scenarioId());

        if (steps.isEmpty()) {
            logService.warn(snap.execution(), null, "Senaryoda hiçbir adım yok");
            finalizeExecution(executionId, ExecutionStatus.COMPLETED, null,
                    snap.recipientUserId(), snap.scenarioName());
            return;
        }

        updateTotalSteps(executionId, steps.size());
        logService.info(snap.execution(), null,
                "Senaryo başladı: " + snap.scenarioName() + " (" + steps.size() + " adım)");

        WebDriver driver = null;
        ExecutionContext context = null;
        boolean anyFailure = false;

        try {
            // Browser pool'dan driver al — browserConfig snapshot'tan gelir
            driver  = webDriverPool.acquire(snap.browserConfig());
            // ExecutionContext'e execution objesini ver; scenario için snapshot verisini kullan
            context = new ExecutionContext(driver, snap.execution(), snap.scenario(), logService);
            logService.info(snap.execution(), null, "Browser başlatıldı");

            for (TestStep step : steps) {
                if (cancelFlag.get()) {
                    logService.warn(snap.execution(), null, "Execution iptal edildi");
                    finalizeExecution(executionId, ExecutionStatus.CANCELLED,
                            "Kullanıcı iptal etti",
                            snap.recipientUserId(), snap.scenarioName());
                    return;
                }

                if (!step.isEnabled()) {
                    ExecutionStepResult skipped = createStepResult(snap.execution(), step,
                            StepResultStatus.SKIPPED);
                    stepResultRepository.save(skipped);
                    logService.info(snap.execution(), skipped,
                            "Adım atlandı (disabled): " + step.getActionType());
                    incrementCounters(executionId, 0, 0, 1);
                    continue;
                }

                ExecutionStepResult result = createStepResult(snap.execution(), step,
                        StepResultStatus.RUNNING);
                ExecutionStepResult savedResult = stepResultRepository.save(result);
                context.setCurrentStepResult(savedResult);

                logService.info(snap.execution(), savedResult,
                        "Adım başlıyor: " + step.getActionType()
                                + (step.getDescription() != null
                                ? " — " + step.getDescription() : ""));

                boolean stepPassed = executeStep(step, context, savedResult);

                if (stepPassed) {
                    incrementCounters(executionId, 1, 0, 0);
                } else {
                    anyFailure = true;
                    incrementCounters(executionId, 0, 1, 0);
                    boolean continueOnFail = step.getConfig() != null
                            && Boolean.TRUE.equals(step.getConfig().getContinueOnFailure());
                    if (!continueOnFail) {
                        logService.error(snap.execution(), null,
                                "Senaryo durdu: continueOnFailure=false");
                        finalizeExecution(executionId, ExecutionStatus.FAILED,
                                "Adım başarısız: " + step.getActionType(),
                                snap.recipientUserId(), snap.scenarioName());
                        return;
                    }
                }
            }

            ExecutionStatus finalStatus = anyFailure
                    ? ExecutionStatus.FAILED : ExecutionStatus.COMPLETED;
            finalizeExecution(executionId, finalStatus,
                    anyFailure ? "Bazı adımlar başarısız" : null,
                    snap.recipientUserId(), snap.scenarioName());
            logService.info(snap.execution(), null, "Senaryo bitti: " + finalStatus.name());

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logService.error(snap.execution(), null, "Driver acquire kesintiye uğradı");
            finalizeExecution(executionId, ExecutionStatus.FAILED,
                    "Driver alınamadı: interrupted",
                    snap.recipientUserId(), snap.scenarioName());
        } catch (Exception e) {
            log.error("Execution hata; id={}", executionId, e);
            logService.error(snap.execution(), null, "Execution hata: " + e.getMessage());
            finalizeExecution(executionId, ExecutionStatus.FAILED, e.getMessage(),
                    snap.recipientUserId(), snap.scenarioName());
        } finally {
            if (driver != null) webDriverPool.release(driver);
        }
    }

    // ── Step Executor ─────────────────────────────────────
    private boolean executeStep(TestStep step, ExecutionContext context,
                                ExecutionStepResult result) {
        Instant start = Instant.now();
        int maxAttempts = Math.max(1,
                (step.getConfig() != null && step.getConfig().getRetryCount() != null
                        ? step.getConfig().getRetryCount() : 0) + 1);
        Exception lastError = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                ActionHandler handler = handlerFactory.require(step.getActionType());
                handler.execute(step, context);

                Integer postDelay = step.getConfig() != null
                        ? step.getConfig().getPostDelayMs() : null;
                if (postDelay != null && postDelay > 0) Thread.sleep(postDelay);

                markStepFinished(result.getId(), StepResultStatus.PASSED,
                        null, start, result.getScreenshotPath());
                return true;

            } catch (UnsupportedOperationException e) {
                String msg = "Handler bulunamadı: " + step.getActionType().name();
                logService.error(context.getExecution(), result, msg);
                markStepFinished(result.getId(), StepResultStatus.FAILED,
                        msg, start, result.getScreenshotPath());
                return false;

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                lastError = e;
                break;

            } catch (Exception e) {
                lastError = e;
                logService.warn(context.getExecution(), result,
                        "Adım hata (attempt " + attempt + "/" + maxAttempts + "): "
                                + e.getMessage());
                if (attempt < maxAttempts) {
                    try { Thread.sleep(500); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt(); break;
                    }
                }
            }
        }

        String errorMsg = lastError != null ? lastError.getMessage() : "Bilinmeyen hata";
        logService.error(context.getExecution(), result, "Adım başarısız: " + errorMsg);
        markStepFinished(result.getId(), StepResultStatus.FAILED,
                errorMsg, start, result.getScreenshotPath());
        return false;
    }

    // ── DB Metodları ──────────────────────────────────────

    /**
     * Execution + tüm lazy ilişkilerini tek transaction içinde yükler.
     * Bu metod dışında lazy proxy'ye erişilmez → "no session" hatası ortadan kalkar.
     */
    @Transactional
    protected ExecutionSnapshot loadExecutionSnapshot(Long executionId) {
        Execution execution = executionRepository
                .findByIdWithAllRelations(executionId)
                .orElse(null);

        if (execution == null) {
            log.error("Execution bulunamadı: {}", executionId);
            return null;
        }

        execution.setStatus(ExecutionStatus.RUNNING);
        execution.setStartedAt(Instant.now());
        executionRepository.save(execution);
        executionMetrics.recordStarted();

        // Lazy ilişkilerin değerlerini snapshot'a al —
        // transaction kapandıktan sonra Scenario/User proxy'sine erişilmez
        Scenario scenario = execution.getScenario();
        Long scenarioId       = scenario.getId();
        String scenarioName   = scenario.getName();
        String scenarioBaseUrl = scenario.getBaseUrl();
        var browserConfig     = scenario.getBrowserConfig();

        Long recipientUserId = execution.getTriggeredBy() != null
                ? execution.getTriggeredBy().getId()
                : null;

        return new ExecutionSnapshot(
                execution,
                scenario,
                scenarioId,
                scenarioName,
                scenarioBaseUrl,
                browserConfig,
                recipientUserId
        );
    }

    @Transactional
    protected void updateTotalSteps(Long executionId, int total) {
        executionRepository.findById(executionId).ifPresent(e -> {
            e.setTotalSteps(total);
            executionRepository.save(e);
        });
    }

    @Transactional
    protected void incrementCounters(Long executionId,
                                     int passed, int failed, int skipped) {
        executionRepository.findById(executionId).ifPresent(e -> {
            e.setPassedSteps(e.getPassedSteps() + passed);
            e.setFailedSteps(e.getFailedSteps() + failed);
            e.setSkippedSteps(e.getSkippedSteps() + skipped);
            executionRepository.save(e);
        });
    }

    @Transactional
    protected void finalizeExecution(Long executionId, ExecutionStatus status,
                                     String errorMsg,
                                     Long recipientUserId, String scenarioName) {
        executionRepository.findById(executionId).ifPresent(e -> {
            Instant now = Instant.now();
            e.setStatus(status);
            e.setFinishedAt(now);
            if (e.getStartedAt() != null) {
                e.setDurationMs(Duration.between(e.getStartedAt(), now).toMillis());
            }
            if (errorMsg != null) e.setErrorMessage(errorMsg);
            executionRepository.save(e);

            if (status == ExecutionStatus.COMPLETED) executionMetrics.recordCompleted();
            else if (status == ExecutionStatus.FAILED
                    || status == ExecutionStatus.TIMEOUT) executionMetrics.recordFailed();

            // Bildirim — lazy proxy kullanmak yerine snapshot'tan gelen ID/name'i kullan
            if (recipientUserId != null && status.isTerminal()) {
                notificationService.notifyExecutionFinished(
                        recipientUserId,
                        scenarioName != null ? scenarioName : "Bilinmeyen Senaryo",
                        status.name(),
                        e.getPublicId()
                );
            }
        });

        // SSE completion broadcast
        sseBroadcaster.publishCompletion(executionId, status.name());
    }

    @Transactional
    protected void markFailed(Long executionId, String errorMsg) {
        // recipientUserId ve scenarioName yok — snapshot yüklenemedi durumu
        executionRepository.findById(executionId).ifPresent(e -> {
            Instant now = Instant.now();
            e.setStatus(ExecutionStatus.FAILED);
            e.setFinishedAt(now);
            if (e.getStartedAt() != null) {
                e.setDurationMs(Duration.between(e.getStartedAt(), now).toMillis());
            }
            e.setErrorMessage(errorMsg);
            executionRepository.save(e);
            executionMetrics.recordFailed();
        });
        sseBroadcaster.publishCompletion(executionId, ExecutionStatus.FAILED.name());
    }

    @Transactional
    protected void markStepFinished(Long stepResultId, StepResultStatus status,
                                    String errorMsg, Instant start, String screenshotPath) {
        stepResultRepository.findById(stepResultId).ifPresent(sr -> {
            Instant now = Instant.now();
            sr.setStatus(status);
            sr.setFinishedAt(now);
            sr.setDurationMs(Duration.between(start, now).toMillis());
            if (errorMsg != null) sr.setErrorMessage(errorMsg);
            if (screenshotPath != null) sr.setScreenshotPath(screenshotPath);
            stepResultRepository.save(sr);
        });
    }

    private ExecutionStepResult createStepResult(Execution execution, TestStep step,
                                                 StepResultStatus status) {
        ExecutionStepResult sr = new ExecutionStepResult();
        sr.setExecution(execution);
        sr.setTestStep(step);
        sr.setStepOrder(step.getStepOrder());
        sr.setActionType(step.getActionType());
        sr.setDescription(step.getDescription());
        sr.setStatus(status);
        return sr;
    }

    // Lazy proxy erişimini transaction içinde sınırlamak için snapshot record
    record ExecutionSnapshot(
            Execution execution,
            Scenario scenario,
            Long scenarioId,
            String scenarioName,
            String scenarioBaseUrl,
            com.ahmedv2.zerostep.scenario.entity.BrowserConfig browserConfig,
            Long recipientUserId
    ) {}
}