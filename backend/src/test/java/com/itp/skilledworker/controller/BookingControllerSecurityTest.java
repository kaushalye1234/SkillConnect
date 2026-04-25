package com.itp.skilledworker.controller;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class BookingControllerSecurityTest {

    @Test
    void bookingStatsEndpoint_requiresAdminRole() throws Exception {
        Method method = BookingController.class.getMethod("getBookingStats");
        PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);

        assertNotNull(annotation);
        assertEquals("hasRole('ADMIN')", annotation.value());
    }
}
