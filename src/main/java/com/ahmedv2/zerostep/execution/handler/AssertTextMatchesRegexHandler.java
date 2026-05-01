package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.execution.driver.SelectorResolver;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.WebElement;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class AssertTextMatchesRegexHandler implements ActionHandler {
    private final SelectorResolver selectorResolver;

    @Override public ActionType supports() { return ActionType.ASSERT_TEXT_MATCHES_REGEX; }

    @Override
    public void execute(TestStep step, ExecutionContext context) {
        String regex = HandlerSupport.requireInput(step, "ASSERT_TEXT_MATCHES_REGEX");
        var by = selectorResolver.resolve(step.getSelectorType(), step.getSelectorValue());
        WebElement el = WaitUtil.waitVisible(context.getDriver(), by, HandlerSupport.waitSeconds(step));
        String actual = el.getText();
        int flags = HandlerSupport.caseInsensitive(step) ? Pattern.CASE_INSENSITIVE : 0;
        if (!Pattern.compile(regex, flags).matcher(actual).find()) {
            throw new AssertionError("Text regex'e uymuyor. Pattern: '" + regex + "' Gercek: '" + actual + "'");
        }
        context.logInfo("ASSERT text regex OK");
    }
}