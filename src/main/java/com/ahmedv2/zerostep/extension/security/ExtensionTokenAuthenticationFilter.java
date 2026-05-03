//package com.ahmedv2.zerostep.extension.security;
//
//import com.ahmedv2.zerostep.extension.entity.ExtensionApiToken;
//import com.ahmedv2.zerostep.extension.service.ExtensionTokenService;
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
//import org.springframework.stereotype.Component;
//import org.springframework.web.filter.OncePerRequestFilter;
//
//import java.io.IOException;
//import java.util.stream.Collectors;
//
//// X-AFT-Token header'ı varsa ve geçerliyse SecurityContext'i set eder
//// JwtAuthenticationFilter'dan ÖNCE çalışır; zaten set edilmişse dokunmaz
//@Component
//@RequiredArgsConstructor
//@Slf4j
//public class ExtensionTokenAuthenticationFilter extends OncePerRequestFilter {
//
//    private static final String HEADER = "X-AFT-Token";
//    // "Authorization: Token <value>" alternatif format
//    private static final String ALT_PREFIX = "Token ";
//
//    private final ExtensionTokenService tokenService;
//
//    @Override
//    protected void doFilterInternal(@NonNull HttpServletRequest request,
//                                    @NonNull HttpServletResponse response,
//                                    @NonNull FilterChain filterChain)
//            throws ServletException, IOException {
//
//        // Sadece /api/v1/extension/** yollarında çalış; diğerlerine dokunma
//        String uri = request.getRequestURI();
//        if (!uri.startsWith("/api/v1/extension/")) {
//            filterChain.doFilter(request, response);
//            return;
//        }
//
//        // SecurityContext zaten dolu ise (JWT ile auth edilmiş) geç
//        if (SecurityContextHolder.getContext().getAuthentication() != null
//                && SecurityContextHolder.getContext().getAuthentication().isAuthenticated()) {
//            filterChain.doFilter(request, response);
//            return;
//        }
//
//        String plainToken = extractToken(request);
//        if (plainToken == null) {
//            filterChain.doFilter(request, response);
//            return;
//        }
//
//        ExtensionApiToken token = tokenService.validateAndTouch(plainToken);
//        if (token == null) {
//            log.debug("Extension token gecersiz veya expire: uri={}", uri);
//            filterChain.doFilter(request, response);
//            return;
//        }
//
//        // Token sahibinin rollerini authority olarak set et
//        var authorities = token.getUser().getRoles().stream()
//                .map(r -> new SimpleGrantedAuthority("ROLE_" + r.getName()))
//                .collect(Collectors.toSet());
//
//        var auth = new UsernamePasswordAuthenticationToken(
//                token.getUser().getUsername(), null, authorities);
//        SecurityContextHolder.getContext().setAuthentication(auth);
//        log.debug("Extension token auth: user={} uri={}", token.getUser().getUsername(), uri);
//
//        filterChain.doFilter(request, response);
//    }
//
//    private String extractToken(HttpServletRequest request) {
//        // Önce X-AFT-Token header'ına bak
//        String header = request.getHeader(HEADER);
//        if (header != null && !header.isBlank()) return header.trim();
//
//        // Sonra Authorization: Token <value> formatına bak
//        String authorization = request.getHeader("Authorization");
//        if (authorization != null && authorization.startsWith(ALT_PREFIX)) {
//            return authorization.substring(ALT_PREFIX.length()).trim();
//        }
//        return null;
//    }
//}




package com.ahmedv2.zerostep.extension.security;

import com.ahmedv2.zerostep.extension.entity.ExtensionApiToken;
import com.ahmedv2.zerostep.extension.service.ExtensionTokenService;
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
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.stream.Collectors;

// X-AFT-Token header'ı varsa ve geçerliyse SecurityContext'i set eder
// JwtAuthenticationFilter'dan ÖNCE çalışır; zaten set edilmişse dokunmaz
@Component
@RequiredArgsConstructor
@Slf4j
public class ExtensionTokenAuthenticationFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-AFT-Token";
    // "Authorization: Token <value>" alternatif format
    private static final String ALT_PREFIX = "Token ";

    private final ExtensionTokenService tokenService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        // EKLENEN KISIM: CORS Preflight (OPTIONS) istekleri token aramaz, doğrudan geçiş ver
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        // Sadece /api/v1/extension/** yollarında çalış; diğerlerine dokunma
        String uri = request.getRequestURI();
        if (!uri.startsWith("/api/v1/extension/")) {
            filterChain.doFilter(request, response);
            return;
        }

        // SecurityContext zaten dolu ise (JWT ile auth edilmiş) geç
        if (SecurityContextHolder.getContext().getAuthentication() != null
                && SecurityContextHolder.getContext().getAuthentication().isAuthenticated()) {
            filterChain.doFilter(request, response);
            return;
        }

        String plainToken = extractToken(request);
        if (plainToken == null) {
            filterChain.doFilter(request, response);
            return;
        }

        ExtensionApiToken token = tokenService.validateAndTouch(plainToken);
        if (token == null) {
            log.debug("Extension token gecersiz veya expire: uri={}", uri);
            filterChain.doFilter(request, response);
            return;
        }

        // Token sahibinin rollerini authority olarak set et
        var authorities = token.getUser().getRoles().stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r.getName()))
                .collect(Collectors.toSet());

        var auth = new UsernamePasswordAuthenticationToken(
                token.getUser().getUsername(), null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
        log.debug("Extension token auth: user={} uri={}", token.getUser().getUsername(), uri);

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        // Önce X-AFT-Token header'ına bak
        String header = request.getHeader(HEADER);
        if (header != null && !header.isBlank()) return header.trim();

        // Sonra Authorization: Token <value> formatına bak
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith(ALT_PREFIX)) {
            return authorization.substring(ALT_PREFIX.length()).trim();
        }
        return null;
    }
}