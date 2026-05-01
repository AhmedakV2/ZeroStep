package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class WaitForUrlHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.WAIT_FOR_URL; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String urlPart = HandlerSupport.requireInput(step, "WAIT_FOR_URL");
        int s = HandlerSupport.waitSeconds(step);
        context.logInfo("Wait for URL contains '" + urlPart + "' (max " + s + "s)");
        new WebDriverWait(context.getDriver(), Duration.ofSeconds(s))
                .until(ExpectedConditions.urlContains(urlPart));
    }
}