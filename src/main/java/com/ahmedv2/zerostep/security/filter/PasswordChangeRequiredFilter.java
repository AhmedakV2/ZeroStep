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

    private static final Set<String> ALLOWED_PATHS = Set.of(
            "/api/v1/users/me/change-password",
            "/api/v1/users/me",
            "/api/v1/auth/logout"
    );

    private final JwtTokenProvider jwtTokenProvider;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException{

        String token = extractToken(request);
        if(token != null && jwtTokenProvider.isValid(token)
            && jwtTokenProvider.isPasswordChangeRequired(token)) {

            String path = request.getRequestURI();
            if (!isAllowedPath(path)) {
                writeForrbidden(response,path);
                return;
            }
        }
        filterChain.doFilter(request,response);
    }

    private boolean isAllowedPath(String path){
        return ALLOWED_PATHS.stream().anyMatch(path::startsWith)
                || path.startsWith("/api/v1/auth/");
    }

    private String extractToken(HttpServletRequest request){
        String bearer = request.getHeader("Authorization");
        if(bearer != null && bearer.startsWith("Bearer ")){
            return bearer.substring(7).trim();
        }
        return null;
    }

    private void writeForrbidden(HttpServletResponse response,String path) throws  IOException{
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        ApiError err = ApiError.of("PASSWORD_CHANGE_REQUIRED",
                "Bu hesap icin sifre degisikligi zorunlu. Lutfen once sifrenizi degistirin.",
                path);
        response.getWriter().write(objectMapper.writeValueAsString(err));
    }
}
