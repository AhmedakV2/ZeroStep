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

    @Query("SELECT e FROM Execution e WHERE e.scenario.id = :scenarioId ORDER BY e.queuedAt DESC")
    Page<Execution> findByScenarioId(@Param("scenarioId") Long scenarioId, Pageable pageable);

    @Query("SELECT COUNT(e) FROM Execution e WHERE e.triggeredBy.id = :userId " +
            "AND e.status IN (com.ahmedv2.zerostep.execution.entity.ExecutionStatus.QUEUED, " +
            "                  com.ahmedv2.zerostep.execution.entity.ExecutionStatus.RUNNING)")
    long countActiveByUser(@Param("userId") Long userId);

    @Query("SELECT e FROM Execution e WHERE e.status = :status ORDER BY e.queuedAt ASC")
    List<Execution> findByStatus(@Param("status") ExecutionStatus status);

    // KESİN ÇÖZÜM: Null kontrolünü Java'ya (statusIsNull) bıraktık.
    // ORDER BY kaldırıldı, sıralamayı Frontend (sort=startedAt,desc) yapacak.
    @Query("""
        SELECT e FROM Execution e
        JOIN e.scenario s
        JOIN s.owner o
        WHERE (:scenarioName = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :scenarioName, '%')))
          AND (:statusIsNull = true OR e.status = :status)
          AND (:username = '' OR o.username = :username)
          AND (e.startedAt >= :fromDate)
          AND (e.startedAt <= :toDate)
        """)
    Page<Execution> findAllFiltered(
            @Param("scenarioName") String scenarioName,
            @Param("status")       ExecutionStatus status,
            @Param("statusIsNull") boolean statusIsNull,
            @Param("username")     String username,
            @Param("fromDate")     Instant fromDate,
            @Param("toDate")       Instant toDate,
            Pageable pageable
    );

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

    @Query("""
        SELECT COUNT(e), COALESCE(AVG(e.durationMs), 0)
        FROM Execution e
        WHERE e.scenario.publicId = :scenarioPublicId
          AND e.status IN ('COMPLETED','FAILED','CANCELLED','TIMEOUT')
        """)
    Object[] findAggregatesByScenario(@Param("scenarioPublicId") UUID scenarioPublicId);
}