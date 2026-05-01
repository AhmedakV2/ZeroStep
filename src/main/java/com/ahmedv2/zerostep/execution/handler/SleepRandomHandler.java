package com.ahmedv2.zerostep.execution.handler;

import com.ahmedv2.zerostep.execution.driver.ExecutionContext;
import com.ahmedv2.zerostep.step.entity.ActionType;
import com.ahmedv2.zerostep.step.entity.TestStep;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

@Component
public class SleepRandomHandler implements ActionHandler {
    @Override public ActionType supports() { return ActionType.SLEEP_RANDOM; }

    @Override
    public void execute(TestStep step, ExecutionContext context) throws InterruptedException {
        // inputValue "min,max" ms cinsinden
        int[] range = HandlerSupport.parseCoords(step.getInputValue(), "SLEEP_RANDOM inputValue");
        int min = Math.max(0, range[0]);
        int max = Math.max(min + 1, range[1]);
        if (max > 60_000) {
            throw new IllegalArgumentException("Random sleep max 60000 ms olabilir");
        }
        int ms = ThreadLocalRandom.current().nextInt(min, max + 1);
        context.logInfo("Sleep random " + ms + " ms (range " + min + "-" + max + ")");
        Thread.sleep(ms);
    }
}