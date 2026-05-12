package com.ahmedv2.zerostep.execution.repository;

import com.ahmedv2.zerostep.execution.entity.Execution;
import com.ahmedv2.zerostep.execution.entity.ExecutionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExecutionRepository extends JpaRepository<Execution, Long> {

    // Execution + tüm lazy ilişkileri tek sorguda yükler; ExecutionRunner kullanır
    @Query("""
        SELECT e FROM Execution e
        JOIN FETCH e.scenario s
        JOIN FETCH s.owner
        LEFT JOIN FETCH e.triggeredBy
        WHERE e.id = :id
        """)
    Optional<Execution> findByIdWithAllRelations(@Param("id") Long id);

    // publicId ile execution + scenario + owner yükler
    @Query("""
        SELECT e FROM Execution e
        JOIN FETCH e.scenario sc
        JOIN FETCH sc.owner
        LEFT JOIN FETCH e.triggeredBy
        WHERE e.publicId = :publicId
        """)
    Optional<Execution> findByPublicIdWithScenario(@Param("publicId") UUID publicId);

    @Query("""
        SELECT e FROM Execution e
        WHERE e.scenario.id = :scenarioId
        ORDER BY e.queuedAt DESC
        """)
    Page<Execution> findByScenarioId(@Param("scenarioId") Long scenarioId, Pageable pageable);

    @Query("""
        SELECT COUNT(e) FROM Execution e
        WHERE e.triggeredBy.id = :userId
          AND e.status IN (
              com.ahmedv2.zerostep.execution.entity.ExecutionStatus.QUEUED,
              com.ahmedv2.zerostep.execution.entity.ExecutionStatus.RUNNING
          )
        """)
    long countActiveByUser(@Param("userId") Long userId);

    @Query("""
        SELECT e FROM Execution e
        WHERE e.status = :status
        ORDER BY e.queuedAt ASC
        """)
    List<Execution> findByStatus(@Param("status") ExecutionStatus status);

    // Rapor listesi; tarih filtresi kaldırıldı, statusIsNull flag ile null-safe
    @Query("""
        SELECT e FROM Execution e
        JOIN e.scenario s
        JOIN s.owner o
        WHERE (:scenarioName = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :scenarioName, '%')))
          AND (:statusIsNull = true OR e.status = :status)
          AND (:username = '' OR o.username = :username)
        """)
    Page<Execution> findAllFiltered(
            @Param("scenarioName") String scenarioName,
            @Param("status")       ExecutionStatus status,
            @Param("statusIsNull") boolean statusIsNull,
            @Param("username")     String username,
            Pageable pageable
    );

    // Senaryo özeti için son N execution; scenario ve owner JOIN FETCH ile lazy proxy önlenir
    @Query("""
        SELECT e FROM Execution e
        JOIN FETCH e.scenario s
        JOIN FETCH s.owner
        WHERE e.scenario.publicId = :scenarioPublicId
          AND e.status IN ('COMPLETED','FAILED','CANCELLED','TIMEOUT')
        ORDER BY e.finishedAt DESC NULLS LAST
        """)
    List<Execution> findLastNByScenario(
            @Param("scenarioPublicId") UUID scenarioPublicId,
            Pageable pageable
    );

    // Senaryo için toplam çalıştırma sayısı ve ortalama süre; COALESCE null guard
    @Query("""
        SELECT COUNT(e), COALESCE(AVG(e.durationMs), 0)
        FROM Execution e
        WHERE e.scenario.publicId = :scenarioPublicId
          AND e.status IN ('COMPLETED','FAILED','CANCELLED','TIMEOUT')
        """)
    Object[] findAggregatesByScenario(@Param("scenarioPublicId") UUID scenarioPublicId);
}