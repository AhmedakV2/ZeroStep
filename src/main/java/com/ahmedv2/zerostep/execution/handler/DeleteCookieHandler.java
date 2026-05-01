package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class DeleteCookieHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.DELETE_COOKIE; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String name = HandlerSupport.requireInput(step, "DELETE_COOKIE");
        context.logInfo("Delete cookie: " + name);
        context.getDriver().manage().deleteCookieNamed(name);
    }
}