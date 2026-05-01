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

@ConfigurationProperties(prefix = "app")
@Validated
@Getter
@Setter
public class AppProperties {

    @NotNull @Valid private Security security = new Security();
    @NotNull @Valid private Mail mail = new Mail();
    @NotNull @Valid private Execution execution = new Execution();

    @Getter
    @Setter
    public static class Security {
        @NotNull @Valid private Jwt jwt = new Jwt();
        @NotNull @Valid private Cors cors = new Cors();
    }

    @Getter
    @Setter
    public static class Jwt {
        @NotBlank private String secret;
        @Min(1) private int accessTokenTtlMinutes = 15;
        @Min(1) private int refreshTokenTtlDays = 7;
        @NotBlank private String issuer = "zerostep";
    }

    @Getter
    @Setter
    public static class Cors {
        private List<String> allowedOrigins = List.of();
        private List<String> allowedOriginPatterns = List.of();
        private String allowedMethods = "GET,POST,PUT,DELETE,PATCH,OPTIONS";
        @Min(0) private long maxAgeSeconds = 3600L;
    }

    @Getter
    @Setter
    public static class Mail {
        private boolean enabled = false;
        @Email private String fromAddress = "noreply@zerostep.local";
        private String fromName = "ZeroStep";
    }

    // Faz 5B: WebDriver execution ayarlari; public static erisim icin kritik
    @Getter
    @Setter
    public static class Execution {
        @Min(1) private int maxConcurrentDrivers = 5;
        @Min(1) private int acquireTimeoutSeconds = 30;
        @Min(1) private int pageLoadTimeoutSeconds = 60;
        @Min(0) private int implicitWaitSeconds = 0;
        @NotBlank private String screenshotDir = "./screenshots";
        private boolean headless = false;
        @Min(640) private int windowWidth = 1920;
        @Min(480) private int windowHeight = 1080;
    }
}