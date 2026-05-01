package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class AssertUrlEqualsHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.ASSERT_URL_EQUALS; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String expected = HandlerSupport.requireInput(step, "ASSERT_URL_EQUALS");
        String actual = context.getDriver().getCurrentUrl();
        boolean match = HandlerSupport.caseInsensitive(step)
                ? expected.equalsIgnoreCase(actual)
                : expected.equals(actual);
        if (!match) {
            throw new AssertionError("URL esit degil. Beklenen: '" + expected + "' Gercek: '" + actual + "'");
        }
        context.logInfo("ASSERT url equals OK");
    }
}