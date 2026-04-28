package com.ahmedv2.zerostep.step.repository;

import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TestStepRepository extends JpaRepository<TestStep, Long> {

    // Public ID ile aktif step + scenario join
    @Query("SELECT s FROM TestStep s JOIN FETCH s.scenario sc JOIN FETCH sc.owner " +
            "WHERE s.publicId = :publicId AND s.deletedAt IS NULL")
    Optional<TestStep> findByPublicIdActive(@Param("publicId") UUID publicId);

    // Senaryonun tum aktif adimlari, sirali
    @Query("SELECT s FROM TestStep s WHERE s.scenario.id = :scenarioId AND s.deletedAt IS NULL " +
            "ORDER BY s.stepOrder ASC")
    List<TestStep> findAllByScenarioOrdered(@Param("scenarioId") Long scenarioId);

    // En son adimin order'i; append icin
    @Query("SELECT MAX(s.stepOrder) FROM TestStep s " +
            "WHERE s.scenario.id = :scenarioId AND s.deletedAt IS NULL")
    Optional<Double> findMaxStepOrder(@Param("scenarioId") Long scenarioId);

    // Belirli order'in oncesi; reorder hesabi icin
    @Query("SELECT s FROM TestStep s WHERE s.scenario.id = :scenarioId AND s.deletedAt IS NULL " +
            "AND s.stepOrder < :order ORDER BY s.stepOrder DESC LIMIT 1")
    Optional<TestStep> findPreviousStep(@Param("scenarioId") Long scenarioId,
                                        @Param("order") Double order);

    // Belirli order'in sonrasi
    @Query("SELECT s FROM TestStep s WHERE s.scenario.id = :scenarioId AND s.deletedAt IS NULL " +
            "AND s.stepOrder > :order ORDER BY s.stepOrder ASC LIMIT 1")
    Optional<TestStep> findNextStep(@Param("scenarioId") Long scenarioId,
                                    @Param("order") Double order);

    long countByScenarioIdAndDeletedAtIsNull(Long scenarioId);
}