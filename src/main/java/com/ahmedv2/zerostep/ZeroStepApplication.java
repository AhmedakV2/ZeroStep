package com.ahmedv2.zerostep;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan("com.ahmedv2.zerostep.config.properties")
@EnableJpaAuditing(auditorAwareRef = "auditorAware")
@EnableAsync
@EnableScheduling
@EnableAspectJAutoProxy
public class ZeroStepApplication {

    public static void main(String[] args) {
        SpringApplication.run(ZeroStepApplication.class, args);
    }

}
