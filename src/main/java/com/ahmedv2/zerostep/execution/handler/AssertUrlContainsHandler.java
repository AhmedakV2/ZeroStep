package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class AssertUrlContainsHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.ASSERT_URL_CONTAINS; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String expected = HandlerSupport.requireInput(step, "ASSERT_URL_CONTAINS");
        String actual = context.getDriver().getCurrentUrl();
        boolean ci = HandlerSupport.caseInsensitive(step);
        boolean contains = ci
                ? actual.toLowerCase().contains(expected.toLowerCase())
                : actual.contains(expected);
        if (!contains) {
            throw new AssertionError("URL icermiyor: '" + expected + "' (gercek: '" + actual + "')");
        }
        context.logInfo("ASSERT url contains OK");
    }
}