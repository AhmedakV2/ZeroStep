package com.ahmedv2.zerostep.schedule.runner;

import com.ahmedv2.zerostep.execution.dto.ExecutionStartRequest;
import com.ahmedv2.zerostep.execution.entity.Execution;
import com.ahmedv2.zerostep.execution.entity.ExecutionStatus;
import com.ahmedv2.zerostep.execution.entity.TriggerType;
import com.ahmedv2.zerostep.execution.repository.ExecutionRepository;
import com.ahmedv2.zerostep.execution.runner.ExecutionRunner;
import com.ahmedv2.zerostep.mail.service.MailService;
import com.ahmedv2.zerostep.schedule.entity.JobSchedule;
import com.ahmedv2.zerostep.schedule.repository.JobScheduleRepository;
import com.ahmedv2.zerostep.schedule.service.ScheduleNextRunCalculator;
import com.ahmedv2.zerostep.step.repository.TestStepRepository;
import com.ahmedv2.zerostep.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

// Her dakika çalışır; due olan schedule'ları bulup execution başlatır
@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduledJobRunner {

    private final JobScheduleRepository scheduleRepository;
    private final ExecutionRepository executionRepository;
    private final ExecutionRunner executionRunner;
    private final ScheduleNextRunCalculator nextRunCalculator;
    private final TestStepRepository testStepRepository;
    private final MailService mailService;

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

    private void triggerSchedule(JobSchedule schedule) {
        long stepCount = testStepRepository.countByScenarioIdAndDeletedAtIsNull(
                schedule.getScenario().getId());
        if (stepCount == 0) {
            log.warn("Schedule atlandı (adım yok): {}", schedule.getPublicId());
            updateNextRun(schedule);
            return;
        }

        // Execution kaydı oluştur
        Execution execution = new Execution();
        execution.setScenario(schedule.getScenario());
        execution.setTriggeredBy(schedule.getCreatedBy());
        execution.setTriggeredByName(schedule.getCreatedBy().getUsername());
        execution.setTriggerType(TriggerType.SCHEDULED);
        execution.setStatus(ExecutionStatus.QUEUED);
        Execution saved = executionRepository.save(execution);

        // Async runner'ı tetikle; execution tamamlanınca mail gönder
        executionRunner.run(saved.getId());

        // nextRunAt güncelle ve lastRunAt kaydet
        schedule.setLastRunAt(Instant.now());
        schedule.setNextRunAt(nextRunCalculator.calculateNext(schedule));
        scheduleRepository.save(schedule);

        // Mail recipients varsa; execution tamamlandıktan sonra gönderilmesi için
        // event dinleyici yaklaşımı yerine post-execution callback ile çözeceğiz (aşağıda)
        if (schedule.getRecipients() != null && schedule.getRecipients().length > 0) {
            schedulePostExecutionMail(saved.getId(), schedule);
        }

        log.info("Scheduled execution başlatıldı: scenarioId={} executionId={}",
                schedule.getScenario().getId(), saved.getId());
    }

    private void schedulePostExecutionMail(Long executionId, JobSchedule schedule) {
        // Ayrı thread'de polling ile bekler; runner'ın async doğasını bozmaz
        Thread.ofVirtual().start(() -> {
            try {
                Execution execution = waitForCompletion(executionId);
                if (execution == null) return;

                boolean shouldSend = !schedule.isNotifyOnFailureOnly()
                        || execution.getStatus() == ExecutionStatus.FAILED;

                if (shouldSend && schedule.getRecipients().length > 0) {
                    List<String> recipients = Arrays.asList(schedule.getRecipients());
                    mailService.sendExecutionResult(execution, recipients);
                }
            } catch (Exception e) {
                log.error("Post-execution mail gönderilemedi: executionId={}", executionId, e);
            }
        });
    }

    // Execution terminal duruma gelene kadar polling ile bekler; max 30 dakika
    private Execution waitForCompletion(Long executionId) {
        int maxAttempts = 360; // 30 dakika (5sn aralıkla)
        for (int i = 0; i < maxAttempts; i++) {
            try {
                Thread.sleep(5_000L);
                Execution exec = executionRepository.findById(executionId).orElse(null);
                if (exec != null && exec.getStatus().isTerminal()) {
                    return exec;
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return null;
            }
        }
        log.warn("Execution terminal olmadı; mail atlandı: executionId={}", executionId);
        return null;
    }

    private void updateNextRun(JobSchedule schedule) {
        schedule.setNextRunAt(nextRunCalculator.calculateNext(schedule));
        scheduleRepository.save(schedule);
    }
}