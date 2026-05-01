package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class LogMessageHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.LOG_MESSAGE; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String msg = HandlerSupport.requireInput(step, "LOG_MESSAGE");
        context.logInfo("[USER LOG] " + msg);
    }
}