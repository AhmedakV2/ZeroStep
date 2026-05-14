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

    // Public ID ile; owner da join edilir (group bilgisi de fetch edilebilir)
    @Query("SELECT s FROM Scenario s JOIN FETCH s.owner LEFT JOIN FETCH s.group WHERE s.publicId = :publicId AND s.deletedAt IS NULL")
    Optional<Scenario> findByPublicIdActive(@Param("publicId") UUID publicId);

    // Tum aktif senaryolar (ADMIN / VIEWER icin); search + status + YENI: groupId filter
    @Query(value = "SELECT s FROM Scenario s JOIN FETCH s.owner LEFT JOIN FETCH s.group WHERE s.deletedAt IS NULL " +
            "AND (:groupId IS NULL OR s.group.id = :groupId) " +
            "AND (:search = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "     OR LOWER(s.description) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "AND (:status IS NULL OR s.status = :status)",
            countQuery = "SELECT COUNT(s) FROM Scenario s WHERE s.deletedAt IS NULL " +
                    "AND (:groupId IS NULL OR s.group.id = :groupId) " +
                    "AND (:search = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
                    "     OR LOWER(s.description) LIKE LOWER(CONCAT('%', :search, '%'))) " +
                    "AND (:status IS NULL OR s.status = :status)")
    Page<Scenario> searchAllActive(@Param("search") String search,
                                   @Param("status") ScenarioStatus status,
                                   @Param("groupId") Long groupId,
                                   Pageable pageable);

    // Sadece kullanicinin kendi senaryolari (TESTER icin); search + status + YENI: groupId filter
    @Query(value = "SELECT s FROM Scenario s JOIN FETCH s.owner o LEFT JOIN FETCH s.group WHERE s.deletedAt IS NULL " +
            "AND o.username = :ownerUsername " +
            "AND (:groupId IS NULL OR s.group.id = :groupId) " +
            "AND (:search = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "     OR LOWER(s.description) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "AND (:status IS NULL OR s.status = :status)",
            countQuery = "SELECT COUNT(s) FROM Scenario s JOIN s.owner o WHERE s.deletedAt IS NULL " +
                    "AND o.username = :ownerUsername " +
                    "AND (:groupId IS NULL OR s.group.id = :groupId) " +
                    "AND (:search = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
                    "     OR LOWER(s.description) LIKE LOWER(CONCAT('%', :search, '%'))) " +
                    "AND (:status IS NULL OR s.status = :status)")
    Page<Scenario> searchByOwnerActive(@Param("ownerUsername") String ownerUsername,
                                       @Param("search") String search,
                                       @Param("status") ScenarioStatus status,
                                       @Param("groupId") Long groupId,
                                       Pageable pageable);

    // Ayni isimde senaryo var mi? (Owner bazinda; kullanici kendi adi altinda unique)
    boolean existsByNameAndOwnerIdAndDeletedAtIsNull(String name, Long ownerId);

    // -------------------------------------------------------------------------
    // YENI EKLENEN BASIT SORGULAR (Gelecekte lazim olabilecek spesifik isler icin)
    // -------------------------------------------------------------------------

    // Belirli bir gruba ait senaryoları çekmek için (Filtresiz düz listeleme)
    Page<Scenario> findByGroupIdAndOwnerIdAndDeletedAtIsNull(Long groupId, Long ownerId, Pageable pageable);

    // Grubu olmayan (eski) senaryoları bulmak için (Migration/Varsayılan Grup işlemleri için)
    Page<Scenario> findByGroupIdIsNullAndOwnerIdAndDeletedAtIsNull(Long ownerId, Pageable pageable);
}