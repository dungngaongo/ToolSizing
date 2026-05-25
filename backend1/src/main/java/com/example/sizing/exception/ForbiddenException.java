package com.example.sizing.exception;

/**
 * Exception được ném khi không có quyền truy cập (403).
 */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
