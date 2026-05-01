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

@Component
@RequiredArgsConstructor
public class PressKeyComboHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.PRESS_KEY_COMBO; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String combo = HandlerSupport.requireInput(step, "PRESS_KEY_COMBO");
        CharSequence chord = KeyMapper.chord(combo);
        SelectorType st = step.getSelectorType();
        String sv = step.getSelectorValue();

        if (st != null && sv != null && !sv.isBlank()) {
            var by = selectorResolver.resolve(st, sv);
            WebElement el = WaitUtil.waitVisible(context.getDriver(), by, HandlerSupport.waitSeconds(step));
            context.logInfo("Key combo '" + combo + "' on " + by);
            el.sendKeys(chord);
        } else {
            context.logInfo("Key combo '" + combo + "' globally");
            new Actions(context.getDriver()).sendKeys(chord).perform();
        }
    }
}