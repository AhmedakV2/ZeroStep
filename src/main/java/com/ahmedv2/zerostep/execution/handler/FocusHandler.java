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
public class FocusHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.FOCUS; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        WebElement el = WaitUtil.waitVisible(context.getDriver(), by, HandlerSupport.waitSeconds(step));
        context.logInfo("Focusing: " + by);
        // JS ile focus; sendKeys("") ile focus tetiklenmez bazi browser'larda
        HandlerSupport.js(context.getDriver()).executeScript("arguments[0].focus();", el);
    }
}