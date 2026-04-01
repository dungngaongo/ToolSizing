package com.example.sizing.exception;

/**
 * Exception được ném khi request không hợp lệ (400).
 */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }

    public BadRequestException(String message, Throwable cause) {
        super(message, cause);
    }
}
