package com.ahmedv2.zerostep.security.filter;

import com.ahmedv2.zerostep.common.response.ApiError;
import com.ahmedv2.zerostep.security.jwt.JwtTokenProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class PasswordChangeRequiredFilter extends OncePerRequestFilter {

    // Şifre değişikliği zorunlu olsa bile erişilebilir path'ler
    private static final Set<String> ALLOWED_PREFIXES = Set.of(
            "/api/v1/users/me/change-password",
            "/api/v1/users/me",
            "/api/v1/auth/"
    );

    // SSE endpoint'i — EventSource bağlantısını bloke etme
    private static final String SSE_SUFFIX = "/stream";

    private final JwtTokenProvider jwtTokenProvider;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // SSE stream endpoint'i — hiçbir zaman bloke etme
        if (path.endsWith(SSE_SUFFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = extractToken(request);
        if (token != null
                && jwtTokenProvider.isValid(token)
                && jwtTokenProvider.isPasswordChangeRequired(token)
                && !isAllowedPath(path)) {
            writeForbidden(response, path);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isAllowedPath(String path) {
        return ALLOWED_PREFIXES.stream().anyMatch(path::startsWith);
    }

    private String extractToken(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (bearer != null && bearer.startsWith("Bearer ")) {
            return bearer.substring(7).trim();
        }
        // SSE token query param
        if (request.getRequestURI().endsWith("/stream")) {
            return request.getParameter("token");
        }
        return null;
    }

    private void writeForbidden(HttpServletResponse response, String path) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        ApiError err = ApiError.of(
                "PASSWORD_CHANGE_REQUIRED",
                "Şifre değişikliği zorunlu. Lütfen önce şifrenizi değiştirin.",
                path
        );
        response.getWriter().write(objectMapper.writeValueAsString(err));
    }
}