package com.ahmedv2.zerostep.audit.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

// Metodun audit_events tablosuna otomatik kayıt edilmesini sağlar
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    String action();          // Ör: "SCENARIO_CREATED"
    String entityType() default ""; // Ör: "SCENARIO"
}