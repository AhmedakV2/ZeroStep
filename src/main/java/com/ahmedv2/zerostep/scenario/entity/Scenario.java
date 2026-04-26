package com.ahmedv2.zerostep.scenario.entity;

import com.ahmedv2.zerostep.common.entity.BaseEntity;
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
@Table(name = "scenarios")
@Getter
@Setter
@NoArgsConstructor
public class Scenario extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", unique = true,nullable = false,updatable = false)
    private UUID publicId;

    @ManyToOne(fetch = FetchType.LAZY,optional = false)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false,length = 32)
    private ScenarioStatus status = ScenarioStatus.DRAFT;

    @Column(name="base_url",length = 1024)
    private String baseUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "browser_config",nullable = false,columnDefinition = "jsonb")
    private BrowserConfig browserConfig = new BrowserConfig();

    @Column(nullable = false,columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] tags = new String[0];

    @Column(name = "deleted_at")
    private Instant deletedAt;


    @PrePersist
    public void prePersist(){
        if(publicId == null) {
            publicId = UUID.randomUUID();
        }
        if(browserConfig == null) {
            browserConfig = new BrowserConfig();
        }
        if(tags == null){
            tags = new String[0];
        }
    }

    public void markReady(){
        if(this.status == ScenarioStatus.ARCHIVED) {
            throw new IllegalStateException("Arsivlenmis senaryo READY yapilmaz");
        }
        this.status = ScenarioStatus.READY;
    }

    public void archive() {
        if(this.status == ScenarioStatus.ARCHIVED) {
            throw new IllegalStateException("Senaryo zaten arsivli");
        }
        this.status = ScenarioStatus.READY;
    }

    public void unarchive() {
        if(this.status != ScenarioStatus.ARCHIVED){
            throw new IllegalStateException("Sedece arsivli senaryo unarchive edilebilir");
        }
        this.status = ScenarioStatus.DRAFT;

    }
}
