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

    private final ExecutionRepository executionRepository;
    private final ExecutionStepResultRepository stepResultRepository;
    private final TestStepRepository stepRepository;
    private final ExecutionLogService logService;
    private final WebDriverPool webDriverPool;
    private final ActionHandlerFactory handlerFactory;
    private final com.ahmedv2.zerostep.execution.sse.SseEventBroadcaster sseBroadcaster;
    private final NotificationService notificationService;
    private final ExecutionMetrics executionMetrics; // Metrics eklendi

    private final ConcurrentHashMap<Long, AtomicBoolean> cancelFlags = new ConcurrentHashMap<>();

    @Async("taskExecutor")
    public void run(Long executionId) {
        log.info("Execution baslatiliyor: id={}", executionId);
        AtomicBoolean cancelFlag = new AtomicBoolean(false);
        cancelFlags.put(executionId, cancelFlag);

        try {
            executeInternal(executionId, cancelFlag);
        } catch (Exception e) {
            log.error("Execution beklenmedik hata; id={}", executionId, e);
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

    // ============================================================
    // Internal: ana execution dongusu
    // ============================================================
    private void executeInternal(Long executionId, AtomicBoolean cancelFlag) {
        Execution execution = startExecution(executionId);
        if (execution == null) return;

        Scenario scenario = execution.getScenario();
        List<TestStep> steps = stepRepository.findAllByScenarioOrdered(scenario.getId());

        if (steps.isEmpty()) {
            logService.warn(execution, null, "Senaryoda hicbir adim yok");
            finalizeExecution(execution.getId(), ExecutionStatus.COMPLETED, null);
            return;
        }

        updateTotalSteps(execution.getId(), steps.size());
        logService.info(execution, null,
                "Senaryo basladi: " + scenario.getName() + " (" + steps.size() + " adim)");

        WebDriver driver = null;
        ExecutionContext context = null;
        boolean anyFailure = false;

        try {
            // Browseri pool'dan al
            driver = webDriverPool.acquire(scenario.getBrowserConfig());
            context = new ExecutionContext(driver, execution, scenario, logService);
            logService.info(execution, null, "Browser baslatildi");

            for (TestStep step : steps) {
                if (cancelFlag.get()) {
                    logService.warn(execution, null, "Execution iptal edildi");
                    finalizeExecution(execution.getId(), ExecutionStatus.CANCELLED,
                            "Kullanici iptal etti");
                    return;
                }

                if (!step.isEnabled()) {
                    ExecutionStepResult skipped = createStepResult(execution, step,
                            StepResultStatus.SKIPPED);
                    stepResultRepository.save(skipped);
                    logService.info(execution, skipped,
                            "Adim atlandi (disabled): " + step.getActionType());
                    incrementCounters(execution.getId(), 0, 0, 1);
                    continue;
                }

                // Step calistir
                ExecutionStepResult result = createStepResult(execution, step,
                        StepResultStatus.RUNNING);
                ExecutionStepResult savedResult = stepResultRepository.save(result);
                context.setCurrentStepResult(savedResult);

                logService.info(execution, savedResult,
                        "Adim basliyor: " + step.getActionType() +
                                (step.getDescription() != null ? " - " + step.getDescription() : ""));

                boolean stepPassed = executeStep(step, context, savedResult);

                if (stepPassed) {
                    incrementCounters(execution.getId(), 1, 0, 0);
                } else {
                    anyFailure = true;
                    incrementCounters(execution.getId(), 0, 1, 0);

                    Boolean continueOnFail = step.getConfig() != null
                            ? step.getConfig().getContinueOnFailure() : null;
                    if (continueOnFail == null || !continueOnFail) {
                        logService.error(execution, null,
                                "Senaryo durdu: continueOnFailure=false");
                        finalizeExecution(execution.getId(), ExecutionStatus.FAILED,
                                "Adim basarisiz: " + step.getActionType());
                        return;
                    }
                }
            }

            ExecutionStatus finalStatus = anyFailure ? ExecutionStatus.FAILED
                    : ExecutionStatus.COMPLETED;
            String finalMsg = anyFailure ? "Bazi adimlar basarisiz" : null;
            finalizeExecution(execution.getId(), finalStatus, finalMsg);
            logService.info(execution, null, "Senaryo bitti: " + finalStatus.name());

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logService.error(execution, null, "Driver acquire kesintiye ugradi");
            finalizeExecution(execution.getId(), ExecutionStatus.FAILED,
                    "Driver alinamadi: interrupted");
        } catch (Exception e) {
            log.error("Execution hata; id={}", executionId, e);
            logService.error(execution, null, "Execution hata: " + e.getMessage());
            finalizeExecution(execution.getId(), ExecutionStatus.FAILED, e.getMessage());
        } finally {
            // Browser'i her durumda iade et
            if (driver != null) {
                boolean keepOpen = scenario.getBrowserConfig() != null
                        && scenario.getBrowserConfig().isKeepBrowserOpen();
                if (keepOpen) {
                    logService.info(execution, null,
                            "keepBrowserOpen=true; browser acik birakildi (DEV)");
                    // Yine de pool'a iade et; aksi halde slot dolu kalir
                }
                webDriverPool.release(driver);
            }
        }
    }

    // ============================================================
    // Step executor: handler'a delege
    // ============================================================
    private boolean executeStep(TestStep step, ExecutionContext context,
                                ExecutionStepResult result) {
        Instant start = Instant.now();
        Integer retryCount = step.getConfig() != null && step.getConfig().getRetryCount() != null
                ? step.getConfig().getRetryCount() : 0;
        int maxAttempts = Math.max(1, retryCount + 1);
        Exception lastError = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                ActionHandler handler = handlerFactory.require(step.getActionType());
                handler.execute(step, context);

                // Post delay (varsa)
                Integer postDelay = step.getConfig() != null
                        ? step.getConfig().getPostDelayMs() : null;
                if (postDelay != null && postDelay > 0) {
                    Thread.sleep(postDelay);
                }

                markStepFinished(result.getId(), StepResultStatus.PASSED, null, start,
                        result.getScreenshotPath());
                return true;

            } catch (UnsupportedOperationException e) {
                // Handler henuz yok; FAILED ama retry yapma
                String msg = "Handler bulunamadi: " + step.getActionType().name();
                logService.error(context.getExecution(), result, msg);
                markStepFinished(result.getId(), StepResultStatus.FAILED, msg, start,
                        result.getScreenshotPath());
                return false;

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                lastError = e;
                break;

            } catch (Exception e) {
                lastError = e;
                logService.warn(context.getExecution(), result,
                        "Adim hata (attempt " + attempt + "/" + maxAttempts + "): "
                                + e.getMessage());
                if (attempt < maxAttempts) {
                    try {
                        Thread.sleep(500); // Retry oncesi kucuk bekleme
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }

        // Tum denemeler basarisiz
        String errorMsg = lastError != null ? lastError.getMessage() : "Bilinmeyen hata";
        logService.error(context.getExecution(), result, "Adim basarisiz: " + errorMsg);
        markStepFinished(result.getId(), StepResultStatus.FAILED, errorMsg, start,
                result.getScreenshotPath());
        return false;
    }

    // ============================================================
    // DB metodlari (ayri kucuk transaction)
    // ============================================================

    @Transactional
    protected Execution startExecution(Long executionId) {
        Execution execution = executionRepository.findById(executionId).orElse(null);
        if (execution == null) {
            log.error("Execution bulunamadi: {}", executionId);
            return null;
        }
        execution.setStatus(ExecutionStatus.RUNNING);

        // Metrics: Started kaydi eklendi
        executionMetrics.recordStarted();

        execution.setStartedAt(Instant.now());
        return executionRepository.save(execution);
    }

    @Transactional
    protected void updateTotalSteps(Long executionId, int total) {
        executionRepository.findById(executionId).ifPresent(e -> {
            e.setTotalSteps(total);
            executionRepository.save(e);
        });
    }

    @Transactional
    protected void incrementCounters(Long executionId, int passed, int failed, int skipped) {
        executionRepository.findById(executionId).ifPresent(e -> {
            e.setPassedSteps(e.getPassedSteps() + passed);
            e.setFailedSteps(e.getFailedSteps() + failed);
            e.setSkippedSteps(e.getSkippedSteps() + skipped);
            executionRepository.save(e);
        });
    }

    @Transactional
    protected void finalizeExecution(Long executionId, ExecutionStatus status, String errorMsg) {
        executionRepository.findById(executionId).ifPresent(e -> {
            Instant now = Instant.now();
            e.setStatus(status);
            e.setFinishedAt(now);
            if (e.getStartedAt() != null) {
                e.setDurationMs(Duration.between(e.getStartedAt(), now).toMillis());
            }
            if (errorMsg != null) e.setErrorMessage(errorMsg);
            executionRepository.save(e);

            // Metrics
            if (status == ExecutionStatus.COMPLETED) {
                executionMetrics.recordCompleted();
            } else if (status == ExecutionStatus.FAILED || status == ExecutionStatus.TIMEOUT) {
                executionMetrics.recordFailed();
            }

            // Notification
            if (e.getTriggeredBy() != null && status.isTerminal()) {
                notificationService.notifyExecutionFinished(
                        e.getTriggeredBy().getId(),
                        e.getScenario().getName(),
                        status.name(),
                        e.getPublicId()
                );
            }
        });

        // SSE BİTİŞ YAYINI
        sseBroadcaster.publishCompletion(executionId, status.name());
    }

    @Transactional
    protected void markFailed(Long executionId, String errorMsg) {
        finalizeExecution(executionId, ExecutionStatus.FAILED, errorMsg);
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
}