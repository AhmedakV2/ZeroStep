package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class SetLocalStorageHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.SET_LOCAL_STORAGE; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String key = HandlerSupport.requireInput(step, "SET_LOCAL_STORAGE");
        String value = HandlerSupport.requireSecondary(step, "SET_LOCAL_STORAGE");
        context.logInfo("Set localStorage '" + key + "'");
        HandlerSupport.js(context.getDriver())
                .executeScript("window.localStorage.setItem(arguments[0], arguments[1]);", key, value);
    }
}