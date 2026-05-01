package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class ScrollByPixelsHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.SCROLL_BY_PIXELS; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        int[] xy = HandlerSupport.parseCoords(step.getInputValue(), "SCROLL_BY_PIXELS inputValue");
        context.logInfo("Scroll by (" + xy[0] + "," + xy[1] + ")");
        HandlerSupport.js(context.getDriver())
                .executeScript("window.scrollBy(arguments[0], arguments[1]);", xy[0], xy[1]);
    }
}