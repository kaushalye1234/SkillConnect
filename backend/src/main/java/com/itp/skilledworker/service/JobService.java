package com.itp.skilledworker.service;

import com.itp.skilledworker.entity.*;
import com.itp.skilledworker.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
@RequiredArgsConstructor
public class JobService {
    private static final int DEFAULT_BOOKING_DURATION_HOURS = 2;
    private static final List<Booking.BookingStatus> ACTIVE_BOOKING_STATUSES = List.of(
            Booking.BookingStatus.requested,
            Booking.BookingStatus.accepted,
            Booking.BookingStatus.in_progress);

    private final JobRepository jobRepository;
    private final JobCategoryRepository categoryRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final WorkerProfileRepository workerProfileRepository;
    private final BookingRepository bookingRepository;

    @Transactional
    public Job createJob(Integer customerUserId, Integer categoryId, String title, String description,
            String city, String district, String urgency,
            BigDecimal budgetMin, BigDecimal budgetMax, String preferredDate) {
        CustomerProfile customer = customerProfileRepository.findByUser_UserId(customerUserId)
                .orElseThrow(() -> new RuntimeException("Customer profile not found. Register as a customer first."));
        JobCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new RuntimeException("Category not found"));

        Job job = new Job();
        job.setCustomer(customer);
        job.setCategory(category);
        job.setJobTitle(title);
        job.setJobDescription(description);
        job.setCity(city);
        job.setDistrict(district);
        job.setUrgencyLevel(Job.UrgencyLevel.valueOf(urgency.toLowerCase()));
        job.setBudgetMin(budgetMin);
        job.setBudgetMax(budgetMax);
        job.setJobStatus(Job.JobStatus.active);
        if (preferredDate != null && !preferredDate.isEmpty()) {
            job.setPreferredStartDate(LocalDate.parse(preferredDate));
        }
        return jobRepository.save(job);
    }

    public List<Job> getAllActiveJobs(String district, Integer categoryId) {
        return jobRepository.findActiveJobsWithFilters(district, categoryId);
    }

    public List<Job> getAllJobs() {
        return jobRepository.findAll();
    }

    public Job getJobById(Integer id) {
        return jobRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Job not found"));
    }

    @Transactional
    public Job updateJob(Integer jobId, Integer customerUserId, String title, String description,
            BigDecimal budgetMin, BigDecimal budgetMax, String urgency) {
        Job job = getJobById(jobId);
        // Verify ownership
        if (!job.getCustomer().getUser().getUserId().equals(customerUserId)) {
            throw new RuntimeException("Unauthorized: You don't own this job");
        }
        if (title != null)
            job.setJobTitle(title);
        if (description != null)
            job.setJobDescription(description);
        if (budgetMin != null)
            job.setBudgetMin(budgetMin);
        if (budgetMax != null)
            job.setBudgetMax(budgetMax);
        if (urgency != null)
            job.setUrgencyLevel(Job.UrgencyLevel.valueOf(urgency.toLowerCase()));
        return jobRepository.save(job);
    }

    @Transactional
    public void deleteJob(Integer jobId, Integer customerUserId) {
        Job job = getJobById(jobId);
        if (!job.getCustomer().getUser().getUserId().equals(customerUserId)) {
            throw new RuntimeException("Unauthorized: You don't own this job");
        }
        jobRepository.delete(job);
    }

    public List<JobCategory> getAllCategories() {
        return categoryRepository.findAll();
    }

    public List<Job> getMyJobs(Integer customerUserId) {
        CustomerProfile customer = customerProfileRepository.findByUser_UserId(customerUserId)
                .orElseThrow(() -> new RuntimeException("Customer profile not found"));
        return jobRepository.findByCustomer_CustomerId(customer.getCustomerId());
    }

    public List<Job> getJobsAcceptedByWorkers(Integer customerUserId) {
        return jobRepository.findJobsWithWorkerAcceptance(customerUserId);
    }

    @Transactional
    public JobApplication applyToJob(Integer jobId, Integer workerUserId, String coverNote, BigDecimal proposedPrice) {
        Job job = getJobById(jobId);
        if (job.getJobStatus() != Job.JobStatus.active) {
            throw new RuntimeException("Can only apply to active jobs");
        }
        if (jobApplicationRepository.existsByJob_JobIdAndWorkerUser_UserId(jobId, workerUserId)) {
            throw new RuntimeException("You have already applied to this job");
        }
        User worker = userRepository.findById(workerUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (worker.getRole() != User.Role.worker) {
            throw new RuntimeException("Only workers can accept work");
        }

        if (job.getCustomer().getUser().getUserId().equals(workerUserId)) {
            throw new RuntimeException("You cannot accept your own job");
        }

        JobApplication application = new JobApplication();
        application.setJob(job);
        application.setWorkerUser(worker);
        application.setCoverNote(coverNote);
        application.setProposedPrice(proposedPrice);
        application.setStatus(JobApplication.ApplicationStatus.pending);
        JobApplication savedApplication = jobApplicationRepository.save(application);

        notificationService.createNotification(
            job.getCustomer().getUser(),
            "New worker acceptance",
            worker.getEmail() + " accepted work for \"" + job.getJobTitle() + "\".",
            "/jobs/" + job.getJobId());

        return savedApplication;
    }

    public List<JobApplication> getJobApplications(Integer jobId, Integer customerUserId) {
        Job job = getJobById(jobId);
        if (!job.getCustomer().getUser().getUserId().equals(customerUserId)) {
            throw new RuntimeException("Unauthorized: You don't own this job");
        }
        return jobApplicationRepository.findByJob_JobId(jobId);
    }

    @Transactional
    public JobApplication updateApplicationStatus(Integer jobId, Long applicationId,
            Integer customerUserId, String status, String scheduledDate, String scheduledTime) {
        Job job = getJobById(jobId);
        if (!job.getCustomer().getUser().getUserId().equals(customerUserId)) {
            throw new RuntimeException("Unauthorized: You don't own this job");
        }
        JobApplication application = jobApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!application.getJob().getJobId().equals(jobId)) {
            throw new RuntimeException("Application does not belong to this job");
        }

        JobApplication.ApplicationStatus targetStatus = JobApplication.ApplicationStatus.valueOf(status.toLowerCase());

        if (targetStatus == JobApplication.ApplicationStatus.accepted) {
            LocalDate parsedScheduledDate;
            LocalTime parsedScheduledTime;
            if (scheduledDate == null || scheduledDate.isBlank()) {
                throw new RuntimeException("scheduledDate is required when status is accepted");
            }
            if (scheduledTime == null || scheduledTime.isBlank()) {
                throw new RuntimeException("scheduledTime is required when status is accepted");
            }
            try {
                parsedScheduledDate = LocalDate.parse(scheduledDate);
            } catch (DateTimeParseException ex) {
                throw new RuntimeException("scheduledDate must be a valid ISO date (yyyy-MM-dd)");
            }
            try {
                parsedScheduledTime = LocalTime.parse(scheduledTime);
            } catch (DateTimeParseException ex) {
                throw new RuntimeException("scheduledTime must be a valid ISO time (HH:mm or HH:mm:ss)");
            }

            WorkerProfile workerProfile = workerProfileRepository.findByUser_UserId(application.getWorkerUser().getUserId())
                    .orElseThrow(() -> new RuntimeException("Worker profile not found for accepted user"));
            Integer workerId = workerProfile.getWorkerId();

            ensureNoActiveBookingForJobWorker(jobId, workerId);
            ensureWorkerHasNoOverlappingActiveBooking(workerId, parsedScheduledDate, parsedScheduledTime);
            createAcceptedBooking(job, workerProfile, parsedScheduledDate, parsedScheduledTime);

            List<JobApplication> others = jobApplicationRepository.findByJob_JobId(jobId);
            for (JobApplication other : others) {
                if (!other.getApplicationId().equals(applicationId)
                        && other.getStatus() != JobApplication.ApplicationStatus.rejected) {
                    other.setStatus(JobApplication.ApplicationStatus.rejected);
                    jobApplicationRepository.save(other);
                }
            }

            job.setJobStatus(Job.JobStatus.assigned);
            jobRepository.save(job);

            notificationService.createNotification(
                    application.getWorkerUser(),
                    "Application accepted",
                    "You were selected for \"" + application.getJob().getJobTitle() + "\".",
                    "/jobs/" + application.getJob().getJobId());
        }
        application.setStatus(targetStatus);
        return jobApplicationRepository.save(application);
    }

    private void ensureNoActiveBookingForJobWorker(Integer jobId, Integer workerId) {
        long activeBookingCount = bookingRepository.countByJob_JobIdAndWorker_WorkerIdAndBookingStatusIn(
                jobId,
                workerId,
                ACTIVE_BOOKING_STATUSES);
        if (activeBookingCount > 0) {
            throw new RuntimeException("An active booking already exists for this job and worker");
        }
    }

    private void ensureWorkerHasNoOverlappingActiveBooking(Integer workerId, LocalDate date, LocalTime requestedStart) {
        LocalTime requestedEnd = requestedStart.plusHours(DEFAULT_BOOKING_DURATION_HOURS);
        List<BookingRepository.BookingOverlapProjection> dayBookings = bookingRepository.findConflictWindowData(
                workerId,
                date,
                ACTIVE_BOOKING_STATUSES);

        for (BookingRepository.BookingOverlapProjection existing : dayBookings) {
            LocalTime existingStart = existing.getScheduledTime();
            int existingDuration = resolveDurationHours(existing.getEstimatedDurationHours());
            LocalTime existingEnd = existingStart.plusHours(existingDuration);
            if (requestedStart.isBefore(existingEnd) && existingStart.isBefore(requestedEnd)) {
                throw new RuntimeException("Selected slot overlaps with an existing booking");
            }
        }
    }

    private void createAcceptedBooking(Job job, WorkerProfile workerProfile, LocalDate scheduledDate, LocalTime scheduledTime) {
        Booking booking = new Booking();
        booking.setJob(job);
        booking.setWorker(workerProfile);
        booking.setCustomer(job.getCustomer());
        booking.setBookingStatus(Booking.BookingStatus.accepted);
        booking.setScheduledDate(scheduledDate);
        booking.setScheduledTime(scheduledTime);
        booking.setEstimatedDurationHours(DEFAULT_BOOKING_DURATION_HOURS);
        bookingRepository.save(booking);
    }

    private int resolveDurationHours(Integer durationHours) {
        if (durationHours == null || durationHours <= 0) {
            return DEFAULT_BOOKING_DURATION_HOURS;
        }
        return durationHours;
    }

    public List<JobApplication> getWorkerApplications(Integer workerUserId) {
        return jobApplicationRepository.findByWorkerUser_UserId(workerUserId);
    }

    @Transactional
    public Job updateJobStatus(Integer jobId, Integer customerUserId, String status) {
        Job job = getJobById(jobId);
        if (!job.getCustomer().getUser().getUserId().equals(customerUserId)) {
            throw new RuntimeException("Unauthorized: You don't own this job");
        }
        Job.JobStatus targetStatus = Job.JobStatus.valueOf(status.toLowerCase());

        // When marking a job as completed, ensure there's a completed booking
        // linking this job, the accepted worker, and the customer so that
        // reviews/complaints can be submitted from the job page without
        // navigating to the bookings area.
        if (targetStatus == Job.JobStatus.completed) {
            if (job.getJobStatus() != Job.JobStatus.assigned) {
                throw new RuntimeException("Job must be in 'assigned' status before it can be completed");
            }

            List<JobApplication> apps = jobApplicationRepository.findByJob_JobId(jobId);
            JobApplication accepted = apps.stream()
                    .filter(a -> a.getStatus() == JobApplication.ApplicationStatus.accepted)
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("No accepted worker found for this job"));

            Integer workerUserId = accepted.getWorkerUser().getUserId();
            WorkerProfile workerProfile = workerProfileRepository.findByUser_UserId(workerUserId)
                    .orElseThrow(() -> new RuntimeException("Worker profile not found for accepted user"));

            boolean hasCompletedBooking = !bookingRepository
                    .findByJob_JobIdAndWorker_WorkerIdAndBookingStatus(
                            jobId,
                            workerProfile.getWorkerId(),
                            Booking.BookingStatus.completed)
                    .isEmpty();

            if (!hasCompletedBooking) {
                Booking booking = new Booking();
                booking.setJob(job);
                booking.setWorker(workerProfile);
                booking.setCustomer(job.getCustomer());
                booking.setBookingStatus(Booking.BookingStatus.completed);
                java.time.LocalDate today = java.time.LocalDate.now();
                java.time.LocalTime now = java.time.LocalTime.now().withSecond(0).withNano(0);
                booking.setScheduledDate(today);
                booking.setScheduledTime(now);
                booking.setCompletedAt(java.time.LocalDateTime.now());
                bookingRepository.save(booking);
            }
        }

        job.setJobStatus(targetStatus);
        return jobRepository.save(job);
    }
}
