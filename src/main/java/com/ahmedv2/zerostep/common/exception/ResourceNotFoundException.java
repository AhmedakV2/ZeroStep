package com.ahmedv2.zerostep.common.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException  extends BusinessException{
    public ResourceNotFoundException(String resource, Object id){
        super(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND",
                "%s bulunamadi: id=%s".formatted(resource, id));
    }
    public ResourceNotFoundException(String message){
        super(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND",message);
    }

}
