package com.ahmedv2.zerostep.common.exception;

import org.springframework.http.HttpStatus;

public class ForbiddenException  extends  BusinessException{
    public ForbiddenException(String message){
        super(HttpStatus.FORBIDDEN,"FORBIDDEN",message);
    }
}
