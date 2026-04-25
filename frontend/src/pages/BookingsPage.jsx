import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingAPI, equipmentAPI, jobAPI } from '../api';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';
import {
    BOOKING_STATUS_TRANSITIONS,
    SERVICE_BOOKING_TABS,
    formatBookingStatusLabel,
    getEquipmentStatusMeta,
    getServiceStatusMeta,
    matchesServiceTab,
} from '../utils/bookingUtils';
import {
    BOOKING_LIST_CLASS,
    BOOKING_LAYOUT_CLASS,
    BOOKING_SURFACE_CLASS,
    bookingButtonClass,
    bookingPillTabClass,
    bookingStatusBadgeClass,
    bookingStateClass,
    bookingUnderlineTabClass,
    cx,
} from '../utils/bookingStyleUtils';

const SECTION_TABS = [
    { key: 'services', label: 'Service Bookings' },
    { key: 'equipment', label: 'Equipment Rentals' },
];

const WORKER_SERVICE_STAGES = [
    { key: 'bookings', label: 'Service Bookings' },
    { key: 'applied', label: 'Applied Jobs' },
];

const APPLICATION_STATUS_STYLE = {
    pending: { bg: 'bg-amber-100', color: 'text-amber-800', label: '⏳ Pending' },
    accepted: { bg: 'bg-emerald-100', color: 'text-emerald-800', label: '✅ Accepted' },
    rejected: { bg: 'bg-rose-100', color: 'text-rose-800', label: '❌ Rejected' },
};

const normalizeRole = (role) => String(role || '').toLowerCase().replace(/^role_/, '');

const getApiErrorMessage = (err, fallback) => {
    const message = err?.response?.data?.message
        || err?.response?.data?.error
        || err?.message;

    if (!message) {
        return fallback;
    }

    const normalized = String(message).toLowerCase();
    if (normalized.includes('network error') || normalized.includes('failed to fetch')) {
        return 'Unable to reach the server right now. Please retry in a moment.';
    }

    return message;
};

const getApplicationStatusMeta = (status) => APPLICATION_STATUS_STYLE[String(status || '').toLowerCase()] || {
    bg: 'bg-slate-100',
    color: 'text-slate-700',
    label: formatBookingStatusLabel(status || 'unknown'),
};

const getApplicationBookingId = (application, workerBookings) => {
    const directBookingId = application?.bookingId
        || application?.booking?.bookingId
        || application?.booking?.id
        || null;
    if (directBookingId) return directBookingId;

    const applicationJobId = application?.job?.jobId || application?.jobId || application?.job?.id;
    if (!applicationJobId) return null;

    const matchedBooking = workerBookings.find((booking) => {
        const bookingJobId = booking?.job?.jobId || booking?.jobId || booking?.job?.id;
        return String(bookingJobId) === String(applicationJobId);
    });

    return matchedBooking?.bookingId || matchedBooking?.id || null;
};

const formatDateTime = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString();
};

const BOOKING_PROGRESS_STEPS = ['Accepted', 'Worker Arrived', 'In Progress', 'Done'];

function getBookingProgressIndex(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'accepted') return 0;
    if (normalized === 'in_progress') return 2;
    if (normalized === 'completed') return 3;
    return -1;
}

function BookingProgressBar({ status }) {
    const currentIndex = getBookingProgressIndex(status);
    if (currentIndex < 0) return null;

    return (
        <div className="w-full">
            <div className="grid grid-cols-4 gap-2 items-start">
                {BOOKING_PROGRESS_STEPS.map((step, index) => {
                    const isDone = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isUpcoming = index > currentIndex;
                    const dotClass = isCurrent
                        ? 'bg-cyan-600 ring-4 ring-cyan-100'
                        : isDone
                            ? 'bg-emerald-500'
                            : 'bg-slate-200';

                    return (
                        <div key={step} className="relative flex flex-col items-center text-center">
                            {index < BOOKING_PROGRESS_STEPS.length - 1 && (
                                <div
                                    className={`absolute top-1.5 left-1/2 h-0.5 w-full ${index < currentIndex ? 'bg-emerald-400' : 'bg-slate-200'}`}
                                />
                            )}
                            <div className={`relative z-10 h-3 w-3 rounded-full ${dotClass}`} />
                            <p className={`mt-2 text-[11px] leading-tight font-medium ${isCurrent ? 'text-[#904d00]' : isDone ? 'text-[#00658f]' : 'text-slate-500'}`}>
                                {step}
                            </p>
                            {isUpcoming && <span className="text-[10px] text-slate-400">Upcoming</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function BookingsErrorState({ message, onRetry }) {
    return (
        <div className={bookingStateClass('error', cx('mb-6', BOOKING_LAYOUT_CLASS.bookingsStateInline))}>
            <span className={BOOKING_LAYOUT_CLASS.bookingsStateMessage}>❌ {message}</span>
            <button onClick={onRetry} className={bookingButtonClass('danger', 'text-sm')}>Retry</button>
        </div>
    );
}

function BookingsLoadingState({ label }) {
    return (
        <div className={BOOKING_LAYOUT_CLASS.bookingsLoadingState}>
            <span className="spinner" /> {label}
        </div>
    );
}

function BookingsEmptyState({ icon, title, description }) {
    return (
        <div className={cx(BOOKING_SURFACE_CLASS.emptyState, BOOKING_LAYOUT_CLASS.emptyStatePadding)}>
            <span className={BOOKING_LAYOUT_CLASS.bookingsEmptyIcon}>{icon}</span>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
            <p className="text-slate-500 max-w-md">{description}</p>
        </div>
    );
}

function ServiceBookingCard({ booking, isWorkerSide, navigate, onStatusChange, isUpdating }) {
    const statusMeta = getServiceStatusMeta(booking.bookingStatus);
    const statusValue = String(booking.bookingStatus || '').toLowerCase();
    const isWorkerPendingCard = isWorkerSide && (statusValue === 'requested' || statusValue === 'pending');
    const isUpcomingProgressCard = ['accepted', 'in_progress', 'completed'].includes(statusValue);
    const customerName = [booking.customer?.firstName, booking.customer?.lastName].filter(Boolean).join(' ').trim() || 'Customer';
    const customerPhoto = booking.customer?.profilePicture;
    const customerInitials = customerName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'CU';
    const customerLocation = [booking.customer?.city, booking.customer?.district].filter(Boolean).join(', ') || 'Location not specified';
    const customerRatingRaw = booking.customer?.averageRating
        ?? booking.customer?.rating
        ?? booking.customer?.user?.averageRating
        ?? booking.customerRating;
    const customerRating = Number(customerRatingRaw);
    const hasCustomerRating = Number.isFinite(customerRating) && customerRating > 0;
    const durationText = booking.estimatedDurationHours ? `${booking.estimatedDurationHours}h` : 'Not specified';
    const payText = booking.finalCost ? `LKR ${booking.finalCost}` : 'Not set';
    const workerName = [booking.worker?.firstName, booking.worker?.lastName].filter(Boolean).join(' ').trim() || 'Worker';
    const workerPhoto = booking.worker?.profilePicture;
    const workerInitials = workerName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'WK';
    const workerPhone = booking.worker?.user?.phone
        || booking.worker?.user?.phoneNumber
        || booking.worker?.phone
        || 'Not provided';

    if (isWorkerPendingCard) {
        return (
            <div className={BOOKING_LIST_CLASS.cardWrapper}>
                <div className={BOOKING_LIST_CLASS.cardHeading}>
                    <div>
                        <p className={BOOKING_LIST_CLASS.bookingId}>Booking #{booking.bookingId}</p>
                        <h3 className={BOOKING_LIST_CLASS.bookingTitle}>Service Request</h3>
                    </div>
                    <span className={bookingStatusBadgeClass(statusMeta)}>{statusMeta.label}</span>
                </div>

                <div className={BOOKING_LIST_CLASS.participantBox}>
                    {customerPhoto ? (
                        <img
                            src={customerPhoto}
                            alt={customerName}
                            className={BOOKING_LIST_CLASS.avatarImg}
                        />
                    ) : (
                        <div className={BOOKING_LIST_CLASS.avatarPlaceholder}>
                            {customerInitials}
                        </div>
                    )}
                    <div className={BOOKING_LIST_CLASS.participantInfo}>
                        <p className={BOOKING_LIST_CLASS.participantName}>{customerName}</p>
                        <p className={BOOKING_LIST_CLASS.participantMeta}>📍 {customerLocation}</p>
                        {hasCustomerRating ? (
                            <div className={BOOKING_LIST_CLASS.ratingBadge}>
                                <div className={BOOKING_LIST_CLASS.ratingStars}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span key={star} className={star <= Math.round(customerRating) ? BOOKING_LIST_CLASS.ratingStarFilled : BOOKING_LIST_CLASS.ratingStarEmpty}>
                                            ★
                                        </span>
                                    ))}
                                </div>
                                <span className={BOOKING_LIST_CLASS.ratingValue}>{customerRating.toFixed(1)}</span>
                            </div>
                        ) : (
                            <div className={BOOKING_LIST_CLASS.noRating}>No rating</div>
                        )}
                    </div>
                </div>

                <div className={BOOKING_LIST_CLASS.infoGrid}>
                    <div className={BOOKING_LIST_CLASS.infoBox}>
                        <p className={BOOKING_LIST_CLASS.infoLabel}>Schedule</p>
                        <p className={BOOKING_LIST_CLASS.infoValue}>{booking.scheduledDate || 'N/A'}</p>
                        <p className={BOOKING_LIST_CLASS.infoSubtext}>{booking.scheduledTime || 'N/A'}</p>
                    </div>
                    <div className={BOOKING_LIST_CLASS.infoBox}>
                        <p className={BOOKING_LIST_CLASS.infoLabel}>Duration & Pay</p>
                        <p className={BOOKING_LIST_CLASS.infoValue}>{durationText}</p>
                        <p className={BOOKING_LIST_CLASS.infoSubhighlight}>{payText}</p>
                    </div>
                </div>

                <div className={BOOKING_LIST_CLASS.descBox}>
                    <p className={BOOKING_LIST_CLASS.descLabel}>Job Description</p>
                    <p className={BOOKING_LIST_CLASS.descText}>
                        {booking.notes || 'No additional notes provided.'}
                    </p>
                </div>

                <div className={BOOKING_LIST_CLASS.cardActions}>
                    <button
                        className={bookingButtonClass('primary', 'w-full text-sm')}
                        onClick={() => navigate(`/bookings/${booking.bookingId}`)}
                    >
                        View Full Details
                    </button>

                    <div className={BOOKING_LIST_CLASS.actionGrid}>
                        {BOOKING_STATUS_TRANSITIONS[booking.bookingStatus]?.map((status) => {
                            const isCancellation = status === 'cancelled';
                            const canWorkerChange = isWorkerSide;
                            const canCustomerCancel = !isWorkerSide && isCancellation;
                            if (!canWorkerChange && !canCustomerCancel) return null;

                            const variant = ['accepted', 'in_progress', 'completed'].includes(status) ? 'success' : 'danger';

                            return (
                                <button
                                    key={status}
                                    onClick={() => onStatusChange(booking.bookingId, status)}
                                    disabled={isUpdating}
                                    className={bookingButtonClass(variant, 'col-span-1 text-xs')}
                                >
                                    {isUpdating ? 'Updating…' : formatBookingStatusLabel(status)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    if (isUpcomingProgressCard) {
        return (
            <div className={BOOKING_LIST_CLASS.cardWrapper}>
                <div className={BOOKING_LIST_CLASS.cardHeading}>
                    <div>
                        <p className={BOOKING_LIST_CLASS.bookingId}>Booking #{booking.bookingId}</p>
                        <h3 className={BOOKING_LIST_CLASS.bookingTitle}>
                            {isWorkerSide ? 'Customer Appointment' : 'Worker Appointment'}
                        </h3>
                    </div>
                    <span className={bookingStatusBadgeClass(statusMeta)}>{statusMeta.label}</span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <BookingProgressBar status={booking.bookingStatus} />
                </div>

                {isWorkerSide ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1.5">Customer details</p>
                        <p className="text-base font-bold text-slate-900">{customerName}</p>
                        <p className={BOOKING_LIST_CLASS.infoSubtext}>📍 {customerLocation}</p>
                    </div>
                ) : (
                    <div className={BOOKING_LIST_CLASS.participantBox}>
                        {workerPhoto ? (
                            <img
                                src={workerPhoto}
                                alt={workerName}
                                className={BOOKING_LIST_CLASS.avatarImg}
                            />
                        ) : (
                            <div className={BOOKING_LIST_CLASS.avatarPlaceholder}>
                                {workerInitials}
                            </div>
                        )}
                        <div className={BOOKING_LIST_CLASS.participantInfo}>
                            <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">Assigned Worker</p>
                            <p className="text-base font-bold text-slate-900 truncate">{workerName}</p>
                            <p className={BOOKING_LIST_CLASS.infoSubtext}>📞 {workerPhone}</p>
                        </div>
                    </div>
                )}

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">Appointment Schedule</p>
                    <p className={BOOKING_LIST_CLASS.infoValue}>{booking.scheduledDate || 'N/A'}</p>
                    <p className={BOOKING_LIST_CLASS.infoSubtext}>{booking.scheduledTime || 'N/A'}</p>
                </div>

                <div className={BOOKING_LIST_CLASS.cardActions}>
                    <button
                        className={bookingButtonClass('primary', 'w-full text-sm')}
                        onClick={() => navigate(`/bookings/${booking.bookingId}`)}
                    >
                        View Details
                    </button>

                    <div className={BOOKING_LIST_CLASS.actionGrid}>
                        {BOOKING_STATUS_TRANSITIONS[booking.bookingStatus]?.map((status) => {
                            const isCancellation = status === 'cancelled';
                            const canWorkerChange = isWorkerSide;
                            const canCustomerCancel = !isWorkerSide && isCancellation;
                            if (!canWorkerChange && !canCustomerCancel) return null;

                            const variant = ['accepted', 'in_progress', 'completed'].includes(status) ? 'success' : 'danger';

                            return (
                                <button
                                    key={status}
                                    onClick={() => onStatusChange(booking.bookingId, status)}
                                    disabled={isUpdating}
                                    className={bookingButtonClass(variant, 'col-span-1 text-xs')}
                                >
                                    {isUpdating ? 'Updating…' : formatBookingStatusLabel(status)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cx(BOOKING_SURFACE_CLASS.cardHover, 'overflow-hidden group')}>
            <div className={BOOKING_LIST_CLASS.cardBody}>
                <div className="booking-card-header mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Booking #{booking.bookingId}</h3>
                    <span className={bookingStatusBadgeClass(statusMeta)}>{statusMeta.label}</span>
                </div>

                <div className="space-y-3 mb-6">
                    {isWorkerSide && booking.customer && (
                        <div className="booking-muted-block flex flex-col">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Customer</span>
                            <span className="text-sm font-semibold text-slate-700">{booking.customer.firstName} {booking.customer.lastName}</span>
                        </div>
                    )}
                    {!isWorkerSide && booking.worker && (
                        <div className="booking-muted-block flex flex-col">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Worker</span>
                            <span className="text-sm font-semibold text-slate-700">{booking.worker.firstName} {booking.worker.lastName}</span>
                        </div>
                    )}

                    <div className={cx(BOOKING_LAYOUT_CLASS.bookingsMetricRow, 'text-sm text-slate-600')}>
                        <div className={BOOKING_LAYOUT_CLASS.bookingsMetricIcon}>📅</div>
                        <div className="font-medium">{booking.scheduledDate} {booking.scheduledTime && `• ${booking.scheduledTime}`}</div>
                    </div>

                    {booking.notes && (
                        <div className={cx(BOOKING_LAYOUT_CLASS.bookingsNote, 'line-clamp-2')}>
                            "{booking.notes}"
                        </div>
                    )}
                </div>

                <div className={BOOKING_LIST_CLASS.cardActions}>
                    <button className={bookingButtonClass('primary', 'w-full text-sm')} onClick={() => navigate(`/bookings/${booking.bookingId}`)}>
                        View Full Details
                    </button>

                    <div className={BOOKING_LIST_CLASS.actionGrid}>
                        {BOOKING_STATUS_TRANSITIONS[booking.bookingStatus]?.map((status) => {
                            const isCancellation = status === 'cancelled';
                            const canWorkerChange = isWorkerSide;
                            const canCustomerCancel = !isWorkerSide && isCancellation;
                            if (!canWorkerChange && !canCustomerCancel) return null;

                            const variant = ['accepted', 'in_progress', 'completed'].includes(status) ? 'success' : 'danger';

                            return (
                                <button
                                    key={status}
                                    onClick={() => onStatusChange(booking.bookingId, status)}
                                    disabled={isUpdating}
                                    className={bookingButtonClass(variant, 'col-span-1 text-xs')}
                                >
                                    {isUpdating ? 'Updating…' : formatBookingStatusLabel(status)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function EquipmentBookingCard({ booking, onReturn, isReturning }) {
    const statusMeta = getEquipmentStatusMeta(booking.bookingStatus);
    const isActive = booking.bookingStatus === 'reserved' || booking.bookingStatus === 'rented_out';
    const hasLateFee = Number(booking.lateFee || 0) > 0;
    const bookingId = booking.equipmentBookingId || booking.id;

    return (
        <div className={cx(BOOKING_SURFACE_CLASS.cardHoverPadded, 'overflow-hidden group')}>
            <div className="booking-card-header mb-4">
                <h3 className="text-lg font-bold text-slate-800">{booking.equipmentName || booking.equipment?.equipmentName || 'Equipment'}</h3>
                <span className={bookingStatusBadgeClass(statusMeta)}>
                    {statusMeta.label}
                </span>
            </div>

            <div className="space-y-2 text-sm text-slate-600 mb-5">
                <div className={BOOKING_LAYOUT_CLASS.bookingsMetricRow}>
                    <span className={BOOKING_LAYOUT_CLASS.bookingsMetricIcon}>📅</span>
                    <span>{booking.rentalStartDate} → {booking.rentalEndDate}</span>
                </div>
                <div className={BOOKING_LAYOUT_CLASS.bookingsMetricRow}>
                    <span className={BOOKING_LAYOUT_CLASS.bookingsMetricIcon}>💰</span>
                    <span>Daily Rate: Rs.{booking.dailyRate || booking.equipment?.dailyRate || 0}</span>
                </div>
                <div className={BOOKING_LAYOUT_CLASS.bookingsMetricRow}>
                    <span className={BOOKING_LAYOUT_CLASS.bookingsMetricIcon}>🧾</span>
                    <span>Total Cost: Rs.{booking.totalCost || 0}</span>
                </div>
                {hasLateFee && (
                    <div className="text-red-600 font-semibold">⚠️ Late fee: Rs.{booking.lateFee}</div>
                )}
            </div>

            {isActive && (
                <button
                    className={bookingButtonClass('neutral', 'w-full')}
                    onClick={() => onReturn(bookingId)}
                    disabled={isReturning}
                >
                    {isReturning ? 'Returning…' : 'Return Equipment'}
                </button>
            )}
        </div>
    );
}

function AppliedJobCard({ application, linkedBookingId, navigate }) {
    const status = String(application?.status || '').toLowerCase();
    const statusMeta = getApplicationStatusMeta(status);
    const job = application?.job || {};
    const customerName = [job?.customer?.firstName, job?.customer?.lastName].filter(Boolean).join(' ').trim()
        || job?.customer?.user?.email
        || 'N/A';
    const location = [job?.city, job?.district].filter(Boolean).join(', ');
    const jobId = job?.jobId || application?.jobId || job?.id;
    const appliedAtLabel = formatDateTime(application?.appliedAt);

    return (
        <div className={cx(BOOKING_SURFACE_CLASS.cardHover, 'overflow-hidden group')}>
            <div className={BOOKING_LIST_CLASS.cardBody}>
                <div className="booking-card-header mb-4">
                    <h3 className="text-lg font-bold text-slate-800">{job?.jobTitle || 'Untitled Job'}</h3>
                    <span className={bookingStatusBadgeClass(statusMeta)}>{statusMeta.label}</span>
                </div>

                <div className="space-y-3 mb-6 text-sm text-slate-600">
                    <div className={BOOKING_LAYOUT_CLASS.bookingsMetricRow}>
                        <span className={BOOKING_LAYOUT_CLASS.bookingsMetricIcon}>📌</span>
                        <span className="font-medium">{job?.category?.categoryName || 'General'}</span>
                    </div>
                    <div className={BOOKING_LAYOUT_CLASS.bookingsMetricRow}>
                        <span className={BOOKING_LAYOUT_CLASS.bookingsMetricIcon}>👤</span>
                        <span>{customerName}</span>
                    </div>
                    {location && (
                        <div className={BOOKING_LAYOUT_CLASS.bookingsMetricRow}>
                            <span className={BOOKING_LAYOUT_CLASS.bookingsMetricIcon}>📍</span>
                            <span>{location}</span>
                        </div>
                    )}
                    {appliedAtLabel && (
                        <div className={BOOKING_LAYOUT_CLASS.bookingsMetricRow}>
                            <span className={BOOKING_LAYOUT_CLASS.bookingsMetricIcon}>🗓️</span>
                            <span>Applied: {appliedAtLabel}</span>
                        </div>
                    )}
                </div>

                <div className={BOOKING_LIST_CLASS.cardActions}>
                    {jobId && (
                        <button
                            className={bookingButtonClass('neutral', 'w-full text-sm')}
                            onClick={() => navigate(`/jobs/${jobId}`)}
                        >
                            View Job
                        </button>
                    )}

                    {status === 'accepted' && linkedBookingId ? (
                        <button
                            className={bookingButtonClass('primary', 'w-full text-sm')}
                            onClick={() => navigate(`/bookings/${linkedBookingId}`)}
                        >
                            Go to Booking #{linkedBookingId}
                        </button>
                    ) : status === 'accepted' ? (
                        <div className={bookingStateClass('neutral', 'text-xs')}>
                            Booking is being prepared. It will appear once created.
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default function BookingsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const userRole = normalizeRole(user?.role);
    const isWorkerRole = userRole === 'worker';
    const isCustomerRole = userRole === 'customer';
    const hasSupportedWorkflow = isWorkerRole || isCustomerRole;
    const workflowRole = isWorkerRole ? 'worker' : 'customer';
    const workflowLabel = isWorkerRole ? 'Worker workflow' : isCustomerRole ? 'Customer workflow' : 'No booking workflow';
    const visibleSections = useMemo(
        () => (isCustomerRole ? SECTION_TABS : SECTION_TABS.filter((section) => section.key === 'services')),
        [isCustomerRole]
    );

    const [activeSection, setActiveSection] = useState('services');
    const [bookings, setBookings] = useState([]);
    const [equipmentBookings, setEquipmentBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [equipmentLoading, setEquipmentLoading] = useState(false);
    const [activeServiceStage, setActiveServiceStage] = useState('bookings');
    const [activeTab, setActiveTab] = useState('Pending');
    const [error, setError] = useState('');
    const [equipmentError, setEquipmentError] = useState('');
    const [appliedJobs, setAppliedJobs] = useState([]);
    const [appliedLoading, setAppliedLoading] = useState(false);
    const [appliedError, setAppliedError] = useState('');
    const [statusUpdatingId, setStatusUpdatingId] = useState(null);
    const [equipmentReturningId, setEquipmentReturningId] = useState(null);
    const equipmentLoadedRef = useRef(false);

    const loadServiceBookings = useCallback(async () => {
        setLoading(true);
        setError('');
        if (!hasSupportedWorkflow) {
            setBookings([]);
            setError('Bookings are currently available for worker and customer accounts.');
            setLoading(false);
            return;
        }
        try {
            const data = await bookingAPI.getMineData(workflowRole);
            setBookings(Array.isArray(data) ? data : []);
        } catch (err) {
            if (err.response?.status === 404 && isWorkerRole) {
                setError('Your worker profile is not ready yet. Complete it to manage work bookings.');
                setBookings([]);
            } else if (err.response?.status === 404 && isCustomerRole) {
                setError('Your customer profile is not ready yet. Complete it to manage your bookings.');
                setBookings([]);
            } else {
                setError(getApiErrorMessage(err, 'Failed to load bookings.'));
            }
        } finally {
            setLoading(false);
        }
    }, [hasSupportedWorkflow, workflowRole, isWorkerRole, isCustomerRole]);

    const loadEquipmentBookings = useCallback(async (force = false) => {
        if (isWorkerRole) {
            setEquipmentBookings([]);
            setEquipmentError('');
            setEquipmentLoading(false);
            return;
        }
        if (!force && equipmentLoadedRef.current) {
            return;
        }
        setEquipmentLoading(true);
        setEquipmentError('');
        try {
            const res = await equipmentAPI.getMyBookings();
            setEquipmentBookings(res.data.data || []);
            equipmentLoadedRef.current = true;
        } catch (err) {
            setEquipmentError(err.response?.data?.message || 'Failed to load equipment rentals.');
            setEquipmentBookings([]);
        } finally {
            setEquipmentLoading(false);
        }
    }, [isWorkerRole]);

    const loadAppliedJobs = useCallback(async () => {
        if (!isWorkerRole) {
            setAppliedJobs([]);
            setAppliedError('Applied jobs are available only in the worker workflow.');
            return;
        }
        setAppliedLoading(true);
        setAppliedError('');
        try {
            const res = await jobAPI.getApplied();
            setAppliedJobs(res?.data?.data || []);
        } catch (err) {
            setAppliedError(getApiErrorMessage(err, 'Failed to load applied jobs.'));
            setAppliedJobs([]);
        } finally {
            setAppliedLoading(false);
        }
    }, [isWorkerRole]);

    useEffect(() => {
        loadServiceBookings();
    }, [loadServiceBookings]);

    useEffect(() => {
        if (activeSection === 'equipment' && !isWorkerRole) {
            loadEquipmentBookings();
        }
    }, [activeSection, isWorkerRole, loadEquipmentBookings]);

    useEffect(() => {
        if (!visibleSections.some((section) => section.key === activeSection)) {
            setActiveSection(visibleSections[0]?.key || 'services');
        }
    }, [activeSection, visibleSections]);

    useEffect(() => {
        if (!isWorkerRole && activeServiceStage !== 'bookings') {
            setActiveServiceStage('bookings');
        }
    }, [isWorkerRole, activeServiceStage]);

    useEffect(() => {
        if (activeSection === 'services' && isWorkerRole && activeServiceStage === 'applied') {
            loadAppliedJobs();
        }
    }, [activeSection, isWorkerRole, activeServiceStage, loadAppliedJobs]);

    const handleStatusChange = async (bookingId, status) => {
        const reason = (status === 'cancelled' || status === 'rejected')
            ? prompt('Enter a reason (optional):') || ''
            : '';
        setStatusUpdatingId(bookingId);
        try {
            const updatedBooking = await bookingAPI.updateStatusData(bookingId, status, reason);
            toast.success(`Status updated to ${formatBookingStatusLabel(status)}`);
            if (updatedBooking?.bookingId) {
                setBookings((current) => current.map((booking) => (
                    booking.bookingId === updatedBooking.bookingId ? updatedBooking : booking
                )));
            } else {
                loadServiceBookings();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        } finally {
            setStatusUpdatingId(null);
        }
    };

    const handleEquipmentReturn = async (equipmentBookingId) => {
        setEquipmentReturningId(equipmentBookingId);
        try {
            await equipmentAPI.returnEquipment(equipmentBookingId);
            toast.success('Equipment marked as returned');
            loadEquipmentBookings(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to return equipment');
        } finally {
            setEquipmentReturningId(null);
        }
    };

    const serviceTabCounts = useMemo(() => {
        const counts = { Pending: 0, Upcoming: 0, Completed: 0, Cancelled: 0 };
        bookings.forEach((booking) => {
            if (matchesServiceTab(booking.bookingStatus, 'Pending')) counts.Pending += 1;
            if (matchesServiceTab(booking.bookingStatus, 'Upcoming')) counts.Upcoming += 1;
            if (matchesServiceTab(booking.bookingStatus, 'Completed')) counts.Completed += 1;
            if (matchesServiceTab(booking.bookingStatus, 'Cancelled')) counts.Cancelled += 1;
        });
        return counts;
    }, [bookings]);

    const filteredBookings = useMemo(
        () => bookings.filter((booking) => matchesServiceTab(booking.bookingStatus, activeTab)),
        [bookings, activeTab]
    );

    const appliedJobsWithBooking = useMemo(() => (
        [...appliedJobs]
            .sort((a, b) => new Date(b?.appliedAt || 0).getTime() - new Date(a?.appliedAt || 0).getTime())
            .map((application) => ({
                application,
                linkedBookingId: getApplicationBookingId(application, bookings),
            }))
    ), [appliedJobs, bookings]);

    return (
        <div className={BOOKING_LAYOUT_CLASS.page}>
            <div className={BOOKING_LAYOUT_CLASS.pageHeader}>
                <div>
                    <h1 className={BOOKING_LAYOUT_CLASS.title}>
                        <span>📅</span> My Bookings
                    </h1>
                    <p className={BOOKING_LAYOUT_CLASS.subtitle}>
                        You are in the <strong className="text-[#904d00]">{workflowLabel}</strong>.
                    </p>
                </div>

                <div className={bookingStateClass('neutral', 'text-sm px-3 py-2')}>
                    {isWorkerRole
                        ? 'Manage work bookings and track your applied jobs.'
                        : isCustomerRole
                            ? 'Manage your service and equipment bookings.'
                            : 'Bookings are available for worker and customer accounts.'}
                </div>
            </div>

            {visibleSections.length > 1 && (
                <div className={cx('booking-tab-group', 'mb-5')}>
                    {visibleSections.map((section) => (
                        <button
                            key={section.key}
                            onClick={() => setActiveSection(section.key)}
                            className={bookingPillTabClass(activeSection === section.key)}
                        >
                            {section.label}
                        </button>
                    ))}
                </div>
            )}

            {activeSection === 'services' && (
                <>
                    {isWorkerRole && (
                        <div className={cx('booking-tab-group', 'mb-5')}>
                            {WORKER_SERVICE_STAGES.map((stage) => (
                                <button
                                    key={stage.key}
                                    onClick={() => setActiveServiceStage(stage.key)}
                                    className={bookingPillTabClass(activeServiceStage === stage.key)}
                                >
                                    {stage.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {activeServiceStage === 'bookings' ? (
                        <>
                            <div className={BOOKING_LAYOUT_CLASS.serviceTabs}>
                                {SERVICE_BOOKING_TABS.map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={bookingUnderlineTabClass(activeTab === tab)}
                                    >
                                        {tab} ({serviceTabCounts[tab] || 0})
                                    </button>
                                ))}
                            </div>

                            {error && (
                                <BookingsErrorState message={error} onRetry={loadServiceBookings} />
                            )}

                            {loading ? (
                                <BookingsLoadingState label="Loading bookings..." />
                            ) : filteredBookings.length === 0 ? (
                                <BookingsEmptyState
                                    icon="📭"
                                    title={isWorkerRole ? `No ${activeTab} Work Bookings` : `No ${activeTab} Bookings`}
                                    description={isWorkerRole
                                        ? `You have no ${activeTab.toLowerCase()} work bookings right now. Check Applied Jobs for new opportunities.`
                                        : `You have no ${activeTab.toLowerCase()} bookings right now. Start by booking a service.`}
                                />
                            ) : (
                                <div className={BOOKING_LAYOUT_CLASS.cardGrid}>
                                    {filteredBookings.map((booking) => (
                                        <ServiceBookingCard
                                            key={booking.bookingId}
                                            booking={booking}
                                            isWorkerSide={isWorkerRole}
                                            navigate={navigate}
                                            onStatusChange={handleStatusChange}
                                            isUpdating={statusUpdatingId === booking.bookingId}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {appliedError && (
                                <BookingsErrorState message={appliedError} onRetry={loadAppliedJobs} />
                            )}

                            {appliedLoading ? (
                                <BookingsLoadingState label="Loading applied jobs..." />
                            ) : appliedJobsWithBooking.length === 0 ? (
                                <BookingsEmptyState
                                    icon="🧰"
                                    title="No Applied Jobs Yet"
                                    description="Jobs you apply for as a worker will appear here with their latest status."
                                />
                            ) : (
                                <div className={BOOKING_LAYOUT_CLASS.cardGrid}>
                                    {appliedJobsWithBooking.map(({ application, linkedBookingId }, index) => (
                                        <AppliedJobCard
                                            key={application.applicationId || application.job?.jobId || index}
                                            application={application}
                                            linkedBookingId={linkedBookingId}
                                            navigate={navigate}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {activeSection === 'equipment' && (
                <>
                    {equipmentError && (
                        <BookingsErrorState message={equipmentError} onRetry={() => loadEquipmentBookings(true)} />
                    )}
                    {equipmentLoading ? (
                        <BookingsLoadingState label="Loading equipment rentals..." />
                    ) : equipmentBookings.length === 0 ? (
                        <BookingsEmptyState
                            icon="🔧"
                            title="No Equipment Rentals"
                            description="Your equipment rental bookings will appear here."
                        />
                    ) : (
                        <div className={BOOKING_LAYOUT_CLASS.cardGrid}>
                            {equipmentBookings.map((booking) => (
                                <EquipmentBookingCard
                                    key={booking.equipmentBookingId || booking.id}
                                    booking={booking}
                                    onReturn={handleEquipmentReturn}
                                    isReturning={equipmentReturningId === (booking.equipmentBookingId || booking.id)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
