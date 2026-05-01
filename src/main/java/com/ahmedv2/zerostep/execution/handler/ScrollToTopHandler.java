package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class ScrollToTopHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.SCROLL_TO_TOP; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        context.logInfo("Scroll to top");
        HandlerSupport.js(context.getDriver()).executeScript("window.scrollTo(0,0);");
    }
}