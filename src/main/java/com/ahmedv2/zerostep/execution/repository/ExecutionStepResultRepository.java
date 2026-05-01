package com.ahmedv2.zerostep.execution.repository;

import com.ahmedv2.zerostep.execution.entity.ExecutionStepResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExecutionStepResultRepository extends JpaRepository<ExecutionStepResult, Long> {

    @Query("SELECT sr FROM ExecutionStepResult sr WHERE sr.execution.id = :executionId " +
            "ORDER BY sr.stepOrder ASC")
    List<ExecutionStepResult> findByExecutionIdOrdered(@Param("executionId") Long executionId);
}