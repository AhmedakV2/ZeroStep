package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.springframework.stereotype.Component;

import java.io.File;

@Component
@RequiredArgsConstructor
public class UploadFileHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.UPLOAD_FILE; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String path = HandlerSupport.requireInput(step, "UPLOAD_FILE");
        File f = new File(path);
        if (!f.exists() || !f.isFile()) {
            throw new IllegalArgumentException("Dosya bulunamadi: " + path);
        }
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        WebElement el = WaitUtil.waitPresent(context.getDriver(), by, HandlerSupport.waitSeconds(step));
        context.logInfo("Uploading file '" + f.getName() + "' to " + by);
        el.sendKeys(f.getAbsolutePath());
    }
}