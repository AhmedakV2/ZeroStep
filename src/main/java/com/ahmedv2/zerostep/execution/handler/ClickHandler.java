package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class ClickHandler implements ActionHandler {

    private static final int DEFAULT_WAIT_SECONDS = 10;
    private final SelectorResolver selectorResolver;

    @Override
    public ActionType supports() {
        return ActionType.CLICK;
    }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());

        int waitSec = step.getConfig() != null && step.getConfig().getTimeoutSeconds() != null
                ? step.getConfig().getTimeoutSeconds()
                : DEFAULT_WAIT_SECONDS;


        WebElement element = new WebDriverWait(context.getDriver(), Duration.ofSeconds(waitSec))
                .until(ExpectedConditions.elementToBeClickable(by));

        context.logInfo("Clicking: " + by);
        element.click();
    }
}