package com.ahmedv2.zerostep.config;

import com.ahmedv2.zerostep.config.properties.AppProperties;
import com.ahmedv2.zerostep.extension.security.ExtensionTokenAuthenticationFilter;
import com.ahmedv2.zerostep.ratelimit.RateLimitFilter;
import com.ahmedv2.zerostep.security.filter.JwtAuthenticationFilter;
import com.ahmedv2.zerostep.security.filter.PasswordChangeRequiredFilter;
import com.ahmedv2.zerostep.security.handler.JsonAccessDeniedHandler;
import com.ahmedv2.zerostep.security.handler.JsonAuthenticationEntryPoint;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final AppProperties appProperties;
    private final ExtensionTokenAuthenticationFilter extensionTokenAuthenticationFilter;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final PasswordChangeRequiredFilter passwordChangeRequiredFilter;
    private final JsonAuthenticationEntryPoint authenticationEntryPoint;
    private final JsonAccessDeniedHandler accessDeniedHandler;
    private final UserDetailsService userDetailsService;
    private final RateLimitFilter rateLimitFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        // Enumerate attack koruması — "kullanıcı yok" ile "şifre yanlış" farkını gizle
        provider.setHideUserNotFoundExceptions(true);
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .headers(headers -> headers
                        .contentTypeOptions(opt -> {})
                        .frameOptions(frame -> frame.deny())
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31536000))
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; " +
                                        "script-src 'self' 'unsafe-inline'; " +
                                        "style-src 'self' 'unsafe-inline'; " +
                                        "img-src 'self' data:; " +
                                        "connect-src 'self' ws: wss:"))
                        .referrerPolicy(ref -> ref.policy(
                                org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter
                                        .ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                )
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        // OPTIONS preflight — her zaman izin ver
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Public endpoint'ler
                        .requestMatchers(
                                "/actuator/health",
                                "/actuator/info",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/api/v1/ping",
                                "/ws/**"
                        ).permitAll()

                        // Auth endpoint'leri
                        .requestMatchers("/api/v1/auth/**").permitAll()

                        // SSE stream endpoint — token query param ile auth yapılır,
                        // Spring Security katmanını geçmesi için permitAll; JwtFilter handle eder
                        .requestMatchers("/api/v1/executions/*/stream").permitAll()

                        // Geri kalanı auth ister
                        .anyRequest().authenticated()
                )

                // Filter zinciri sırası önemli:
                // 1. Extension token (X-AFT-Token header)
                .addFilterBefore(extensionTokenAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                // 2. JWT token (Authorization: Bearer veya ?token= query param)
                .addFilterAfter(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                // 3. Rate limit
                .addFilterAfter(rateLimitFilter, BasicAuthenticationFilter.class)
                // 4. Şifre değiştirme zorunluluğu (SSE'yi bloke etmez)
                .addFilterAfter(passwordChangeRequiredFilter, AnonymousAuthenticationFilter.class)

                .authenticationProvider(authenticationProvider());

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        var cors = appProperties.getSecurity().getCors();

        if (cors.getAllowedOrigins() != null && !cors.getAllowedOrigins().isEmpty()) {
            cfg.setAllowedOrigins(cors.getAllowedOrigins());
        }
        if (cors.getAllowedOriginPatterns() != null && !cors.getAllowedOriginPatterns().isEmpty()) {
            cfg.setAllowedOriginPatterns(cors.getAllowedOriginPatterns());
        }
        cfg.setAllowedMethods(List.of(cors.getAllowedMethods().split(",")));
        cfg.setAllowedHeaders(List.of(
                "Authorization",
                "Content-Type",
                "Accept",
                "Origin",
                "Cache-Control",
                // SSE için zorunlu header
                "Last-Event-ID",
                "X-Requested-With",
                "X-AFT-Token",
                "X-AFT-Scenario-Id"
        ));
        cfg.setExposedHeaders(List.of(
                "Authorization",
                "Content-Disposition",
                // SSE bağlantısı için expose et
                "Cache-Control",
                "Content-Type"
        ));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(cors.getMaxAgeSeconds());

        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}