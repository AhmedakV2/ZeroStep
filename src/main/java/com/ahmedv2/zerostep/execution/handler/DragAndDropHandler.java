package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.SelectorType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;
import org.springframework.stereotype.Component;

// selector=source eleman; secondaryValue=target selector (CSS varsayilir)
@Component
@RequiredArgsConstructor
public class DragAndDropHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.DRAG_AND_DROP; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String targetSelector = HandlerSupport.requireSecondary(step, "DRAG_AND_DROP");
        var sourceBy = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        // secondaryValue prefix yoksa CSS varsayilir; "xpath:" ile baslar ise XPath
        By targetBy;
        if (targetSelector.startsWith("xpath:")) {
            targetBy = By.xpath(targetSelector.substring(6));
        } else {
            targetBy = selectorResolver.resolve(SelectorType.CSS, targetSelector);
        }

        int wait = HandlerSupport.waitSeconds(step);
        WebElement source = WaitUtil.waitVisible(context.getDriver(), sourceBy, wait);
        WebElement target = WaitUtil.waitVisible(context.getDriver(), targetBy, wait);

        context.logInfo("Drag from " + sourceBy + " to " + targetBy);
        new Actions(context.getDriver()).dragAndDrop(source, target).perform();
    }
}