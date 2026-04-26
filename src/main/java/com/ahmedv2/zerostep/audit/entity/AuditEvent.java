package com.ahmedv2.zerostep.audit.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "audit_events")
@Getter
@Setter
@NoArgsConstructor
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_name", nullable = false, length = 64)
    private String actorName;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "entity_type",length = 64)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;


    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload",nullable = false,columnDefinition = "jsonb")
    private Map<String, Object> payload = new HashMap<>();

    @Column(name="ipAddress",length = 45)
    private String ipAddress;

    @Column(name = "user_agent",length = 255)
    private String userAgent;

    @Column(name = "occurred_at",nullable = false,updatable = false)
    private Instant occurredAt;


    @PrePersist
    void onCreate(){
        if(occurredAt==null){
            occurredAt = Instant.now();
        }

    }
}
