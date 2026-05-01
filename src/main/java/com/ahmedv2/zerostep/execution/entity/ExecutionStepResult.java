package com.ahmedv2.zerostep.execution.entity;

import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "execution_step_results")
@Getter
@Setter
@NoArgsConstructor
public class ExecutionStepResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "execution_id")
    private Execution execution;

    // Step silinmis olabilir; SET NULL
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_step_id")
    private TestStep testStep;

    @Column(name = "step_order", nullable = false)
    private Double stepOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 48)
    private ActionType actionType;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private StepResultStatus status = StepResultStatus.RUNNING;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "screenshot_path", length = 512)
    private String screenshotPath;

    @PrePersist
    void prePersist() {
        if (startedAt == null) startedAt = Instant.now();
    }
}