package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;


@Component
public class NavigateHandler implements ActionHandler {

    @Override
    public ActionType supports() {
        return ActionType.NAVIGATE;
    }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String url = step.getInputValue();
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("NAVIGATE icin inputValue (URL) zorunlu");
        }
        url = url.trim();


        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            String baseUrl = context.getScenario().getBaseUrl();
            if (baseUrl == null || baseUrl.isBlank()) {
                throw new IllegalArgumentException(
                        "Relative URL kullanildi ama scenario.baseUrl bos: " + url);
            }
            url = baseUrl.endsWith("/") && url.startsWith("/")
                    ? baseUrl + url.substring(1)
                    : baseUrl + url;
        }

        context.logInfo("Navigating to: " + url);
        context.getDriver().get(url);
    }
}