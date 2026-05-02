package com.ahmedv2.zerostep.ratelimit;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;


@Service
public class RateLimiterService {

    private final ConcurrentHashMap<String, Bucket> loginBuckets    = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Bucket> executeBuckets  = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Bucket> extensionBuckets = new ConcurrentHashMap<>();

    // Login bucket IP bazlı
    public ConsumptionProbe tryConsumeLogin(String ipAddress) {
        Bucket bucket = loginBuckets.computeIfAbsent(ipAddress, k -> RateLimitBucket.loginBucket());
        return bucket.tryConsumeAndReturnRemaining(1);
    }

    // Execute bucket kullanıcı bazlı
    public ConsumptionProbe tryConsumeExecute(String username) {
        Bucket bucket = executeBuckets.computeIfAbsent(username, k -> RateLimitBucket.executeBucket());
        return bucket.tryConsumeAndReturnRemaining(1);
    }

    // Extension bucket token-hash bazlı
    public ConsumptionProbe tryConsumeExtension(String tokenKey) {
        Bucket bucket = extensionBuckets.computeIfAbsent(tokenKey, k ->RateLimitBucket.extensionBucket());
        return bucket.tryConsumeAndReturnRemaining(1);
    }
}
