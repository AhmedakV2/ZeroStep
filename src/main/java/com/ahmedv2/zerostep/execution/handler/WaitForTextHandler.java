package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class WaitForTextHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.WAIT_FOR_TEXT; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String text = HandlerSupport.requireInput(step, "WAIT_FOR_TEXT");
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        int s = HandlerSupport.waitSeconds(step);
        context.logInfo("Wait for text '" + text + "' on " + by + " (max " + s + "s)");
        new WebDriverWait(context.getDriver(), Duration.ofSeconds(s))
                .until(ExpectedConditions.textToBePresentInElementLocated(by, text));
    }
}