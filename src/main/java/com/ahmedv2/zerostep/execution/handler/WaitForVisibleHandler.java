package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WaitForVisibleHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.WAIT_FOR_VISIBLE; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        int s = HandlerSupport.waitSeconds(step);
        context.logInfo("Wait for visible (max " + s + "s): " + by);
        WaitUtil.waitVisible(context.getDriver(), by, s);
    }
}