package com.ahmedv2.zerostep.schedule.entity;


import com.ahmedv2.zerostep.scenario.entity.Scenario;
import com.ahmedv2.zerostep.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "job_schedules")
@Getter
@Setter
@NoArgsConstructor
public class JobSchedule {

    @Id
    @GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id" , unique = true,nullable = false,updatable = false)
    private UUID publicId;

    @ManyToOne(fetch = FetchType.LAZY,optional = false)
    @JoinColumn(name = "scenario_id")
    private Scenario scenario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ScheduleFrequency frequency;

    @Column(name = "run_time", length = 5)
    private String runTime;

    @Column(name = "run_day_of_week")
    private Short runDayOfWeek;

    @Column(nullable = false, length = 64)
    private String timezone = "Europe/Istanbul";

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "last_run_at")
    private Instant lastRunAt;

    @Column(name = "next_run_at")
    private Instant nextRunAt;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private String[] recipients = new String[0];

    @Column(name = "notify_on_failure_only", nullable = false)
    private boolean notifyOnFailureOnly = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (publicId == null) publicId = UUID.randomUUID();
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
