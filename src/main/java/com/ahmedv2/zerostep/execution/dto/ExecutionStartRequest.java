package com.ahmedv2.zerostep.execution.dto;

// Senaryo baslatma; ilerde headless override gibi parametreler eklenecek
public record ExecutionStartRequest(
        Boolean headlessOverride,
        Boolean keepBrowserOpenOverride
) {
    public ExecutionStartRequest {
        // null'a izin var; service tarafinda default ile birlestirilir
    }
}