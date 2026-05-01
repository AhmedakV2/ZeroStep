package com.ahmedv2.zerostep.config;

import com.ahmedv2.zerostep.config.properties.AppProperties;
import com.ahmedv2.zerostep.security.filter.JwtAuthenticationFilter;
import com.ahmedv2.zerostep.security.handler.JsonAccessDeniedHandler;
import com.ahmedv2.zerostep.security.handler.JsonAuthenticationEntryPoint;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import com.ahmedv2.zerostep.security.filter.PasswordChangeRequiredFilter;


import java.util.List;

// FAZ 1: JWT filter eklendi, endpoint'ler sikilastirildi
@Configuration
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final AppProperties appProperties;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final PasswordChangeRequiredFilter passwordChangeRequiredFilter;
    private final JsonAuthenticationEntryPoint authenticationEntryPoint;
    private final JsonAccessDeniedHandler accessDeniedHandler;
    private final UserDetailsService userDetailsService;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        // "Kullanici bulunamadi" ile "sifre yanlis" arasindaki farki disariya verme; enum attack korumasi
        provider.setHideUserNotFoundExceptions(true);
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                // Custom exception handler'lari; default HTML sayfasi yerine JSON
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
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
                        // Auth endpoint'leri: login, register, refresh public
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        // Geri kalani authentication ister
                        .anyRequest().authenticated()
                )
                // JWT filter; UsernamePasswordAuthenticationFilter'in ONUNE ekleniyor
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(passwordChangeRequiredFilter, JwtAuthenticationFilter.class)
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
                "Authorization", "Content-Type", "Accept", "Origin",
                "Cache-Control", "Last-Event-ID", "X-Requested-With",
                "X-AFT-Token", "X-AFT-Scenario-Id"));
        cfg.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(cors.getMaxAgeSeconds());

        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}