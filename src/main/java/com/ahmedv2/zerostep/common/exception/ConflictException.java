package com.ahmedv2.zerostep.common.exception;

import org.springframework.http.HttpStatus;

public class ConflictException extends BusinessException{
    public ConflictException(String message) {
        super(HttpStatus.CONFLICT,"CONFLICT",message);
    }
}
