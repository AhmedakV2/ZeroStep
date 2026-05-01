package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.openqa.selenium.WindowType;
import org.springframework.stereotype.Component;

@Component
public class OpenNewTabHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.OPEN_NEW_TAB; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        context.logInfo("Open new tab");
        context.getDriver().switchTo().newWindow(WindowType.TAB);
        // inputValue varsa o URL'e git
        String url = step.getInputValue();
        if (url != null && !url.isBlank()) {
            context.logInfo("New tab navigate: " + url);
            context.getDriver().get(url.trim());
        }
    }
}