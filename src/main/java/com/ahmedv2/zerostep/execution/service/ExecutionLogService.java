package com.ahmedv2.zerostep.execution.service;

import com.ahmedv2.zerostep.execution.dto.ExecutionLogResponse;
import com.ahmedv2.zerostep.execution.entity.Execution;
import com.ahmedv2.zerostep.execution.entity.ExecutionLog;
import com.ahmedv2.zerostep.execution.entity.ExecutionStepResult;
import com.ahmedv2.zerostep.execution.entity.LogLevel;
import com.ahmedv2.zerostep.execution.repository.ExecutionLogRepository;
import com.ahmedv2.zerostep.execution.sse.SseEventBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExecutionLogService {

    private final ExecutionLogRepository logRepository;
    private final SseEventBroadcaster broadcaster;

    // REQUIRES_NEW: log yazimi runner'in transaction'i ile karismaz
    // DB save sonrasi broadcaster'a push; SSE client'lar canli gorur
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(Execution execution, ExecutionStepResult stepResult,
                    LogLevel level, String message) {
        try {
            ExecutionLog logEntity = new ExecutionLog();
            logEntity.setExecution(execution);
            logEntity.setStepResult(stepResult);
            logEntity.setLogLevel(level);
            logEntity.setMessage(message);
            ExecutionLog saved = logRepository.save(logEntity);

            // SSE push; transaction commit'inden once de calissa client gorur
            // Client zaten DB'den okumuyor, broadcaster icindeki dto'yu okuyor
            broadcaster.publishLog(execution.getId(), toResponse(saved, stepResult));
        } catch (Exception e) {
            log.error("Execution log yazilamadi: execId={} msg={}",
                    execution.getId(), message, e);
        }
    }

    public void info(Execution execution, ExecutionStepResult stepResult, String message) {
        log(execution, stepResult, LogLevel.INFO, message);
    }

    public void warn(Execution execution, ExecutionStepResult stepResult, String message) {
        log(execution, stepResult, LogLevel.WARN, message);
    }

    public void error(Execution execution, ExecutionStepResult stepResult, String message) {
        log(execution, stepResult, LogLevel.ERROR, message);
    }

    public void debug(Execution execution, ExecutionStepResult stepResult, String message) {
        log(execution, stepResult, LogLevel.DEBUG, message);
    }

    private ExecutionLogResponse toResponse(ExecutionLog l, ExecutionStepResult sr) {
        return new ExecutionLogResponse(
                l.getId(),
                sr != null ? sr.getId() : null,
                l.getLogLevel(),
                l.getMessage(),
                l.getOccurredAt()
        );
    }
}