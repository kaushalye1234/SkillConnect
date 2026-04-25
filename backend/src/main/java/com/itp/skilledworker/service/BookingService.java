package com.itp.skilledworker.service;

import com.itp.skilledworker.entity.*;
import com.itp.skilledworker.exception.BookingException;
import com.itp.skilledworker.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class BookingService {
    private static final int DEFAULT_DURATION_HOURS = 2;
    private static final List<Booking.BookingStatus> BLOCKING_BOOKING_STATUSES = List.of(
            Booking.BookingStatus.requested,
            Booking.BookingStatus.accepted,
            Booking.BookingStatus.in_progress);
    private static final List<Booking.BookingStatus> BUSY_DATE_STATUSES = List.of(
            Booking.BookingStatus.accepted,
            Booking.BookingStatus.in_progress);
    private static final Set<Booking.BookingStatus> CUSTOMER_NOTIFICATION_STATUSES = Set.of(
            Booking.BookingStatus.accepted,
            Booking.BookingStatus.rejected,
            Booking.BookingStatus.cancelled);

    private final BookingRepository bookingRepository;
    private final BookingStatusHistoryRepository historyRepository;
    private final JobRepository jobRepository;
    private final WorkerProfileRepository workerProfileRepository;
    private final WorkerAvailabilityRepository workerAvailabilityRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public Booking createBooking(Integer jobId, Integer workerId, Integer customerUserId,
            String scheduledDate, String scheduledTime, String notes) {
        // job is optional – customers can book workers directly
        Job job = null;
        if (jobId != null) {
            job = jobRepository.findById(jobId)
                    .orElseThrow(() -> new BookingException(HttpStatus.NOT_FOUND, "Job not found"));
            if (!job.getCustomer().getUser().getUserId().equals(customerUserId)) {
                throw new BookingException(HttpStatus.FORBIDDEN, "You can only link your own job to a booking.");
            }
        }
        WorkerProfile worker = workerProfileRepository.findById(workerId)
            .orElseThrow(() -> new BookingException(HttpStatus.NOT_FOUND, "Worker not found"));
        if (!Boolean.TRUE.equals(worker.getIsVerified())) {
            throw new BookingException(HttpStatus.BAD_REQUEST, "Worker is not verified and cannot be booked yet.");
        }
        CustomerProfile customer = findCustomerProfileOrThrow(customerUserId);

        int requestedDurationHours = DEFAULT_DURATION_HOURS;
        BookingTimeWindow requestedWindow = parseRequestedWindow(scheduledDate, scheduledTime, requestedDurationHours);
        validateWorkerSchedule(worker.getWorkerId(), requestedWindow, null);

        Booking booking = buildRequestedBooking(job, worker, customer, notes, requestedDurationHours, requestedWindow);
        booking = bookingRepository.save(booking);

        logStatusChange(booking, null, Booking.BookingStatus.requested.name(), customer.getUser(), "Booking created");
        
        notificationService.createNotification(
            worker.getUser(),
            "New Booking Request",
            customer.getFirstName() + " requested a booking for " + requestedWindow.date() + " at " + requestedWindow.start() + ".",
            "/worker/bookings"
        );
        
        return booking;
    }

    public List<Booking> getBookingsForWorker(Integer workerUserId) {
        WorkerProfile worker = findWorkerProfileByUserOrThrow(workerUserId);
        return bookingRepository.findByWorker_WorkerId(worker.getWorkerId());
    }

    public List<Booking> getBookingsForCustomer(Integer customerUserId) {
        CustomerProfile customer = findCustomerProfileByUserOrThrow(customerUserId);
        return bookingRepository.findByCustomer_CustomerId(customer.getCustomerId());
    }

    public Booking getBookingById(Integer bookingId, Integer actorUserId) {
        Booking booking = findBookingOrThrow(bookingId);
        User actor = findUserOrThrow(actorUserId);
        assertCanAccessBooking(booking, actor);
        return booking;
    }

    @Transactional
    public Booking updateBookingStatus(Integer bookingId, String newStatus, Integer actorUserId, String reason) {
        Booking booking = findBookingOrThrow(bookingId);
        User actor = findUserOrThrow(actorUserId);
        assertCanAccessBooking(booking, actor);

        Booking.BookingStatus oldStatus = booking.getBookingStatus();
        Booking.BookingStatus targetStatus = parseBookingStatus(newStatus);

        validateTransition(oldStatus, targetStatus);
        validateTransitionActorPermissions(booking, actor, targetStatus);

        booking.setBookingStatus(targetStatus);
        applyStatusSideEffects(booking, targetStatus, reason);

        booking = bookingRepository.save(booking);
        logStatusChange(booking, oldStatus.name(), targetStatus.name(), actor, reason);
        triggerStatusNotifications(booking, targetStatus);
        return booking;
    }

    private void validateTransition(Booking.BookingStatus from, Booking.BookingStatus to) {
        boolean valid = switch (from) {
            case requested -> to == Booking.BookingStatus.accepted || to == Booking.BookingStatus.rejected
                    || to == Booking.BookingStatus.cancelled;
            case accepted -> to == Booking.BookingStatus.in_progress || to == Booking.BookingStatus.cancelled;
            case in_progress -> to == Booking.BookingStatus.completed || to == Booking.BookingStatus.cancelled;
            default -> false;
        };
        if (!valid) {
            throw new BookingException(HttpStatus.BAD_REQUEST, "Invalid status transition: " + from + " → " + to);
        }
    }

    private void logStatusChange(Booking booking, String oldStatus, String newStatus, User changedBy, String reason) {
        BookingStatusHistory history = new BookingStatusHistory();
        history.setBooking(booking);
        history.setOldStatus(oldStatus);
        history.setNewStatus(newStatus);
        history.setChangedBy(changedBy);
        history.setChangeReason(reason);
        historyRepository.save(history);
    }

    public List<BookingStatusHistory> getBookingHistory(Integer bookingId, Integer actorUserId) {
        Booking booking = getBookingById(bookingId, actorUserId);
        return historyRepository.findByBooking_BookingIdOrderByChangedAtAsc(booking.getBookingId());
    }

    @Transactional
    public Booking updateBookingNotes(Integer bookingId, Integer actorUserId, String notes, String scheduledDate,
            String scheduledTime) {
        Booking booking = findBookingOrThrow(bookingId);
        User actor = findUserOrThrow(actorUserId);
        assertCanAccessBooking(booking, actor);
        if (!actor.getRole().equals(User.Role.admin)
                && !booking.getCustomer().getUser().getUserId().equals(actor.getUserId())) {
            throw new BookingException(HttpStatus.FORBIDDEN, "Only the customer can edit this booking.");
        }

        // Only allow edits when booking is still in 'requested' state
        if (booking.getBookingStatus() != Booking.BookingStatus.requested) {
            throw new BookingException(HttpStatus.BAD_REQUEST, "Can only edit a booking that is still in 'requested' status.");
        }
        if (notes != null) {
            booking.setNotes(notes);
        }

        int durationHours = resolveDurationHours(booking.getEstimatedDurationHours());
        BookingTimeWindow requestedWindow = resolveRequestedWindowForUpdate(booking, scheduledDate, scheduledTime, durationHours);
        validateWorkerSchedule(booking.getWorker().getWorkerId(), requestedWindow, booking.getBookingId());

        booking.setScheduledDate(requestedWindow.date());
        booking.setScheduledTime(requestedWindow.start());
        return bookingRepository.save(booking);
    }

    @Transactional
    public void deleteBooking(Integer bookingId, Integer actorUserId) {
        Booking booking = findBookingOrThrow(bookingId);
        User actor = findUserOrThrow(actorUserId);
        assertCanAccessBooking(booking, actor);

        boolean isAdmin = actor.getRole() == User.Role.admin;
        boolean isCustomerOwner = booking.getCustomer().getUser().getUserId().equals(actor.getUserId());
        if (!isAdmin && !isCustomerOwner) {
            throw new BookingException(HttpStatus.FORBIDDEN, "Only the customer can delete this booking.");
        }

        // Only allow deletion when in a terminal or initial cancellable state
        Booking.BookingStatus status = booking.getBookingStatus();
        if (status == Booking.BookingStatus.in_progress || status == Booking.BookingStatus.accepted) {
            throw new BookingException(HttpStatus.BAD_REQUEST, "Cannot delete an active booking. Cancel it first.");
        }
        historyRepository.deleteByBooking_BookingId(bookingId);
        bookingRepository.delete(booking);
    }

    public List<Booking> getAllBookings() {
        return bookingRepository.findAll();
    }

    public Map<String, Long> getBookingStats() {
        long completed = bookingRepository.countByBookingStatus(Booking.BookingStatus.completed);
        long pending = bookingRepository.countByBookingStatus(Booking.BookingStatus.requested);
        return Map.of("completed", completed, "pending", pending);
    }

    public List<LocalDate> getWorkerBusyDates(Integer workerId) {
        return bookingRepository.findBusyDates(workerId, BUSY_DATE_STATUSES);
    }

    public List<Map<String, String>> getWorkerBusySlots(Integer workerId) {
        return bookingRepository.findBusySlots(
                workerId,
                BLOCKING_BOOKING_STATUSES)
                .stream()
                .map(b -> Map.of(
                        "scheduledDate", b.getScheduledDate().toString(),
                        "scheduledTime", b.getScheduledTime().toString()))
                .toList();
    }

    private void sendReviewReminders(Booking booking) {
        User workerUser = booking.getWorker().getUser();
        User customerUser = booking.getCustomer().getUser();

        String workerName = buildDisplayName(booking.getWorker().getFirstName(), booking.getWorker().getLastName(),
                workerUser.getEmail());
        String customerName = buildDisplayName(booking.getCustomer().getFirstName(), booking.getCustomer().getLastName(),
                customerUser.getEmail());

        notificationService.createNotification(
                customerUser,
                "Review your worker",
                "Please rate " + workerName + " for booking #" + booking.getBookingId() + ".",
                "/reviews");

        notificationService.createNotification(
                workerUser,
                "Review your customer",
                "Share feedback about " + customerName + " for booking #" + booking.getBookingId() + ".",
                "/reviews");
    }

    private void notifyCustomerOnStatusChange(Booking booking, Booking.BookingStatus status) {
        if (!CUSTOMER_NOTIFICATION_STATUSES.contains(status)) {
            return;
        }

        String title = switch (status) {
            case accepted -> "Booking Accepted";
            case rejected -> "Booking Rejected";
            case cancelled -> "Booking Cancelled";
            default -> throw new IllegalStateException("Unexpected booking status: " + status);
        };
        String message = switch (status) {
            case accepted -> "Your booking for " + booking.getScheduledDate() + " has been accepted.";
            case rejected -> "Your booking for " + booking.getScheduledDate() + " was rejected.";
            case cancelled -> "Your booking for " + booking.getScheduledDate() + " has been cancelled.";
            default -> throw new IllegalStateException("Unexpected booking status: " + status);
        };

        notificationService.createNotification(
                booking.getCustomer().getUser(),
                title,
                message,
                "/bookings");
    }

    private Booking buildRequestedBooking(
            Job job,
            WorkerProfile worker,
            CustomerProfile customer,
            String notes,
            int durationHours,
            BookingTimeWindow requestedWindow) {
        Booking booking = new Booking();
        booking.setJob(job);
        booking.setWorker(worker);
        booking.setCustomer(customer);
        booking.setScheduledDate(requestedWindow.date());
        booking.setScheduledTime(requestedWindow.start());
        booking.setEstimatedDurationHours(durationHours);
        booking.setNotes(notes);
        booking.setBookingStatus(Booking.BookingStatus.requested);
        return booking;
    }

    private BookingTimeWindow parseRequestedWindow(String scheduledDate, String scheduledTime, int durationHours) {
        LocalDate date = LocalDate.parse(scheduledDate);
        LocalTime start = LocalTime.parse(scheduledTime);
        LocalTime end = start.plusHours(durationHours);
        return new BookingTimeWindow(date, start, end);
    }

    private BookingTimeWindow resolveRequestedWindowForUpdate(
            Booking booking,
            String scheduledDate,
            String scheduledTime,
            int durationHours) {
        LocalDate date = booking.getScheduledDate();
        LocalTime start = booking.getScheduledTime();

        if (scheduledDate != null && !scheduledDate.isBlank()) {
            date = LocalDate.parse(scheduledDate);
        }
        if (scheduledTime != null && !scheduledTime.isBlank()) {
            start = LocalTime.parse(scheduledTime);
        }
        return new BookingTimeWindow(date, start, start.plusHours(durationHours));
    }

    private void validateWorkerSchedule(Integer workerId, BookingTimeWindow requestedWindow, Integer excludeBookingId) {
        // If the worker has configured availability entries for this date,
        // enforce that the requested window falls inside at least one
        // explicitly available window. If they have not configured anything
        // for this date, treat the worker as available by default.
        validateWorkerAvailabilityWindow(workerId, requestedWindow.date(), requestedWindow.start(), requestedWindow.end());
        ensureNoOverlappingBooking(workerId, requestedWindow.date(), requestedWindow.start(), requestedWindow.end(), excludeBookingId);
    }

    private void triggerStatusNotifications(Booking booking, Booking.BookingStatus targetStatus) {
        notifyCustomerOnStatusChange(booking, targetStatus);
        if (targetStatus == Booking.BookingStatus.completed) {
            sendReviewReminders(booking);
        }
    }

    private String buildDisplayName(String firstName, String lastName, String fallback) {
        StringBuilder sb = new StringBuilder();
        if (firstName != null && !firstName.isBlank()) {
            sb.append(firstName.trim());
        }
        if (lastName != null && !lastName.isBlank()) {
            if (sb.length() > 0) {
                sb.append(" ");
            }
            sb.append(lastName.trim());
        }
        String result = sb.toString().trim();
        return result.isEmpty() ? fallback : result;
    }

    private int resolveDurationHours(Integer durationHours) {
        if (durationHours == null || durationHours <= 0) {
            return DEFAULT_DURATION_HOURS;
        }
        return durationHours;
    }

    private void validateWorkerAvailabilityWindow(Integer workerId, LocalDate date, LocalTime start, LocalTime end) {
        List<WorkerAvailability> dayAvailability = workerAvailabilityRepository
                .findByWorker_WorkerIdAndAvailableDate(workerId, date);
        if (dayAvailability.isEmpty()) {
            return;
        }

        boolean hasCoveringWindow = dayAvailability.stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsAvailable()))
                .anyMatch(a -> a.getStartTime() != null
                        && a.getEndTime() != null
                        && !a.getStartTime().isAfter(start)
                        && !a.getEndTime().isBefore(end));

        if (!hasCoveringWindow) {
            throw new BookingException(HttpStatus.BAD_REQUEST, "Worker is not available for the selected booking duration.");
        }
    }

    private void ensureNoOverlappingBooking(
            Integer workerId,
            LocalDate date,
            LocalTime requestedStart,
            LocalTime requestedEnd,
            Integer excludeBookingId) {
        List<BookingRepository.BookingOverlapProjection> dayBookings = bookingRepository.findConflictWindowData(
                workerId,
                date,
                BLOCKING_BOOKING_STATUSES);

        for (BookingRepository.BookingOverlapProjection existing : dayBookings) {
            if (excludeBookingId != null && excludeBookingId.equals(existing.getBookingId())) {
                continue;
            }
            LocalTime existingStart = existing.getScheduledTime();
            int duration = resolveDurationHours(existing.getEstimatedDurationHours());
            LocalTime existingEnd = existingStart.plusHours(duration);

            if (requestedStart.isBefore(existingEnd) && existingStart.isBefore(requestedEnd)) {
                throw new BookingException(HttpStatus.CONFLICT, "Selected slot overlaps with an existing booking.");
            }
        }
    }

    private void assertCanAccessBooking(Booking booking, User actor) {
        if (actor.getRole() == User.Role.admin) {
            return;
        }
        Integer actorId = actor.getUserId();
        Integer customerUserId = booking.getCustomer().getUser().getUserId();
        Integer workerUserId = booking.getWorker().getUser().getUserId();
        if (!actorId.equals(customerUserId) && !actorId.equals(workerUserId)) {
            throw new BookingException(HttpStatus.FORBIDDEN, "Unauthorized booking access.");
        }
    }

    private void validateTransitionActorPermissions(Booking booking, User actor, Booking.BookingStatus targetStatus) {
        if (actor.getRole() == User.Role.admin) {
            return;
        }
        boolean isWorker = booking.getWorker().getUser().getUserId().equals(actor.getUserId());
        boolean isCustomer = booking.getCustomer().getUser().getUserId().equals(actor.getUserId());

        if (isWorker) {
            return;
        }
        if (isCustomer && targetStatus == Booking.BookingStatus.cancelled) {
            Booking.BookingStatus current = booking.getBookingStatus();
            if (current == Booking.BookingStatus.requested || current == Booking.BookingStatus.accepted) {
                return;
            }
            throw new BookingException(HttpStatus.BAD_REQUEST, "Customers can only cancel requested or accepted bookings.");
        }
        throw new BookingException(HttpStatus.FORBIDDEN, "You are not allowed to change this booking status.");
    }

    private Booking findBookingOrThrow(Integer bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingException(HttpStatus.NOT_FOUND, "Booking not found"));
    }

    private User findUserOrThrow(Integer userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BookingException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private CustomerProfile findCustomerProfileByUserOrThrow(Integer userId) {
        return customerProfileRepository.findByUser_UserId(userId)
                .orElseThrow(() -> new BookingException(HttpStatus.NOT_FOUND, "Customer profile not found"));
    }

    private CustomerProfile findCustomerProfileOrThrow(Integer customerUserId) {
        return customerProfileRepository.findByUser_UserId(customerUserId)
                .orElseThrow(() -> new BookingException(
                        HttpStatus.BAD_REQUEST,
                        "Customer profile not found. Please complete your profile first."));
    }

    private WorkerProfile findWorkerProfileByUserOrThrow(Integer userId) {
        return workerProfileRepository.findByUser_UserId(userId)
                .orElseThrow(() -> new BookingException(HttpStatus.NOT_FOUND, "Worker profile not found"));
    }

    private Booking.BookingStatus parseBookingStatus(String newStatus) {
        try {
            return Booking.BookingStatus.valueOf(newStatus);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new BookingException(HttpStatus.BAD_REQUEST, "Invalid booking status: " + newStatus);
        }
    }

    private void applyStatusSideEffects(Booking booking, Booking.BookingStatus targetStatus, String reason) {
        if (targetStatus == Booking.BookingStatus.cancelled) {
            booking.setCancellationReason(reason);
            booking.setCancelledAt(LocalDateTime.now());
        }
        if (targetStatus == Booking.BookingStatus.completed) {
            booking.setCompletedAt(LocalDateTime.now());
        }
    }

    private record BookingTimeWindow(LocalDate date, LocalTime start, LocalTime end) {
    }
}
