package com.ahmedv2.zerostep.scenario.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BrowserConfig {
    @Builder.Default
    private boolean headless = false;

    @Builder.Default
    private boolean keepBrowserOpen = false;

    @Builder.Default
    private int viewportWidth = 1920;

    @Builder.Default
    private int viewportHeight = 1080;

    private  Integer stepDelayMs;

    private  Integer defaultWaitSeconds;

    private  String userAgent;
}
