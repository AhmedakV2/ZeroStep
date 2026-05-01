package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class ClearLocalStorageHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.CLEAR_LOCAL_STORAGE; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        context.logInfo("Clear localStorage");
        HandlerSupport.js(context.getDriver()).executeScript("window.localStorage.clear();");
    }
}