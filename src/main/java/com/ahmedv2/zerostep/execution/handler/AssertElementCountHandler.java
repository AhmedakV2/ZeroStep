package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class AssertElementCountHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.ASSERT_ELEMENT_COUNT; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        int expected = Integer.parseInt(HandlerSupport.requireInput(step, "ASSERT_ELEMENT_COUNT").trim());
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        List<?> els = context.getDriver().findElements(by);
        int actual = els.size();
        String op = step.getConfig() != null && step.getConfig().getCountOperator() != null
                ? step.getConfig().getCountOperator() : "EQUALS";
        boolean ok = switch (op.toUpperCase()) {
            case "EQUALS"        -> actual == expected;
            case "GREATER_THAN"  -> actual > expected;
            case "LESS_THAN"     -> actual < expected;
            default              -> actual == expected;
        };
        if (!ok) {
            throw new AssertionError("Element count " + op + " " + expected + " degil; gercek: " + actual);
        }
        context.logInfo("ASSERT element count OK: " + actual + " " + op + " " + expected);
    }
}