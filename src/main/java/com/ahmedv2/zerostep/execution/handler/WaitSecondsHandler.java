package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

@Component
public class WaitSecondsHandler implements ActionHandler {

    @Override
    public ActionType supports() {
        return ActionType.WAIT_SECONDS;
    }

    @Override
    public void execute(TestStep step, ExecutionContext context) throws InterruptedException {
        String input = step.getInputValue();
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("WAIT_SECONDS icin inputValue (saniye) zorunlu");
        }
        int seconds;
        try {
            seconds = Integer.parseInt(input.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("inputValue sayi olmali: " + input);
        }
        if (seconds < 0 || seconds > 300) {
            throw new IllegalArgumentException("Bekleme suresi 0-300 saniye arasi olmali: " + seconds);
        }

        context.logInfo("Waiting " + seconds + " seconds");
        Thread.sleep(seconds * 1000L);
    }
}