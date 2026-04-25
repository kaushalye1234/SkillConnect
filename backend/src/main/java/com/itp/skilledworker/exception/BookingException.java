package com.itp.skilledworker.exception;

import org.springframework.http.HttpStatus;

public class BookingException extends RuntimeException {
    private final HttpStatus status;

    public BookingException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
