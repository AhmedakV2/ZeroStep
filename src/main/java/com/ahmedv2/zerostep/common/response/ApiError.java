package com.ahmedv2.zerostep.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
        boolean success,
        String code,
        String message,
        Map<String, String> fieldErrors,
        String path,
        Instant timestamp
) {
    public static ApiError of(String code,String message,String path){
        return new ApiError(false, code, message, null, path, Instant.now());
    }

    public static ApiError validation(Map<String,String> fieldErrors,String path){
        return new ApiError(false, "VALIDATION_ERROR",
                "Validation failed", fieldErrors, path, Instant.now());
    }
}
