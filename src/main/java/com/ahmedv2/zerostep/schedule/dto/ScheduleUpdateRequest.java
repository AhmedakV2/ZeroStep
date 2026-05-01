package com.ahmedv2.zerostep.schedule.dto;

import com.ahmedv2.zerostep.schedule.entity.ScheduleFrequency;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public record ScheduleUpdateRequest(

        ScheduleFrequency frequency,

        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$",
                message = "runTime HH:mm formatında olmalı")
        String runTime,

        @Min(1) @Max(7)
        Short runDayOfWeek,

        String timezone,

        List<@Email String> recipients,



        Boolean notifyOnFailureOnly
) {}
