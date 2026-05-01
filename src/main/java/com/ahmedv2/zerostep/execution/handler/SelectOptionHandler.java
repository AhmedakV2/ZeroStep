package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;
import org.springframework.stereotype.Component;

// Once visible text ile dener; bulamazsa value attribute'u ile dener
@Component
@RequiredArgsConstructor
public class SelectOptionHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.SELECT_OPTION; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String value = HandlerSupport.requireInput(step, "SELECT_OPTION");
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        WebElement el = WaitUtil.waitVisible(context.getDriver(), by, HandlerSupport.waitSeconds(step));

        Select select = new Select(el);
        try {
            select.selectByVisibleText(value);
            context.logInfo("Selected by visible text: " + value);
        } catch (Exception e) {
            // Fallback: value attribute
            select.selectByValue(value);
            context.logInfo("Selected by value: " + value);
        }
    }
}