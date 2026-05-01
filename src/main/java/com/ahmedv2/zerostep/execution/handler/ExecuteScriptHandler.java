package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class ExecuteScriptHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.EXECUTE_SCRIPT; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String script = HandlerSupport.requireInput(step, "EXECUTE_SCRIPT");
        context.logInfo("Execute JS (length=" + script.length() + ")");
        Object result = HandlerSupport.js(context.getDriver()).executeScript(script);
        if (step.getConfig() != null && Boolean.TRUE.equals(step.getConfig().getLogScriptResult())) {
            context.logInfo("JS result: " + (result != null ? result.toString() : "null"));
        }
    }
}