package com.example.sizing.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

public class JwtUtil {
    private static final String secret = System.getenv().getOrDefault("JWT_SECRET", "change-this-secret-to-a-strong-random-value");
    private static final Key key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    private static final long EXP_MILLIS = 24 * 60 * 60 * 1000; // 1 day

    public static String generateToken(String username, String role) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(username)
                .claim("role", role)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + EXP_MILLIS))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public static Jws<Claims> parseToken(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
    }
}
