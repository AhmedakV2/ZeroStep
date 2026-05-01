package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class NavigateForwardHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.NAVIGATE_FORWARD; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        context.logInfo("Navigating forward");
        context.getDriver().navigate().forward();
    }
}