package com.itp.skilledworker.service;

import com.itp.skilledworker.entity.Booking;
import com.itp.skilledworker.entity.CustomerProfile;
import com.itp.skilledworker.entity.User;
import com.itp.skilledworker.entity.WorkerAvailability;
import com.itp.skilledworker.entity.WorkerProfile;
import com.itp.skilledworker.exception.BookingException;
import com.itp.skilledworker.repository.BookingRepository;
import com.itp.skilledworker.repository.BookingStatusHistoryRepository;
import com.itp.skilledworker.repository.CustomerProfileRepository;
import com.itp.skilledworker.repository.JobRepository;
import com.itp.skilledworker.repository.UserRepository;
import com.itp.skilledworker.repository.WorkerAvailabilityRepository;
import com.itp.skilledworker.repository.WorkerProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private BookingStatusHistoryRepository historyRepository;
    @Mock private JobRepository jobRepository;
    @Mock private WorkerProfileRepository workerProfileRepository;
    @Mock private WorkerAvailabilityRepository workerAvailabilityRepository;
    @Mock private CustomerProfileRepository customerProfileRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private BookingService bookingService;

    @Test
    void getBookingById_forbiddenForUnrelatedUser() {
        Booking booking = buildBooking(10, Booking.BookingStatus.requested, 2, 100, 200, LocalDate.now(), LocalTime.of(9, 0));
        User unrelated = buildUser(999, User.Role.customer);

        when(bookingRepository.findById(10)).thenReturn(Optional.of(booking));
        when(userRepository.findById(999)).thenReturn(Optional.of(unrelated));

        BookingException ex = assertThrows(BookingException.class, () -> bookingService.getBookingById(10, 999));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    void updateBookingStatus_customerCannotCancelInProgress() {
        Booking booking = buildBooking(11, Booking.BookingStatus.in_progress, 2, 101, 201, LocalDate.now(), LocalTime.of(10, 0));
        User customerActor = buildUser(101, User.Role.customer);

        when(bookingRepository.findById(11)).thenReturn(Optional.of(booking));
        when(userRepository.findById(101)).thenReturn(Optional.of(customerActor));

        BookingException ex = assertThrows(
                BookingException.class,
                () -> bookingService.updateBookingStatus(11, "cancelled", 101, "Need urgent stop"));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void updateBookingStatus_customerCannotAcceptOwnBooking() {
        Booking booking = buildBooking(12, Booking.BookingStatus.requested, 2, 101, 201, LocalDate.now(), LocalTime.of(10, 0));
        User customerActor = buildUser(101, User.Role.customer);

        when(bookingRepository.findById(12)).thenReturn(Optional.of(booking));
        when(userRepository.findById(101)).thenReturn(Optional.of(customerActor));

        BookingException ex = assertThrows(
                BookingException.class,
                () -> bookingService.updateBookingStatus(12, "accepted", 101, "trying to self accept"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    void updateBookingStatus_rejectsInvalidTransitionEvenForWorker() {
        Booking booking = buildBooking(13, Booking.BookingStatus.requested, 2, 101, 201, LocalDate.now(), LocalTime.of(10, 0));
        User workerActor = buildUser(201, User.Role.worker);

        when(bookingRepository.findById(13)).thenReturn(Optional.of(booking));
        when(userRepository.findById(201)).thenReturn(Optional.of(workerActor));

        BookingException ex = assertThrows(
                BookingException.class,
                () -> bookingService.updateBookingStatus(13, "completed", 201, "invalid jump"));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void updateBookingStatus_rejectsUnknownStatus() {
        Booking booking = buildBooking(14, Booking.BookingStatus.requested, 2, 101, 201, LocalDate.now(), LocalTime.of(10, 0));
        User workerActor = buildUser(201, User.Role.worker);

        when(bookingRepository.findById(14)).thenReturn(Optional.of(booking));
        when(userRepository.findById(201)).thenReturn(Optional.of(workerActor));

        BookingException ex = assertThrows(
                BookingException.class,
                () -> bookingService.updateBookingStatus(14, "accepted_now", 201, "invalid status"));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void createBooking_rejectsOverlappingSlot() {
        LocalDate date = LocalDate.now().plusDays(1);
        WorkerProfile worker = buildWorker(300, 201, true);
        CustomerProfile customer = buildCustomer(400, 101);
        BookingRepository.BookingOverlapProjection existing = mock(BookingRepository.BookingOverlapProjection.class);
        when(existing.getScheduledTime()).thenReturn(LocalTime.of(9, 0));
        when(existing.getEstimatedDurationHours()).thenReturn(2);

        when(workerProfileRepository.findById(201)).thenReturn(Optional.of(worker));
        when(customerProfileRepository.findByUser_UserId(101)).thenReturn(Optional.of(customer));
        when(workerAvailabilityRepository.findByWorker_WorkerIdAndAvailableDate(300, date)).thenReturn(List.of());
        when(bookingRepository.findConflictWindowData(eq(300), eq(date), any())).thenReturn(List.of(existing));

        BookingException ex = assertThrows(
                BookingException.class,
                () -> bookingService.createBooking(null, 201, 101, date.toString(), "10:00", "overlap check"));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
    }

    @Test
    void createBooking_rejectsWhenAvailabilityWindowDoesNotCoverRequestedSlot() {
        LocalDate date = LocalDate.now().plusDays(1);
        WorkerProfile worker = buildWorker(301, 202, true);
        CustomerProfile customer = buildCustomer(401, 102);
        WorkerAvailability availability = buildAvailability(LocalTime.of(12, 0), LocalTime.of(14, 0), true);

        when(workerProfileRepository.findById(202)).thenReturn(Optional.of(worker));
        when(customerProfileRepository.findByUser_UserId(102)).thenReturn(Optional.of(customer));
        when(workerAvailabilityRepository.findByWorker_WorkerIdAndAvailableDate(301, date)).thenReturn(List.of(availability));

        BookingException ex = assertThrows(
                BookingException.class,
                () -> bookingService.createBooking(null, 202, 102, date.toString(), "10:00", "outside availability"));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void updateBookingNotes_excludesCurrentBookingFromOverlapConflict() {
        LocalDate date = LocalDate.now().plusDays(2);
        Booking booking = buildBooking(21, Booking.BookingStatus.requested, 2, 101, 201, date, LocalTime.of(9, 0));
        User customerActor = buildUser(101, User.Role.customer);

        when(bookingRepository.findById(21)).thenReturn(Optional.of(booking));
        when(userRepository.findById(101)).thenReturn(Optional.of(customerActor));
        when(workerAvailabilityRepository.findByWorker_WorkerIdAndAvailableDate(booking.getWorker().getWorkerId(), date))
                .thenReturn(List.of());
        BookingRepository.BookingOverlapProjection existing = mock(BookingRepository.BookingOverlapProjection.class);
        when(existing.getBookingId()).thenReturn(booking.getBookingId());
        when(bookingRepository.findConflictWindowData(eq(booking.getWorker().getWorkerId()), eq(date), any()))
                .thenReturn(List.of(existing));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Booking updated = bookingService.updateBookingNotes(21, 101, "Updated notes", date.toString(), "10:00");

        assertEquals("Updated notes", updated.getNotes());
        assertEquals(LocalTime.of(10, 0), updated.getScheduledTime());
    }

    @Test
    void updateBookingStatus_acceptedNotifiesCustomer() {
        Booking booking = buildBooking(31, Booking.BookingStatus.requested, 2, 101, 201, LocalDate.now(), LocalTime.of(11, 0));
        User workerActor = buildUser(201, User.Role.worker);

        when(bookingRepository.findById(31)).thenReturn(Optional.of(booking));
        when(userRepository.findById(201)).thenReturn(Optional.of(workerActor));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        bookingService.updateBookingStatus(31, "accepted", 201, "can do this");

        verify(notificationService, times(1)).createNotification(
                eq(booking.getCustomer().getUser()),
                eq("Booking Accepted"),
                contains("has been accepted"),
                eq("/bookings"));
    }

    @Test
    void updateBookingStatus_inProgressDoesNotSendStatusNotification() {
        Booking booking = buildBooking(32, Booking.BookingStatus.accepted, 2, 101, 201, LocalDate.now(), LocalTime.of(11, 0));
        User workerActor = buildUser(201, User.Role.worker);

        when(bookingRepository.findById(32)).thenReturn(Optional.of(booking));
        when(userRepository.findById(201)).thenReturn(Optional.of(workerActor));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        bookingService.updateBookingStatus(32, "in_progress", 201, "started");

        verify(notificationService, never()).createNotification(
                eq(booking.getCustomer().getUser()),
                anyString(),
                anyString(),
                eq("/bookings"));
    }

    @Test
    void updateBookingStatus_completedSendsReviewReminders() {
        Booking booking = buildBooking(33, Booking.BookingStatus.in_progress, 2, 101, 201, LocalDate.now(), LocalTime.of(11, 0));
        User workerActor = buildUser(201, User.Role.worker);

        when(bookingRepository.findById(33)).thenReturn(Optional.of(booking));
        when(userRepository.findById(201)).thenReturn(Optional.of(workerActor));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Booking updated = bookingService.updateBookingStatus(33, "completed", 201, "done");

        assertNotNull(updated.getCompletedAt());
        ArgumentCaptor<String> titleCaptor = ArgumentCaptor.forClass(String.class);
        verify(notificationService, times(2)).createNotification(
                any(User.class),
                titleCaptor.capture(),
                anyString(),
                eq("/reviews"));
        assertTrue(titleCaptor.getAllValues().contains("Review your worker"));
        assertTrue(titleCaptor.getAllValues().contains("Review your customer"));
    }

    @Test
    void updateBookingStatus_cancelledNotifiesCustomer() {
        Booking booking = buildBooking(34, Booking.BookingStatus.accepted, 2, 101, 201, LocalDate.now(), LocalTime.of(11, 0));
        User workerActor = buildUser(201, User.Role.worker);

        when(bookingRepository.findById(34)).thenReturn(Optional.of(booking));
        when(userRepository.findById(201)).thenReturn(Optional.of(workerActor));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        bookingService.updateBookingStatus(34, "cancelled", 201, "unable to attend");

        verify(notificationService, times(1)).createNotification(
                eq(booking.getCustomer().getUser()),
                eq("Booking Cancelled"),
                contains("has been cancelled"),
                eq("/bookings"));
    }

    @Test
    void getBookingStats_returnsCompletedAndPendingCounts() {
        when(bookingRepository.countByBookingStatus(Booking.BookingStatus.completed)).thenReturn(1L);
        when(bookingRepository.countByBookingStatus(Booking.BookingStatus.requested)).thenReturn(1L);

        Map<String, Long> stats = bookingService.getBookingStats();
        assertEquals(1L, stats.get("completed"));
        assertEquals(1L, stats.get("pending"));
    }

    @Test
    void getBookingStats_returnsZeroWhenNoBookingsExist() {
        when(bookingRepository.countByBookingStatus(Booking.BookingStatus.completed)).thenReturn(0L);
        when(bookingRepository.countByBookingStatus(Booking.BookingStatus.requested)).thenReturn(0L);

        Map<String, Long> stats = bookingService.getBookingStats();
        assertEquals(0L, stats.get("completed"));
        assertEquals(0L, stats.get("pending"));
    }

    private WorkerAvailability buildAvailability(LocalTime start, LocalTime end, boolean isAvailable) {
        WorkerAvailability availability = new WorkerAvailability();
        availability.setStartTime(start);
        availability.setEndTime(end);
        availability.setIsAvailable(isAvailable);
        return availability;
    }

    private Booking buildBooking(
            int bookingId,
            Booking.BookingStatus status,
            int durationHours,
            int customerUserId,
            int workerUserId,
            LocalDate date,
            LocalTime time) {
        Booking booking = new Booking();
        booking.setBookingId(bookingId);
        booking.setBookingStatus(status);
        booking.setEstimatedDurationHours(durationHours);
        booking.setScheduledDate(date);
        booking.setScheduledTime(time);
        booking.setCustomer(buildCustomer(500 + bookingId, customerUserId));
        booking.setWorker(buildWorker(600 + bookingId, workerUserId, true));
        return booking;
    }

    private CustomerProfile buildCustomer(int customerId, int userId) {
        CustomerProfile customer = new CustomerProfile();
        customer.setCustomerId(customerId);
        customer.setUser(buildUser(userId, User.Role.customer));
        customer.setFirstName("Customer");
        customer.setLastName("User");
        return customer;
    }

    private WorkerProfile buildWorker(int workerId, int userId, boolean verified) {
        WorkerProfile worker = new WorkerProfile();
        worker.setWorkerId(workerId);
        worker.setUser(buildUser(userId, User.Role.worker));
        worker.setFirstName("Worker");
        worker.setLastName("User");
        worker.setIsVerified(verified);
        return worker;
    }

    private User buildUser(int userId, User.Role role) {
        User user = new User();
        user.setUserId(userId);
        user.setRole(role);
        user.setEmail("user" + userId + "@test.com");
        return user;
    }
}
