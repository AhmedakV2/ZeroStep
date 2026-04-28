package com.ahmedv2.zerostep.step.entity;

import com.ahmedv2.zerostep.common.entity.BaseEntity;
import com.ahmedv2.zerostep.scenario.entity.Scenario;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "test_steps")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class TestStep extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id",unique = true,nullable = false,updatable = false)
    private UUID publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scenario_id")
    private Scenario scenario;

    @Column(name = "step_order",nullable = false)
    private  Double stepOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type",nullable = false,length = 48)
    private ActionType actionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "selector_type",length = 32)
    private SelectorType selectorType;

    @Column(name = "selector_value",length = 2048)
    private String selectorValue;

    @Column(name = "input_value",columnDefinition = "TEXT")
    private String inputValue;

    @Column(name = "secondary_value",columnDefinition = "TEXT")
    private String secondaryValue;

    @Column(length = 500)
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false,columnDefinition = "jsonb")
    private TestStepConfig config = new TestStepConfig();

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PrePersist
    public void prePersist(){
        if(publicId == null){
            publicId = UUID.randomUUID();
        }
        if(config == null){
            config = new TestStepConfig();
        }
    }
}
