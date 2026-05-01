package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.springframework.stereotype.Component;

// TYPE ile ayni davranis ama logu maskelemis
@Component
@RequiredArgsConstructor
public class TypeSecretHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.TYPE_SECRET; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String value = HandlerSupport.requireInput(step, "TYPE_SECRET");
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        WebElement el = WaitUtil.waitClickable(context.getDriver(), by, HandlerSupport.waitSeconds(step));
        context.logInfo("Typing secret into: " + by + " (length=" + value.length() + ")");
        el.sendKeys(value);
    }
}