package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AssertAttributeEqualsHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.ASSERT_ATTRIBUTE_EQUALS; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String expected = HandlerSupport.requireInput(step, "ASSERT_ATTRIBUTE_EQUALS");
        String attrName = HandlerSupport.requireSecondary(step, "ASSERT_ATTRIBUTE_EQUALS");
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        WebElement el = WaitUtil.waitVisible(context.getDriver(), by, HandlerSupport.waitSeconds(step));
        String actual = el.getDomAttribute(attrName);
        boolean match = HandlerSupport.caseInsensitive(step)
                ? expected.equalsIgnoreCase(actual)
                : expected.equals(actual);
        if (!match) {
            throw new AssertionError("Attr '" + attrName + "' esit degil. Beklenen: '" + expected + "' Gercek: '" + actual + "'");
        }
        context.logInfo("ASSERT attribute '" + attrName + "' OK");
    }
}