package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.config.properties.AppProperties;
import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.apache.commons.io.FileUtils;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Component
@RequiredArgsConstructor
public class ScreenshotHandler implements ActionHandler {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("HHmmss");
    private final AppProperties appProperties;

    @Override
    public ActionType supports() {
        return ActionType.SCREENSHOT;
    }

    @Override
    public void execute(TestStep step, ExecutionContext context) throws Exception {
        TakesScreenshot ts = (TakesScreenshot) context.getDriver();
        File source = ts.getScreenshotAs(OutputType.FILE);

        // Dosya adi: <execution-id>/<timestamp>_<step-public-id>.png
        Long execId = context.getExecution().getId();
        String fileName = TS.format(LocalDateTime.now()) + "_" + step.getPublicId() + ".png";
        Path targetDir = Paths.get(appProperties.getExecution().getScreenshotDir(),
                String.valueOf(execId));
        Path target = targetDir.resolve(fileName);

        FileUtils.copyFile(source, target.toFile());

        // Step resulta path yaz; service detay sayfasinda gosterir
        if (context.getCurrentStepResult() != null) {
            context.getCurrentStepResult().setScreenshotPath(target.toString());
        }
        context.logInfo("Screenshot saved: " + target);
    }
}