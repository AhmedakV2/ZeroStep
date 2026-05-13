package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.springframework.stereotype.Component;


@Component
@RequiredArgsConstructor
public class TypeHandler implements ActionHandler {

    private final SelectorResolver selectorResolver;

    @Override
    public ActionType supports() {
        return ActionType.TYPE;
    }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        String value = step.getInputValue();
        if (value == null) {
            throw new IllegalArgumentException("TYPE icin inputValue zorunlu");
        }

        // Element tıklanabilir olana kadar bekle
        WebElement element = WaitUtil.waitClickable(context.getDriver(), by, HandlerSupport.waitSeconds(step));

        context.logInfo("Typing into: " + by + " (length=" + value.length() + ")");

        // Mevcut içeriği sil — üst üste yazma sorununu önler
        element.clear();
        element.sendKeys(value);
    }
}