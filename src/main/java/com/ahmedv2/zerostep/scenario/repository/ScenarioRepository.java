package com.ahmedv2.zerostep.scenario.repository;

import com.ahmedv2.zerostep.scenario.entity.Scenario;
import com.ahmedv2.zerostep.scenario.entity.ScenarioStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ScenarioRepository extends JpaRepository<Scenario, Long> {

    // Public ID ile; owner da join edilir
    @Query("SELECT s FROM Scenario s JOIN FETCH s.owner WHERE s.publicId = :publicId AND s.deletedAt IS NULL")
    Optional<Scenario> findByPublicIdActive(@Param("publicId") UUID publicId);

    // Tum aktif senaryolar (ADMIN / VIEWER icin); search + status filter
    @Query(value = "SELECT s FROM Scenario s JOIN FETCH s.owner WHERE s.deletedAt IS NULL " +
            "AND (:search = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "     OR LOWER(s.description) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "AND (:status IS NULL OR s.status = :status)",
            countQuery = "SELECT COUNT(s) FROM Scenario s WHERE s.deletedAt IS NULL " +
                    "AND (:search = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
                    "     OR LOWER(s.description) LIKE LOWER(CONCAT('%', :search, '%'))) " +
                    "AND (:status IS NULL OR s.status = :status)")
    Page<Scenario> searchAllActive(@Param("search") String search,
                                   @Param("status") ScenarioStatus status,
                                   Pageable pageable);

    // Sadece kullanicinin kendi senaryolari (TESTER icin)
    @Query(value = "SELECT s FROM Scenario s JOIN FETCH s.owner o WHERE s.deletedAt IS NULL " +
            "AND o.username = :ownerUsername " +
            "AND (:search = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "     OR LOWER(s.description) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "AND (:status IS NULL OR s.status = :status)",
            countQuery = "SELECT COUNT(s) FROM Scenario s JOIN s.owner o WHERE s.deletedAt IS NULL " +
                    "AND o.username = :ownerUsername " +
                    "AND (:search = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
                    "     OR LOWER(s.description) LIKE LOWER(CONCAT('%', :search, '%'))) " +
                    "AND (:status IS NULL OR s.status = :status)")
    Page<Scenario> searchByOwnerActive(@Param("ownerUsername") String ownerUsername,
                                       @Param("search") String search,
                                       @Param("status") ScenarioStatus status,
                                       Pageable pageable);

    // Ayni isimde senaryo var mi? (Owner bazinda; kullanici kendi adi altinda unique)
    boolean existsByNameAndOwnerIdAndDeletedAtIsNull(String name, Long ownerId);
}