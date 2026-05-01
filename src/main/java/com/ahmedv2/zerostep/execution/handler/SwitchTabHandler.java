package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class SwitchTabHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.SWITCH_TAB; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        int idx = Integer.parseInt(HandlerSupport.requireInput(step, "SWITCH_TAB").trim());
        List<String> handles = new ArrayList<>(context.getDriver().getWindowHandles());
        if (idx < 0 || idx >= handles.size()) {
            throw new IndexOutOfBoundsException(
                    "Tab index gecersiz: " + idx + " (toplam tab: " + handles.size() + ")");
        }
        context.logInfo("Switch to tab index: " + idx);
        context.getDriver().switchTo().window(handles.get(idx));
    }
}