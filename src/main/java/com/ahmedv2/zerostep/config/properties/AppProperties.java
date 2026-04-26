package com.ahmedv2.zerostep.config.properties;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.List;

// application.yml'deki app.* prefix'ini type-safe nesneye cevirir
@ConfigurationProperties(prefix = "app")
@Validated
@Getter
@Setter
public class AppProperties {

    @NotNull @Valid private Security security = new Security();
    @NotNull @Valid private Mail mail = new Mail();

    @Getter @Setter
    public static class Security {
        @NotNull @Valid private Jwt jwt = new Jwt();
        @NotNull @Valid private Cors cors = new Cors();
    }

    @Getter @Setter
    public static class Jwt {
        @NotBlank
        private String secret;
        @Min(1)
        private int accessTokenTtlMinutes = 15;
        @Min(1)
        private int refreshTokenTtlDays = 7;
        @NotBlank
        private String issuer = "zerostep";
    }

    @Getter @Setter
    public static class Cors {
        private List<String> allowedOrigins = List.of();
        private List<String> allowedOriginPatterns = List.of();
        private String allowedMethods = "GET,POST,PUT,DELETE,PATCH,OPTIONS";
        @Min(0)
        private long maxAgeSeconds = 3600L;
    }

    @Getter @Setter
    public static class Mail {
        private boolean enabled = false;
        @Email
        private String fromAddress = "noreply@zerostep.local";
        private String fromName = "ZeroStep";
    }
}