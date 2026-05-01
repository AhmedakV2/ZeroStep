package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class SwitchToParentFrameHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.SWITCH_TO_PARENT_FRAME; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        context.logInfo("Switch to parent frame");
        context.getDriver().switchTo().parentFrame();
    }
}