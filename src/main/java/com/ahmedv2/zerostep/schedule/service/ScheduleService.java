package com.ahmedv2.zerostep.schedule.service;

import com.ahmedv2.zerostep.common.exception.ForbiddenException;
import com.ahmedv2.zerostep.common.exception.ResourceNotFoundException;
import com.ahmedv2.zerostep.scenario.entity.Scenario;
import com.ahmedv2.zerostep.scenario.repository.ScenarioRepository;
import com.ahmedv2.zerostep.schedule.dto.*;
import com.ahmedv2.zerostep.schedule.entity.JobSchedule;
import com.ahmedv2.zerostep.schedule.repository.JobScheduleRepository;
import com.ahmedv2.zerostep.user.entity.User;
import com.ahmedv2.zerostep.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.NonNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleService {

    private final JobScheduleRepository scheduleRepository;
    private final ScenarioRepository scenarioRepository;
    private final UserRepository userRepository;
    private final ScheduleNextRunCalculator nextRunCalculator;

    @Transactional
    public ScheduleResponse create(UUID scenarioPublicId, ScheduleCreateRequest request,
                                   String username, Set<String> roles) {

        Scenario scenario = scenarioRepository.findByPublicIdActive(scenarioPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("scenario", scenarioPublicId));
        checkWriteAccess(scenario, username, roles);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));

        validateFrequencyFields(request.frequency(), request.runTime(), request.runDayOfWeek());

        JobSchedule schedule = new JobSchedule();
        schedule.setScenario(scenario);
        schedule.setCreatedBy(user);
        schedule.setFrequency(request.frequency());
        schedule.setRunTime(request.runTime());
        schedule.setRunDayOfWeek(request.runDayOfWeek());
        schedule.setTimezone(request.timezone() != null ? request.timezone() : "Europe/Istanbul");
        schedule.setEnabled(true);
        schedule.setRecipients(toArray(request.recipients()));
        schedule.setNotifyOnFailureOnly(request.notifyOnFailureOnly());
        schedule.setNextRunAt(nextRunCalculator.calculateNext(schedule));

        JobSchedule saved = scheduleRepository.save(schedule);
        log.info("Schedule olusturuldu: {} scenario={}", saved.getPublicId(), scenario.getName());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<ScheduleResponse> listMine(String username, Pageable pageable) {
        return scheduleRepository.findByUsername(username, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ScheduleResponse getOne(UUID publicId, String username, Set<String> roles) {
        JobSchedule schedule = findOrThrow(publicId);
        checkReadAccess(schedule, username, roles);
        return toResponse(schedule);
    }

    @Transactional
    public ScheduleResponse update(UUID publicId, ScheduleUpdateRequest request,
                                   String username, Set<String> roles) {
        JobSchedule schedule = findOrThrow(publicId);
        checkWriteAccess(schedule.getScenario(), username, roles);

        if (request.frequency() != null) schedule.setFrequency(request.frequency());
        if (request.runTime() != null) schedule.setRunTime(request.runTime());
        if (request.runDayOfWeek() != null) schedule.setRunDayOfWeek(request.runDayOfWeek());
        if (request.timezone() != null) schedule.setTimezone(request.timezone());
        if (request.recipients() != null) schedule.setRecipients(toArray(request.recipients()));
        if (request.notifyOnFailureOnly() != null) {
            schedule.setNotifyOnFailureOnly(request.notifyOnFailureOnly());
        }

        validateFrequencyFields(schedule.getFrequency(), schedule.getRunTime(),
                schedule.getRunDayOfWeek());
        schedule.setNextRunAt(nextRunCalculator.calculateNext(schedule));

        return toResponse(scheduleRepository.save(schedule));
    }

    @Transactional
    public void delete(UUID publicId, String username, Set<String> roles) {
        JobSchedule schedule = findOrThrow(publicId);
        checkWriteAccess(schedule.getScenario(), username, roles);
        scheduleRepository.delete(schedule);
        log.info("Schedule silindi: {}", publicId);
    }

    @Transactional
    public ScheduleResponse setEnabled(UUID publicId, boolean enabled,
                                       String username, Set<String> roles) {
        JobSchedule schedule = findOrThrow(publicId);
        checkWriteAccess(schedule.getScenario(), username, roles);
        schedule.setEnabled(enabled);
        if (enabled) {
            schedule.setNextRunAt(nextRunCalculator.calculateNext(schedule));
        }
        return toResponse(scheduleRepository.save(schedule));
    }

    // YARDIMCI METODLAR

    private JobSchedule findOrThrow(UUID publicId) {
        return scheduleRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("JobSchedule", publicId));
    }

    private void checkReadAccess(JobSchedule s, String username, Set<String> roles) {
        if (roles.contains("ROLE_ADMIN") || roles.contains("ROLE_VIEWER")) return;
        if (!s.getCreatedBy().getUsername().equals(username)) {
            throw new ForbiddenException("Bu schedul'a erisim yetkiniz yok");
        }
    }

    private void checkWriteAccess(Scenario scenario,String username,Set<String> roles) {
        if(roles.contains("ROLE_ADMIN")) return;
        if(roles.contains("ROLE_VIEWER")) {
            throw new ForbiddenException("VIEWER rolu ile schedule yonetimi yapilamaz");
        }
        if (!scenario.getOwner().getUsername().equals(username)) {
            throw new ForbiddenException("Bu senaryo ait schedule yonetme yetkiniz yokj");
        }
    }

    private void validateFrequencyFields(com.ahmedv2.zerostep.schedule.entity.ScheduleFrequency freq,
                                         String runTime, Short runDayOfWeek) {
        if (freq == null) return;
        switch (freq) {
            case DAILY -> {
                if (runTime == null || runTime.isBlank()) {
                    throw new com.ahmedv2.zerostep.common.exception.ConflictException(
                            "DAILY frequency icin runTime (HH:mm) zorunlu");
                }
            }
            case WEEKLY -> {
                if (runTime == null || runTime.isBlank()) {
                    throw new com.ahmedv2.zerostep.common.exception.ConflictException(
                            "WEEKLY frequency icin runTime  zorunlu");
                }
                if (runDayOfWeek == null) {
                    throw new com.ahmedv2.zerostep.common.exception.ConflictException(
                            "WEEKLY frequency icin runDayOfWeek (1-7) zorunlu");
                }
            }
            case HOURLY -> { /* runTime gerekmez */}
        }
    }

    private String[] toArray(List<String> list) {
        return list== null ? new String[0] : list.toArray(new String[0]);
    }

    private ScheduleResponse toResponse(JobSchedule s) {
        return new ScheduleResponse(
                s.getPublicId(),
                s.getScenario().getPublicId(),
                s.getScenario().getName(),
                s.getCreatedBy().getUsername(),
                s.getFrequency(),
                s.getRunTime(),
                s.getRunDayOfWeek(),
                s.getTimezone(),
                s.isEnabled(),
                s.getLastRunAt(),
                s.getNextRunAt(),
                s.getRecipients() != null ? Arrays.asList(s.getRecipients()) : List.of(),
                s.isNotifyOnFailureOnly(),
                s.getCreatedAt()
        );
    }


}
