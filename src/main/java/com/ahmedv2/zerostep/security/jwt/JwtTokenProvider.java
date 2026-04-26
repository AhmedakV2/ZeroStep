package com.ahmedv2.zerostep.security.jwt;


import com.ahmedv2.zerostep.config.properties.AppProperties;
import com.ahmedv2.zerostep.user.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;


@Component
@RequiredArgsConstructor
@Slf4j
public class JwtTokenProvider {

    private final AppProperties appProperties;

    private SecretKey signingKey;

    @PostConstruct
    void init(){

        String secret = appProperties.getSecurity().getJwt().getSecret();
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if(keyBytes.length < 32){
            throw new IllegalStateException("JWT secret en az 32 byte (256) olmali. Mevcut:"+keyBytes.length+"byte");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        log.info("JWT provider hazir; issuer={}, accesssTtl={}min",
                appProperties.getSecurity().getJwt().getIssuer(),
                appProperties.getSecurity().getJwt().getAccessTokenTtlMinutes());

    }

    public String generateAccessToken(User user){
        var jwt = appProperties.getSecurity().getJwt();
        Instant now = Instant.now();
        Instant expiry = now.plus(Duration.ofMinutes(jwt.getAccessTokenTtlMinutes()));

        List<String> roles = user.getRoles().stream()
                .map(r -> "ROLE_"+r.getName())
                .collect(Collectors.toList());

        return Jwts.builder()
                .issuer(jwt.getIssuer())
                .subject(user.getUsername())
                .claim("uid", user.getId())
                .claim("pid", user.getPublicId().toString())
                .claim("roles", roles)
                // passwordChangeRequired claim'i; frontend bu flag ile yonlendirme yapar
                .claim("pwd_change", user.isPasswordChangeRequired())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(signingKey)
                .compact();
    }

    public String getUsername(String token) {
        return parseClaims(token).getSubject();
    }
    public Long getUserId(String token) {
        return parseClaims(token).get("uid",Long.class);
    }

    @SuppressWarnings("unchecked")
    public Set<String> getRoles(String token){
        List<String> roles = parseClaims(token).get("roles",List.class);
        return roles == null ? Set.of() : Set.copyOf(roles);
    }

    public boolean  isPasswordChangeRequired(String token){
        Boolean v = parseClaims(token).get("pwd_change",Boolean.class);
        return Boolean.TRUE.equals(v);
    }

    public boolean isValid(String token){

        try{
            parseClaims(token);
            return  true;
        }catch (ExpiredJwtException e) {
            log.debug("JWT expired: {}", e.getMessage());
        }catch (JwtException | IllegalArgumentException e ){
            log.debug("Jwt invalid: {}", e.getMessage());
        }
        return  false;
    }

    private Claims parseClaims(String token){
        return Jwts.parser()
                .verifyWith(signingKey)
                .requireIssuer(appProperties.getSecurity().getJwt().getIssuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
