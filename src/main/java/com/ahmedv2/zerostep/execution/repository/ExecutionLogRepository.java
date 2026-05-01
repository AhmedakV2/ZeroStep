package com.ahmedv2.zerostep.execution.repository;

import com.ahmedv2.zerostep.execution.entity.ExecutionLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExecutionLogRepository extends JpaRepository<ExecutionLog, Long> {

    @Query("SELECT l FROM ExecutionLog l WHERE l.execution.id = :executionId " +
            "ORDER BY l.occurredAt ASC")
    Page<ExecutionLog> findByExecutionId(@Param("executionId") Long executionId, Pageable pageable);

    // Belirli ID'den sonraki log'lar; SSE polling icin (Faz 5C'de SSE'ye gececegiz)
    @Query("SELECT l FROM ExecutionLog l WHERE l.execution.id = :executionId " +
            "AND l.id > :afterId ORDER BY l.id ASC")
    List<ExecutionLog> findAfterIdByExecution(@Param("executionId") Long executionId,
                                              @Param("afterId") Long afterId);
}