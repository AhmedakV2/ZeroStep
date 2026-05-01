package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.openqa.selenium.Cookie;
import org.springframework.stereotype.Component;

@Component
public class SetCookieHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.SET_COOKIE; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String name = HandlerSupport.requireInput(step, "SET_COOKIE");
        String value = HandlerSupport.requireSecondary(step, "SET_COOKIE");
        context.logInfo("Set cookie '" + name + "'");
        context.getDriver().manage().addCookie(new Cookie(name, value));
    }
}