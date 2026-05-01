package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.springframework.stereotype.Component;

// Selector verilmisse o iframe; verilmemisse inputValue index/name
@Component
@RequiredArgsConstructor
public class SwitchFrameHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.SWITCH_FRAME; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        if (step.getSelectorType() != null && step.getSelectorValue() != null
                && !step.getSelectorValue().isBlank()) {
            var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
            WebElement frame = WaitUtil.waitPresent(context.getDriver(), by, HandlerSupport.waitSeconds(step));
            context.logInfo("Switch to frame (selector): " + by);
            context.getDriver().switchTo().frame(frame);
        } else {
            String input = HandlerSupport.requireInput(step, "SWITCH_FRAME (selector veya inputValue gerekli)");
            try {
                int idx = Integer.parseInt(input.trim());
                context.logInfo("Switch to frame by index: " + idx);
                context.getDriver().switchTo().frame(idx);
            } catch (NumberFormatException e) {
                context.logInfo("Switch to frame by name/id: " + input);
                context.getDriver().switchTo().frame(input);
            }
        }
    }
}