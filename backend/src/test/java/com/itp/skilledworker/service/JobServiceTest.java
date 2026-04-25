package com.itp.skilledworker.service;

import com.itp.skilledworker.entity.Booking;
import com.itp.skilledworker.entity.CustomerProfile;
import com.itp.skilledworker.entity.Job;
import com.itp.skilledworker.entity.JobApplication;
import com.itp.skilledworker.entity.User;
import com.itp.skilledworker.entity.WorkerProfile;
import com.itp.skilledworker.repository.BookingRepository;
import com.itp.skilledworker.repository.CustomerProfileRepository;
import com.itp.skilledworker.repository.JobApplicationRepository;
import com.itp.skilledworker.repository.JobCategoryRepository;
import com.itp.skilledworker.repository.JobRepository;
import com.itp.skilledworker.repository.UserRepository;
import com.itp.skilledworker.repository.WorkerProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobServiceTest {

    @Mock private JobRepository jobRepository;
    @Mock private JobCategoryRepository categoryRepository;
    @Mock private CustomerProfileRepository customerProfileRepository;
    @Mock private JobApplicationRepository jobApplicationRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private WorkerProfileRepository workerProfileRepository;
    @Mock private BookingRepository bookingRepository;

    @InjectMocks
    private JobService jobService;

    @Test
    void updateApplicationStatus_acceptsApplicationAndCreatesBooking() {
        Integer jobId = 100;
        Long applicationId = 500L;
        Integer customerUserId = 1;
        LocalDate scheduledDate = LocalDate.of(2026, 5, 1);
        LocalTime scheduledTime = LocalTime.of(9, 0);

        CustomerProfile customer = buildCustomer(10, customerUserId);
        Job job = buildJob(jobId, customer);
        User selectedWorkerUser = buildUser(2, User.Role.worker);
        WorkerProfile selectedWorkerProfile = buildWorker(20, selectedWorkerUser);

        JobApplication targetApplication = buildApplication(applicationId, job, selectedWorkerUser, JobApplication.ApplicationStatus.pending);
        JobApplication otherApplication = buildApplication(501L, job, buildUser(3, User.Role.worker), JobApplication.ApplicationStatus.pending);

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(jobApplicationRepository.findById(applicationId)).thenReturn(Optional.of(targetApplication));
        when(workerProfileRepository.findByUser_UserId(selectedWorkerUser.getUserId())).thenReturn(Optional.of(selectedWorkerProfile));
        when(bookingRepository.countByJob_JobIdAndWorker_WorkerIdAndBookingStatusIn(eq(jobId), eq(selectedWorkerProfile.getWorkerId()), anyList()))
                .thenReturn(0L);
        when(bookingRepository.findConflictWindowData(eq(selectedWorkerProfile.getWorkerId()), eq(scheduledDate), anyList()))
                .thenReturn(List.of());
        when(jobApplicationRepository.findByJob_JobId(jobId)).thenReturn(List.of(targetApplication, otherApplication));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jobRepository.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jobApplicationRepository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));

        JobApplication updated = jobService.updateApplicationStatus(
                jobId,
                applicationId,
                customerUserId,
                "accepted",
                scheduledDate.toString(),
                scheduledTime.toString());

        assertEquals(JobApplication.ApplicationStatus.accepted, updated.getStatus());
        assertEquals(Job.JobStatus.assigned, job.getJobStatus());
        assertEquals(JobApplication.ApplicationStatus.rejected, otherApplication.getStatus());

        ArgumentCaptor<Booking> bookingCaptor = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(bookingCaptor.capture());
        Booking createdBooking = bookingCaptor.getValue();
        assertEquals(job, createdBooking.getJob());
        assertEquals(selectedWorkerProfile, createdBooking.getWorker());
        assertEquals(customer, createdBooking.getCustomer());
        assertEquals(Booking.BookingStatus.accepted, createdBooking.getBookingStatus());
        assertEquals(scheduledDate, createdBooking.getScheduledDate());
        assertEquals(scheduledTime, createdBooking.getScheduledTime());
        assertEquals(2, createdBooking.getEstimatedDurationHours());

        verify(notificationService).createNotification(
                eq(selectedWorkerUser),
                eq("Application accepted"),
                contains("You were selected"),
                eq("/jobs/" + jobId));
    }

    @Test
    void updateApplicationStatus_rejectsWhenActiveJobWorkerBookingExists() {
        Integer jobId = 200;
        Long applicationId = 600L;
        Integer customerUserId = 11;

        CustomerProfile customer = buildCustomer(21, customerUserId);
        Job job = buildJob(jobId, customer);
        User workerUser = buildUser(12, User.Role.worker);
        WorkerProfile worker = buildWorker(33, workerUser);
        JobApplication application = buildApplication(applicationId, job, workerUser, JobApplication.ApplicationStatus.pending);

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(jobApplicationRepository.findById(applicationId)).thenReturn(Optional.of(application));
        when(workerProfileRepository.findByUser_UserId(workerUser.getUserId())).thenReturn(Optional.of(worker));
        when(bookingRepository.countByJob_JobIdAndWorker_WorkerIdAndBookingStatusIn(eq(jobId), eq(worker.getWorkerId()), anyList()))
                .thenReturn(1L);

        RuntimeException ex = assertThrows(RuntimeException.class, () -> jobService.updateApplicationStatus(
                jobId,
                applicationId,
                customerUserId,
                "accepted",
                "2026-05-02",
                "11:00"));

        assertTrue(ex.getMessage().contains("active booking already exists"));
        verify(bookingRepository, never()).save(any(Booking.class));
        verify(jobRepository, never()).save(any(Job.class));
    }

    @Test
    void updateApplicationStatus_rejectsWhenWorkerHasOverlappingSlot() {
        Integer jobId = 300;
        Long applicationId = 700L;
        Integer customerUserId = 21;
        LocalDate scheduledDate = LocalDate.of(2026, 5, 3);

        CustomerProfile customer = buildCustomer(31, customerUserId);
        Job job = buildJob(jobId, customer);
        User workerUser = buildUser(22, User.Role.worker);
        WorkerProfile worker = buildWorker(44, workerUser);
        JobApplication application = buildApplication(applicationId, job, workerUser, JobApplication.ApplicationStatus.pending);

        BookingRepository.BookingOverlapProjection overlap = org.mockito.Mockito.mock(BookingRepository.BookingOverlapProjection.class);
        when(overlap.getScheduledTime()).thenReturn(LocalTime.of(9, 30));
        when(overlap.getEstimatedDurationHours()).thenReturn(2);

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(jobApplicationRepository.findById(applicationId)).thenReturn(Optional.of(application));
        when(workerProfileRepository.findByUser_UserId(workerUser.getUserId())).thenReturn(Optional.of(worker));
        when(bookingRepository.countByJob_JobIdAndWorker_WorkerIdAndBookingStatusIn(eq(jobId), eq(worker.getWorkerId()), anyList()))
                .thenReturn(0L);
        when(bookingRepository.findConflictWindowData(eq(worker.getWorkerId()), eq(scheduledDate), anyList()))
                .thenReturn(List.of(overlap));

        RuntimeException ex = assertThrows(RuntimeException.class, () -> jobService.updateApplicationStatus(
                jobId,
                applicationId,
                customerUserId,
                "accepted",
                scheduledDate.toString(),
                "10:00"));

        assertTrue(ex.getMessage().contains("overlaps"));
        verify(bookingRepository, never()).save(any(Booking.class));
        verify(jobApplicationRepository, never()).findByJob_JobId(anyInt());
    }

    @Test
    void updateApplicationStatus_rejectedDoesNotCreateBooking() {
        Integer jobId = 400;
        Long applicationId = 800L;
        Integer customerUserId = 41;

        CustomerProfile customer = buildCustomer(51, customerUserId);
        Job job = buildJob(jobId, customer);
        User workerUser = buildUser(42, User.Role.worker);
        JobApplication application = buildApplication(applicationId, job, workerUser, JobApplication.ApplicationStatus.pending);

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(jobApplicationRepository.findById(applicationId)).thenReturn(Optional.of(application));
        when(jobApplicationRepository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));

        JobApplication updated = jobService.updateApplicationStatus(
                jobId,
                applicationId,
                customerUserId,
                "rejected",
                null,
                null);

        assertEquals(JobApplication.ApplicationStatus.rejected, updated.getStatus());
        verifyNoInteractions(workerProfileRepository, bookingRepository, notificationService);
    }

    private Job buildJob(Integer jobId, CustomerProfile customer) {
        Job job = new Job();
        job.setJobId(jobId);
        job.setCustomer(customer);
        job.setJobTitle("Job " + jobId);
        job.setJobStatus(Job.JobStatus.active);
        return job;
    }

    private JobApplication buildApplication(Long applicationId, Job job, User workerUser, JobApplication.ApplicationStatus status) {
        JobApplication application = new JobApplication();
        application.setApplicationId(applicationId);
        application.setJob(job);
        application.setWorkerUser(workerUser);
        application.setStatus(status);
        return application;
    }

    private CustomerProfile buildCustomer(Integer customerId, Integer userId) {
        CustomerProfile customer = new CustomerProfile();
        customer.setCustomerId(customerId);
        customer.setUser(buildUser(userId, User.Role.customer));
        customer.setFirstName("Customer");
        customer.setLastName("User");
        return customer;
    }

    private WorkerProfile buildWorker(Integer workerId, User user) {
        WorkerProfile worker = new WorkerProfile();
        worker.setWorkerId(workerId);
        worker.setUser(user);
        worker.setFirstName("Worker");
        worker.setLastName("User");
        return worker;
    }

    private User buildUser(Integer userId, User.Role role) {
        User user = new User();
        user.setUserId(userId);
        user.setRole(role);
        user.setEmail("user" + userId + "@test.com");
        return user;
    }
}
