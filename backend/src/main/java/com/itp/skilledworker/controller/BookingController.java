package com.itp.skilledworker.controller;

import com.itp.skilledworker.dto.ApiResponse;
import com.itp.skilledworker.dto.BookingDtos.BookingCreateRequest;
import com.itp.skilledworker.dto.BookingDtos.BookingStatusUpdateRequest;
import com.itp.skilledworker.dto.BookingDtos.BookingUpdateRequest;
import com.itp.skilledworker.entity.*;
import com.itp.skilledworker.exception.BookingException;
import com.itp.skilledworker.repository.UserRepository;
import com.itp.skilledworker.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<ApiResponse<Booking>> createBooking(@Valid @RequestBody BookingCreateRequest body,
            Authentication auth) {
        Integer userId = getUserId(auth);
        Booking booking = bookingService.createBooking(
                body.getJobId(),
                body.getWorkerId(),
                userId,
                body.getScheduledDate(),
                body.getScheduledTime(),
                body.getNotes());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Booking created", booking));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<Booking>>> getMyBookings(
            Authentication auth,
            @RequestParam(defaultValue = "customer") String as) {
        Integer userId = getUserId(auth);
        List<Booking> bookings;
        if ("worker".equalsIgnoreCase(as)) {
            bookings = bookingService.getBookingsForWorker(userId);
        } else {
            bookings = bookingService.getBookingsForCustomer(userId);
        }
        return ResponseEntity.ok(ApiResponse.ok("Bookings fetched", bookings));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Booking>> getBooking(@PathVariable Integer id, Authentication auth) {
        Integer userId = getUserId(auth);
        Booking booking = bookingService.getBookingById(id, userId);
        return ResponseEntity.ok(ApiResponse.ok("Booking fetched", booking));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<Booking>> updateStatus(
            @PathVariable Integer id,
            @Valid @RequestBody BookingStatusUpdateRequest body,
            Authentication auth) {
        Integer userId = getUserId(auth);
        Booking updated = bookingService.updateBookingStatus(id, body.getStatus(), userId, body.getReason());
        return ResponseEntity.ok(ApiResponse.ok("Booking status updated to " + body.getStatus(), updated));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<ApiResponse<List<BookingStatusHistory>>> getHistory(@PathVariable Integer id, Authentication auth) {
        Integer userId = getUserId(auth);
        List<BookingStatusHistory> history = bookingService.getBookingHistory(id, userId);
        return ResponseEntity.ok(ApiResponse.ok("Booking history", history));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Booking>> updateBooking(
            @PathVariable Integer id,
            @Valid @RequestBody BookingUpdateRequest body,
            Authentication auth) {
        Integer userId = getUserId(auth);
        Booking updated = bookingService.updateBookingNotes(
                id, userId,
                body.getNotes(),
                body.getScheduledDate(),
                body.getScheduledTime());
        return ResponseEntity.ok(ApiResponse.ok("Booking updated", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<?>> deleteBooking(@PathVariable Integer id, Authentication auth) {
        Integer userId = getUserId(auth);
        bookingService.deleteBooking(id, userId);
        return ResponseEntity.ok(ApiResponse.ok("Booking deleted"));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<Booking>>> getAllBookings() {
        return ResponseEntity.ok(ApiResponse.ok("All bookings", bookingService.getAllBookings()));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getBookingStats() {
        return ResponseEntity.ok(ApiResponse.ok("Booking stats", bookingService.getBookingStats()));
    }

    @GetMapping("/worker/{workerId}/busy-dates")
    public ResponseEntity<ApiResponse<List<java.time.LocalDate>>> getBusyDates(@PathVariable Integer workerId) {
        return ResponseEntity.ok(ApiResponse.ok("Busy dates", bookingService.getWorkerBusyDates(workerId)));
    }

    @GetMapping("/worker/{workerId}/busy-slots")
    public ResponseEntity<ApiResponse<List<Map<String, String>>>> getBusySlots(@PathVariable Integer workerId) {
        return ResponseEntity.ok(ApiResponse.ok("Busy slots", bookingService.getWorkerBusySlots(workerId)));
    }

    private Integer getUserId(Authentication auth) {
        String email = auth.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BookingException(HttpStatus.UNAUTHORIZED, "User not found"))
                .getUserId();
    }
}
