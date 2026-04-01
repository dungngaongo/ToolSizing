package com.example.demo.exception;

/**
 * Exception được ném khi xác thực thất bại (401).
 */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}
