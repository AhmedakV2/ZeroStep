package com.ahmedv2.zerostep.schedule.dto;

import com.ahmedv2.zerostep.schedule.entity.ScheduleFrequency;
import jakarta.validation.constraints.*;

import java.util.List;

public record ScheduleCreateRequest(

        @NotNull(message = "Frequnecy zorunlu")
        ScheduleFrequency frequency,

        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$",
                message = "runTime HH:mm formatında olmalı")
        String runTime,

        @Min(1) @Max(7)
        Short runDayOfWeek,

        @NotBlank
        String timezone,

        List<@Email String> recipients,

        boolean notifyOnFailureOnly
) {}
