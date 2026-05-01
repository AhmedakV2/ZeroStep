package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.step.entity.TestStep;
import com.ahmedv2.zerostep.step.entity.TestStepConfig;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

public final class HandlerSupport {

    public static final int DEFAULT_WAIT_SECONDS = 10;

    private HandlerSupport() {}

    public static int waitSeconds(TestStep step) {
        TestStepConfig cfg = step.getConfig();
        if (cfg != null && cfg.getTimeoutSeconds() != null && cfg.getTimeoutSeconds() > 0) {
            return cfg.getTimeoutSeconds();
        }
        return DEFAULT_WAIT_SECONDS;
    }

    public static boolean caseInsensitive(TestStep step) {
        TestStepConfig cfg = step.getConfig();
        return cfg != null && Boolean.TRUE.equals(cfg.getCaseInsensitive());
    }

    public static JavascriptExecutor js(WebDriver driver) {
        return (JavascriptExecutor) driver;
    }

    public static int[] parseCoords(String input, String fieldName) {
        if (input == null || input.isEmpty()) {
            throw new IllegalArgumentException(fieldName + "'x,y' formatinde olmali");
        }
        String[] parts = input.trim().split(",");
        if (parts.length != 2) {
            throw new IllegalArgumentException(fieldName + "'x,y' formatinda olmali; gelen:"+input);
        }
        try {
            return new int []{
                    Integer.parseInt(parts[0].trim()),
                    Integer.parseInt(parts[1].trim())
            };
        }catch(NumberFormatException e) {
            throw new IllegalArgumentException(fieldName + "sayilar olmali:" + input);
        }
    }

    public static String requireInput(TestStep step, String actionName) {
        String v = step.getInputValue();
        if(v == null || v.isEmpty()) {
            throw new IllegalArgumentException(actionName + "icin inputValue zorunlu");
        }
        return v;
    }

    public static String requireSecondary(TestStep step, String actionName){
        String v = step.getSecondaryValue();
        if(v == null || v.isBlank()) {
            throw new IllegalArgumentException(actionName + "secondary inputValue zorunlu");
        }
        return v;
    }

}
