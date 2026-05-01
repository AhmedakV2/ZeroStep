package com.ahmedv2.zerostep.execution.driver;

import com.ahmedv2.zerostep.execution.entity.Execution;
import com.ahmedv2.zerostep.execution.entity.ExecutionStepResult;
import com.ahmedv2.zerostep.execution.service.ExecutionLogService;
import com.ahmedv2.zerostep.scenario.entity.Scenario;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebDriver;


@Getter
@RequiredArgsConstructor
public class ExecutionContext {

    private final WebDriver driver;
    private final Execution execution;
    private final Scenario scenario;
    private final ExecutionLogService logService;


    private ExecutionStepResult currentStepResult;

    public void setCurrentStepResult(ExecutionStepResult result) {
        this.currentStepResult = result;
    }


    public void logInfo(String message) {
        logService.info(execution, currentStepResult, message);
    }

    public void logWarn(String message) {
        logService.warn(execution, currentStepResult, message);
    }

    public void logError(String message) {
        logService.error(execution, currentStepResult, message);
    }

    public void logDebug(String message) {
        logService.debug(execution, currentStepResult, message);
    }
}