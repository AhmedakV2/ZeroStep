package com.ahmedv2.zerostep.schedule.repository;

import com.ahmedv2.zerostep.schedule.entity.JobSchedule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobScheduleRepository extends JpaRepository<JobSchedule, Long> {

    @Query("SELECT j FROM JobSchedule j JOIN FETCH j.scenario s JOIN FETCH j.createdBy " +
            "WHERE j.publicId = :publicId")
    Optional<JobSchedule> findByPublicId(@Param("publicId") UUID publicId);

    // Kullanıcının kendi schedule'ları
    @Query("SELECT j FROM JobSchedule j JOIN FETCH j.scenario JOIN FETCH j.createdBy " +
            "WHERE j.createdBy.username = :username")
    Page<JobSchedule> findByUsername(@Param("username") String username, Pageable pageable);

    // Scheduler: şu an çalışması gereken aktif job'lar
    @Query("SELECT j FROM JobSchedule j JOIN FETCH j.scenario s JOIN FETCH s.owner " +
            "WHERE j.enabled = TRUE AND j.nextRunAt IS NOT NULL AND j.nextRunAt <= :now")
    List<JobSchedule> findDueSchedules(@Param("now") Instant now);
}