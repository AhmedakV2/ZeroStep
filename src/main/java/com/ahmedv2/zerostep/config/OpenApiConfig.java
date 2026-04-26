package com.ahmedv2.zerostep.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER_KEY = "bearerAuth";

    @Bean
    public OpenAPI zeroStepOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("ZeroStep API")
                        .version("v1")
                        .description("AFT Functional Test Automation Platform")
                        .contact(new Contact().name("AhmedV2").email("boss@zerostep.local"))
                        .license(new License().name("Proprietary")))
                .components(new Components().addSecuritySchemes(BEARER_KEY,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT access token")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_KEY));
    }
}