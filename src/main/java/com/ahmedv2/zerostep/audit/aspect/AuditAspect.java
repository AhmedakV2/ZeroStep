package com.ahmedv2.zerostep.audit.aspect;

import com.ahmedv2.zerostep.audit.annotation.Auditable;
import com.ahmedv2.zerostep.audit.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.util.Map;

// @Auditable taşıyan metodları around advice ile sarmalar
@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditAspect {

    private final AuditService auditService;

    @Around("@annotation(auditable)")
    public Object audit(ProceedingJoinPoint pjp, Auditable auditable) throws Throwable {
        Object result = pjp.proceed();
        try {
            auditService.record(
                    auditable.action(),
                    auditable.entityType().isBlank() ? null : auditable.entityType(),
                    null,
                    Map.of("method", pjp.getSignature().toShortString())
            );
        } catch (Exception e) {
            log.warn("AuditAspect kayit hatasi: {}", e.getMessage());
        }
        return result;
    }
}