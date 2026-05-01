package com.ahmedv2.zerostep.execution.entity;

public enum ExecutionStatus {
    QUEUED,
    RUNNING,
    COMPLETED,
    FAILED,
    CANCELLED,
    TIMEOUT;

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this ==  CANCELLED || this == TIMEOUT;
    }
}
