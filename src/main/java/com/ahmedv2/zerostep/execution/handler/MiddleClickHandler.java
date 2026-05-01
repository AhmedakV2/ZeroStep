package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.springframework.stereotype.Component;

// Middle click cogu test senaryosunda yeni tab acmak icin kullanilir
// Selenium native middle click sunmaz; CTRL+CLICK ile new-tab simulasyonu
@Component
@RequiredArgsConstructor
public class MiddleClickHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.MIDDLE_CLICK; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        WebElement el = WaitUtil.waitClickable(context.getDriver(), by, HandlerSupport.waitSeconds(step));
        context.logInfo("Middle-clicking (CTRL+CLICK): " + by);
        new org.openqa.selenium.interactions.Actions(context.getDriver())
                .keyDown(org.openqa.selenium.Keys.CONTROL)
                .click(el)
                .keyUp(org.openqa.selenium.Keys.CONTROL)
                .perform();
    }
}