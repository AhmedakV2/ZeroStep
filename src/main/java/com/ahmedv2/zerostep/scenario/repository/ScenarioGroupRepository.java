package com.ahmedv2.zerostep.scenario.repository;

import com.ahmedv2.zerostep.scenario.entity.ScenarioGroup;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ScenarioGroupRepository extends JpaRepository<ScenarioGroup, Long> {

    // Public ID'ye göre grubu bulmak için
    Optional<ScenarioGroup> findByPublicId(UUID publicId);

    // Kullanıcının silinmemiş tüm gruplarını listelemek için (Aramasız)
    Page<ScenarioGroup> findByOwnerIdAndDeletedAtIsNull(Long ownerId, Pageable pageable);

    // Kullanıcının silinmemiş gruplarında isme göre arama yapmak için (Aramalı)
    Page<ScenarioGroup> findByOwnerIdAndNameContainingIgnoreCaseAndDeletedAtIsNull(Long ownerId, String name, Pageable pageable);

    // Admin için tüm grupları listelemek
    Page<ScenarioGroup> findByDeletedAtIsNull(Pageable pageable);

    // Admin için gruplarda isme göre arama yapmak
    Page<ScenarioGroup> findByNameContainingIgnoreCaseAndDeletedAtIsNull(String name, Pageable pageable);
}