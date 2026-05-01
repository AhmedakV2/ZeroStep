package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ClickAtOffsetHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.CLICK_AT_OFFSET; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        int[] xy = HandlerSupport.parseCoords(step.getInputValue(), "CLICK_AT_OFFSET inputValue");
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        WebElement el = WaitUtil.waitVisible(context.getDriver(), by, HandlerSupport.waitSeconds(step));
        context.logInfo("Click at offset (" + xy[0] + "," + xy[1] + ") on " + by);
        new Actions(context.getDriver()).moveToElement(el, xy[0], xy[1]).click().perform();
    }
}