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

/**
 * CSP Nonce Filter: Her request için unique nonce generate eder ve CSP header'ına ekler.
 * 
 * - HTML GET request'lerine CSP header setler (nonce ile)
 * - Frontend <meta id="csp-nonce"> içinde nonce'u okuyabilir
 * - Inline script'ler nonce attribute'u almalı: <script nonce="...">
 * - Production/Dev: Nonce-based CSP (unsafe-inline KAYIT — XSS koruması artar)
 */
@Component
public class CspNonceFilter extends OncePerRequestFilter {

    private static final String NONCE_ATTRIBUTE = "cspNonce";
    private static final String NONCE_META_ATTRIBUTE = "_cspNonceMeta";
    private static final SecureRandom random = new SecureRandom();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String nonce = generateNonce();
        request.setAttribute(NONCE_ATTRIBUTE, nonce);
        request.setAttribute(NONCE_META_ATTRIBUTE, nonce);  // JSP/Template tarafından kullanılabilir

        // CSP header'ı set et (tüm response'larına)
        String cspPolicy = buildCspPolicy(nonce);
        response.setHeader("Content-Security-Policy", cspPolicy);
        // Report-Only mode (development'ta debug için faydalı — production'da kaldırılabilir)
        // response.setHeader("Content-Security-Policy-Report-Only", cspPolicy);

        filterChain.doFilter(request, response);
    }

    private String buildCspPolicy(String nonce) {
        String nonceValue = "'nonce-" + nonce + "'";
        return "default-src 'self'; " +
                "script-src 'self' " + nonceValue + " https://cdnjs.cloudflare.com; " +
                "style-src 'self' " + nonceValue + " https://fonts.googleapis.com; " +
                "img-src 'self' data: https:; " +
                "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; " +
                "connect-src 'self' ws: wss: https://fonts.googleapis.com https://fonts.gstatic.com; " +
                "frame-ancestors 'none'; " +
                "base-uri 'self'; " +
                "form-action 'self'";
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

