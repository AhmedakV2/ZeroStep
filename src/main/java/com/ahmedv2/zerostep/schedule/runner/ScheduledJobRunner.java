package com.ahmedv2.zerostep.schedule.runner;

import com.ahmedv2.zerostep.execution.entity.Execution;
import com.ahmedv2.zerostep.execution.entity.ExecutionStatus;
import com.ahmedv2.zerostep.execution.entity.TriggerType;
import com.ahmedv2.zerostep.execution.repository.ExecutionRepository;
import com.ahmedv2.zerostep.execution.runner.ExecutionRunner;
import com.ahmedv2.zerostep.mail.service.MailService;
import com.ahmedv2.zerostep.notification.service.NotificationService;
import com.ahmedv2.zerostep.schedule.entity.JobSchedule;
import com.ahmedv2.zerostep.schedule.repository.JobScheduleRepository;
import com.ahmedv2.zerostep.schedule.service.ScheduleNextRunCalculator;
import com.ahmedv2.zerostep.step.repository.TestStepRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduledJobRunner {

    private final JobScheduleRepository     scheduleRepository;
    private final ExecutionRepository       executionRepository;
    private final ExecutionRunner           executionRunner;
    private final ScheduleNextRunCalculator nextRunCalculator;
    private final TestStepRepository        testStepRepository;
    private final MailService               mailService;
    private final NotificationService       notificationService;

    @Scheduled(fixedDelay = 60_000L)
    @Transactional
    public void runDueSchedules() {
        List<JobSchedule> dueSchedules = scheduleRepository.findDueSchedules(Instant.now());
        if (dueSchedules.isEmpty()) return;

        log.info("Scheduled runner: {} due job bulundu", dueSchedules.size());
        for (JobSchedule schedule : dueSchedules) {
            try {
                triggerSchedule(schedule);
            } catch (Exception e) {
                log.error("Schedule tetiklenirken hata: publicId={}", schedule.getPublicId(), e);
            }
        }
    }

    /**
     * @Transactional scope içinde tüm lazy ilişkilere güvenle erişilir.
     * executionRunner.run() afterCommit()'e ertelenerek race condition önlenir.
     */
    @Transactional
    protected void triggerSchedule(JobSchedule schedule) {
        // Lazy ilişkileri transaction içinde snapshot'a al
        Long   scenarioId     = schedule.getScenario().getId();
        String scenarioName   = schedule.getScenario().getName();
        Long   createdById    = schedule.getCreatedBy().getId();
        String createdByName  = schedule.getCreatedBy().getUsername();
        String[] recipients   = schedule.getRecipients();
        boolean failureOnly   = schedule.isNotifyOnFailureOnly();
        UUID schedulePublicId = schedule.getPublicId();

        long stepCount = testStepRepository.countByScenarioIdAndDeletedAtIsNull(scenarioId);
        if (stepCount == 0) {
            log.warn("Schedule atlandı (adım yok): {}", schedulePublicId);
            schedule.setNextRunAt(nextRunCalculator.calculateNext(schedule));
            scheduleRepository.save(schedule);
            return;
        }

        Execution execution = new Execution();
        execution.setScenario(schedule.getScenario());
        execution.setTriggeredBy(schedule.getCreatedBy());
        execution.setTriggeredByName(createdByName);
        execution.setTriggerType(TriggerType.SCHEDULED);
        execution.setStatus(ExecutionStatus.QUEUED);
        Execution saved = executionRepository.save(execution);
        final Long savedId = saved.getId();

        schedule.setLastRunAt(Instant.now());
        schedule.setNextRunAt(nextRunCalculator.calculateNext(schedule));
        scheduleRepository.save(schedule);

        // Bildirim — snapshot değerleri kullan, lazy proxy yok
        notificationService.notifyScheduleTriggered(createdById, scenarioName, saved.getPublicId());

        // afterCommit: runner ancak DB commit olduktan sonra başlar
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        log.debug("TX commit OK → ScheduledRunner başlatılıyor: id={}", savedId);
                        executionRunner.run(savedId);

                        // Mail için virtual thread — snapshot değerleri capture edildi
                        if (recipients != null && recipients.length > 0) {
                            final List<String> mails = Arrays.asList(recipients);
                            Thread.ofVirtual().start(() ->
                                    sendPostExecutionMail(savedId, mails, failureOnly));
                        }
                    }
                }
        );

        log.info("Scheduled execution kuyruğa alındı: scenarioId={} executionId={}",
                scenarioId, savedId);
    }

    private void sendPostExecutionMail(Long executionId,
                                       List<String> recipients,
                                       boolean notifyOnFailureOnly) {
        try {
            Execution execution = waitForCompletion(executionId);
            if (execution == null) return;

            boolean shouldSend = !notifyOnFailureOnly
                    || execution.getStatus() == ExecutionStatus.FAILED;

            if (shouldSend) {
                mailService.sendExecutionResult(execution, recipients);
            }
        } catch (Exception e) {
            log.error("Post-execution mail gönderilemedi: executionId={}", executionId, e);
        }
    }

    // Terminal duruma gelene kadar polling ile bekle (max 30 dk)
    private Execution waitForCompletion(Long executionId) {
        for (int i = 0; i < 360; i++) {
            try {
                Thread.sleep(5_000L);
                Execution exec = executionRepository.findById(executionId).orElse(null);
                if (exec != null && exec.getStatus().isTerminal()) return exec;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return null;
            }
        }
        log.warn("Execution terminal olmadı; mail atlandı: executionId={}", executionId);
        return null;
    }
}