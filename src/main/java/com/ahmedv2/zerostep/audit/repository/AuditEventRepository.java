package com.ahmedv2.zerostep.audit.repository;

import com.ahmedv2.zerostep.audit.entity.AuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

    Page<AuditEvent> findByOrderByOccurredAtDesc(Pageable pageable);
    Page<AuditEvent> findByEventTypeOrderByOccurredAtDesc(String eventType, Pageable pageable);
}
