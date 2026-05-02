package com.ahmedv2.zerostep.ratelimit;

import com.ahmedv2.zerostep.common.response.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimiterService rateLimiterService;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain)
            throws ServletException, IOException {

        String uri = request.getRequestURI();
        ConsumptionProbe probe = null;

        // Login rate limit — IP bazlı
        if (uri.equals("/api/v1/auth/login")) {
            probe = rateLimiterService.tryConsumeLogin(extractIp(request));
        }
        // Execute rate limit — kullanıcı bazlı
        else if (uri.matches(".*/scenarios/.*/execute")) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String key = auth != null ? auth.getName() : extractIp(request);
            probe = rateLimiterService.tryConsumeExecute(key);
        }
        // Extension rate limit — token veya IP bazlı
        else if (uri.startsWith("/api/v1/extension/")) {
            String token = request.getHeader("X-AFT-Token");
            String key = token != null ? token : extractIp(request);
            probe = rateLimiterService.tryConsumeExtension(key);
        }

        if (probe != null && !probe.isConsumed()) {
            // Retry-After header: nanosaniyeden saniyeye çevir
            long retryAfterSeconds = TimeUnit.NANOSECONDS.toSeconds(
                    probe.getNanosToWaitForRefill()) + 1;
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
            response.setHeader("X-RateLimit-Remaining", "0");

            ApiError error = ApiError.of("RATE_LIMIT_EXCEEDED",
                    "Cok fazla istek. Lutfen " + retryAfterSeconds + " saniye sonra tekrar deneyin.",
                    uri);
            response.getWriter().write(objectMapper.writeValueAsString(error));
            return;
        }

        chain.doFilter(request, response);
    }

    private String extractIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}