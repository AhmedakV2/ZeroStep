//package com.ahmedv2.zerostep.security.filter;
//
//import com.ahmedv2.zerostep.security.jwt.JwtTokenProvider;
//import jakarta.servlet.FilterChain;
//import jakarta.servlet.ServletException;
//import jakarta.servlet.http.HttpServletRequest;
//import jakarta.servlet.http.HttpServletResponse;
//import lombok.RequiredArgsConstructor;
//import lombok.extern.slf4j.Slf4j;
//import org.springframework.lang.NonNull;
//import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
//import org.springframework.security.core.authority.SimpleGrantedAuthority;
//import org.springframework.security.core.context.SecurityContextHolder;
//import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
//import org.springframework.stereotype.Component;
//import org.springframework.web.filter.OncePerRequestFilter;
//
//import java.io.IOException;
//import java.util.Set;
//import java.util.stream.Collectors;
//
//
//@Component
//@RequiredArgsConstructor
//@Slf4j
//public class JwtAuthenticationFilter extends OncePerRequestFilter {
//
//    private static final String BEARER_PREFIX = "Bearer ";
//    private static final String HEADER_AUTH = "Authorization";
//
//    private static final String QUERY_TOKEN_PARAM = "token";
//
//    private final JwtTokenProvider jwtTokenProvider;
//
//    @Override
//    protected void doFilterInternal(@NonNull HttpServletRequest request,
//                                    @NonNull HttpServletResponse response,
//                                    @NonNull FilterChain filterChain)
//            throws ServletException, IOException {
//
//        String token = resolveToken(request);
//
//        if (token != null && jwtTokenProvider.isValid(token)) {
//            try {
//                String username = jwtTokenProvider.getUsername(token);
//                Set<String> roles = jwtTokenProvider.getRoles(token);
//
//
//                var authorities = roles.stream()
//                        .map(SimpleGrantedAuthority::new)
//                        .collect(Collectors.toSet());
//
//                var authentication = new UsernamePasswordAuthenticationToken(username, null, authorities);
//                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
//                SecurityContextHolder.getContext().setAuthentication(authentication);
//            } catch (Exception e) {
//                log.debug("JWT filter auth kurarken hata: {}", e.getMessage());
//                SecurityContextHolder.clearContext();
//            }
//        }
//
//        filterChain.doFilter(request, response);
//    }
//
//
//    private String resolveToken(HttpServletRequest request) {
//        String bearer = request.getHeader(HEADER_AUTH);
//        if (bearer != null && bearer.startsWith(BEARER_PREFIX)) {
//            return bearer.substring(BEARER_PREFIX.length()).trim();
//        }
//
//        // SSE endpoint'leri header gonderemez; query param'dan token al
//        // Ornek: /api/v1/executions/{publicId}/stream?token=xxx
//        String uri = request.getRequestURI();
//        if (uri != null && uri.endsWith("/stream")) {
//            return request.getParameter(QUERY_TOKEN_PARAM);
//        }
//        return null;
//    }
//}


package com.ahmedv2.zerostep.security.filter;

import com.ahmedv2.zerostep.security.jwt.JwtTokenProvider;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX   = "Bearer ";
    private static final String HEADER_AUTH     = "Authorization";
    private static final String QUERY_TOKEN_PARAM = "token";

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        // OPTIONS preflight — token arama yok, doğrudan geçir
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = resolveToken(request);

        if (token != null && jwtTokenProvider.isValid(token)) {
            try {
                String username = jwtTokenProvider.getUsername(token);
                Set<String> roles = jwtTokenProvider.getRoles(token);

                var authorities = roles.stream()
                        .map(SimpleGrantedAuthority::new)
                        .collect(Collectors.toSet());

                var authentication = new UsernamePasswordAuthenticationToken(
                        username, null, authorities);
                authentication.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);

            } catch (Exception e) {
                log.debug("JWT filter auth hatası: {}", e.getMessage());
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        // 1. Önce Authorization: Bearer <token> header'ına bak
        String bearer = request.getHeader(HEADER_AUTH);
        if (bearer != null && bearer.startsWith(BEARER_PREFIX)) {
            return bearer.substring(BEARER_PREFIX.length()).trim();
        }

        // 2. SSE endpoint için query param — EventSource header gönderemez
        // /stream ile biten her path için token query param'ından oku
        String uri = request.getRequestURI();
        if (uri != null && uri.endsWith("/stream")) {
            String queryToken = request.getParameter(QUERY_TOKEN_PARAM);
            if (queryToken != null && !queryToken.isBlank()) {
                return queryToken.trim();
            }
        }

        return null;
    }
}