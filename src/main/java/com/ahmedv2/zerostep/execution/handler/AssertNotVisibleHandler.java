package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AssertNotVisibleHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.ASSERT_NOT_VISIBLE; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        boolean invisible = WaitUtil.waitInvisible(context.getDriver(), by, HandlerSupport.waitSeconds(step));
        if (!invisible) {
            throw new AssertionError("Element hala gorunuyor (gorunmemesi bekleniyordu): " + by);
        }
        context.logInfo("ASSERT not-visible OK: " + by);
    }
}