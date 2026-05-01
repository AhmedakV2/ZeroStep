package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.SelectorType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;
import org.springframework.stereotype.Component;

// Selector verilmisse o elemana, verilmemisse sayfaya tus gonderir
@Component
@RequiredArgsConstructor
public class PressKeyHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.PRESS_KEY; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String keyName = HandlerSupport.requireInput(step, "PRESS_KEY");
        CharSequence keyChar = KeyMapper.single(keyName);
        SelectorType st = step.getSelectorType();
        String sv = step.getSelectorValue();

        if (st != null && sv != null && !sv.isBlank()) {
            var by = selectorResolver.resolve(st, sv);
            WebElement el = WaitUtil.waitVisible(context.getDriver(), by, HandlerSupport.waitSeconds(step));
            context.logInfo("Press key '" + keyName + "' on " + by);
            el.sendKeys(keyChar);
        } else {
            context.logInfo("Press key '" + keyName + "' globally");
            new Actions(context.getDriver()).sendKeys(keyChar).perform();
        }
    }
}