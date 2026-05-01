package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

// Mevcut aktif tab'ı kapatır; var ise önceki tab'a geçer
@Component
public class CloseTabHandler implements ActionHandler {

    @Override
    public ActionType supports() {
        return ActionType.CLOSE_TAB;
    }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        List<String> handles = new ArrayList<>(context.getDriver().getWindowHandles());
        if (handles.size() <= 1) {
            context.logWarn("Tek tab var; kapatma atlanıyor");
            return;
        }
        String current = context.getDriver().getWindowHandle();
        context.logInfo("Closing tab: " + current);
        context.getDriver().close();
        // Önceki tab'a switch et
        handles.remove(current);
        context.getDriver().switchTo().window(handles.get(handles.size() - 1));
    }
}