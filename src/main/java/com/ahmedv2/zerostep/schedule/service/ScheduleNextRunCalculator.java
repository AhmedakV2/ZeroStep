package com.ahmedv2.zerostep.schedule.service;

import com.ahmedv2.zerostep.schedule.entity.JobSchedule;
import org.springframework.stereotype.Component;

import java.time.*;
import java.time.temporal.TemporalAdjusters;


@Component
public class ScheduleNextRunCalculator {

    public Instant calculateNext(JobSchedule schedule) {
        ZoneId zone = ZoneId.of(schedule.getTimezone());
        ZonedDateTime now = ZonedDateTime.now(zone);

        return switch (schedule.getFrequency()) {
            case HOURLY  -> calcHourly(now);
            case DAILY   -> calcDaily(now, schedule.getRunTime());
            case WEEKLY  -> calcWeekly(now, schedule.getRunTime(), schedule.getRunDayOfWeek());
        };
    }

    // Her saat başı; bir sonraki tam saat
    private Instant calcHourly(ZonedDateTime now) {
        return now.plusHours(1)
                .withMinute(0)
                .withSecond(0)
                .withNano(0)
                .toInstant();
    }

    // Her gün HH:mm; eğer bugün geçtiyse yarın aynı saat
    private Instant calcDaily(ZonedDateTime now, String runTime) {
        LocalTime target = LocalTime.parse(runTime);
        ZonedDateTime candidate = now.toLocalDate().atTime(target).atZone(now.getZone());
        if (!candidate.isAfter(now)) {
            candidate = candidate.plusDays(1);
        }
        return candidate.toInstant();
    }

    // Haftanın belirli günü HH:mm; 1=Pazartesi 7=Pazar
    private Instant calcWeekly(ZonedDateTime now, String runTime, Short runDayOfWeek) {
        LocalTime target = LocalTime.parse(runTime);
        DayOfWeek targetDay = DayOfWeek.of(runDayOfWeek);
        ZonedDateTime candidate = now.toLocalDate()
                .with(TemporalAdjusters.nextOrSame(targetDay))
                .atTime(target)
                .atZone(now.getZone());
        if (!candidate.isAfter(now)) {
            candidate = candidate.plusWeeks(1);
        }
        return candidate.toInstant();
    }
}