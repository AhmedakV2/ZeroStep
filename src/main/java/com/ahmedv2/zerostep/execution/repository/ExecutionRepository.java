package com.ahmedv2.zerostep.execution.repository;

import com.ahmedv2.zerostep.execution.entity.Execution;
import com.ahmedv2.zerostep.execution.entity.ExecutionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExecutionRepository extends JpaRepository<Execution, Long> {

    @Query("SELECT e FROM Execution e JOIN FETCH e.scenario sc JOIN FETCH sc.owner " +
            "WHERE e.publicId = :publicId")
    Optional<Execution> findByPublicIdWithScenario(@Param("publicId") UUID publicId);

    // Senaryo bazli execution gecmisi
    @Query("SELECT e FROM Execution e WHERE e.scenario.id = :scenarioId ORDER BY e.queuedAt DESC")
    Page<Execution> findByScenarioId(@Param("scenarioId") Long scenarioId, Pageable pageable);

    // Kullanicinin aktif (calisiyor veya kuyrukta) execution sayisi; concurrent limit icin
    @Query("SELECT COUNT(e) FROM Execution e WHERE e.triggeredBy.id = :userId " +
            "AND e.status IN (com.ahmedv2.zerostep.execution.entity.ExecutionStatus.QUEUED, " +
            "                  com.ahmedv2.zerostep.execution.entity.ExecutionStatus.RUNNING)")
    long countActiveByUser(@Param("userId") Long userId);

    // Sistem geneli aktif execution'lar; pool kapasitesi kontrolu
    @Query("SELECT e FROM Execution e WHERE e.status = :status ORDER BY e.queuedAt ASC")
    List<Execution> findByStatus(@Param("status") ExecutionStatus status);
    // Filtreleme + pagination için JPQL sorgusu
    @Query("""
        SELECT e FROM Execution e
        JOIN e.scenario s
        JOIN s.owner o
        WHERE (:scenarioId IS NULL OR s.publicId = CAST(:scenarioId AS uuid))
          AND (:status    = '' OR e.status = :status)
          AND (:username  = '' OR o.username = :username)
          AND (:fromDate  IS NULL OR e.startedAt >= :fromDate)
          AND (:toDate    IS NULL OR e.startedAt <= :toDate)
        ORDER BY e.startedAt DESC
        """)
    Page<Execution> findAllFiltered(
            @Param("scenarioId") String scenarioId,
            @Param("status")     String status,
            @Param("username")   String username,
            @Param("fromDate")   Instant fromDate,
            @Param("toDate")     Instant toDate,
            Pageable pageable
    );

    // Senaryo özeti için son N execution
    @Query("""
        SELECT e FROM Execution e
        WHERE e.scenario.publicId = :scenarioPublicId
          AND e.status IN ('COMPLETED','FAILED','CANCELLED','TIMEOUT')
        ORDER BY e.finishedAt DESC
        """)
    List<Execution> findLastNByScenario(
            @Param("scenarioPublicId") UUID scenarioPublicId,
            Pageable pageable
    );

    // Toplam çalışma sayısı ve ortalama süre için
    @Query("""
        SELECT COUNT(e), COALESCE(AVG(e.durationMs), 0)
        FROM Execution e
        WHERE e.scenario.publicId = :scenarioPublicId
          AND e.status IN ('COMPLETED','FAILED','CANCELLED','TIMEOUT')
        """)
    Object[] findAggregatesByScenario(@Param("scenarioPublicId") UUID scenarioPublicId);
}