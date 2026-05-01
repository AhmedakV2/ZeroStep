package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class NavigateBackHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.NAVIGATE_BACK; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        context.logInfo("Navigating back");
        context.getDriver().navigate().back();
    }
}