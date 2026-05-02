package com.ahmedv2.zerostep.ratelimit;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;

import java.time.Duration;

public final class RateLimitBucket {

    private RateLimitBucket() {}

    // Login: 5 istek / 15 dakika per IP
    public static Bucket loginBucket() {
    Bandwidth limit = Bandwidth.classic(5,Refill.greedy(5,Duration.ofMinutes(15)));
    return Bucket.builder().addLimit(limit).build();
    }

    // Execute: 10 istek / 1 dakika per user
    public static Bucket executeBucket() {
        Bandwidth limit = Bandwidth.classic(10,Refill.greedy(10,Duration.ofMinutes(1)));
        return Bucket.builder().addLimit(limit).build();
    }

    // Extension: 100 istek / 1 dakika per token
    public static Bucket extensionBucket() {
        Bandwidth limit = Bandwidth.classic(100,Refill.greedy(100,Duration.ofMinutes(1)));
        return Bucket.builder().addLimit(limit).build();
    }

}
