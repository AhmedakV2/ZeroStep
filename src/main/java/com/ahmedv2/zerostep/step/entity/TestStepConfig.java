package com.ahmedv2.zerostep.step.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TestStepConfig {

    private Integer timeoutSeconds;

    private Integer retryCount;

    private Boolean screenshotOnFail;

    private Integer postDelayMs;

    private Boolean continueOnFailure;

    private Boolean caseInsensitive;

    private Boolean logScriptResult;

    private Integer sleepMin;

    private Integer sleepMax;

    private String countOperator;

    private Boolean caseInsensitive;

    private String countOperator;

    private Boolean logScriptResult;
}
