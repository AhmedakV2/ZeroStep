package com.ahmedv2.zerostep.security.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class CspNonceFilter extends OncePerRequestFilter {

    private static final String NONCE_ATTRIBUTE = "cspNonce";
    private static final SecureRandom random = new SecureRandom();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String nonce = generateNonce();
        request.setAttribute(NONCE_ATTRIBUTE, nonce);
        response.setHeader("Content-Security-Policy", buildCspPolicy(nonce));
        filterChain.doFilter(request, response);
    }

    private String buildCspPolicy(String nonce) {
        String nonceValue = "'nonce-" + nonce + "'";
        return String.join(" ",
                // Script'ler nonce ile korunur — XSS ana savunması
                "script-src 'self' " + nonceValue + " https://cdnjs.cloudflare.com;",

                // Style'lar unsafe-inline — nonce ile çakışmaz çünkü style-src'de nonce YOK
                // Inline style="" attribute'ları, chart/widget kütüphaneleri bunun için gerekli
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;",

                "default-src 'self';",
                "img-src 'self' data: https:;",
                "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com https://cdnjs.cloudflare.com;",
                "connect-src 'self' ws://localhost:8080 wss://localhost:8080;",
                "frame-ancestors 'none';",
                "base-uri 'self';",
                "form-action 'self';"
        );
    }

    private String generateNonce() {
        byte[] nonceBytes = new byte[16];
        random.nextBytes(nonceBytes);
        return Base64.getEncoder().encodeToString(nonceBytes);
    }

    public static String getNonce(HttpServletRequest request) {
        Object nonce = request.getAttribute(NONCE_ATTRIBUTE);
        return nonce != null ? nonce.toString() : "";
    }
}