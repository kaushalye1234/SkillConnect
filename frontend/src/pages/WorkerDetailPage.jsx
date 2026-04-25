import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { workerAPI, reviewAPI, bookingAPI, jobAPI } from '../api';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';
import {
    DEFAULT_BOOKING_FORM,
    buildScheduledTime,
    parseTimeToMinutes,
    slotLabelFromMinutes,
    to12HourTimeParts,
    to24Hour,
    toDateKey,
} from '../utils/bookingUtils';
import {
    BOOKING_MODAL_CLASS,
    bookingAvailabilityPillClass,
    bookingButtonClass,
    bookingInputClass,
    bookingLegendPillClass,
    bookingSlotButtonClass,
    bookingStateClass,
    bookingSubmitButtonClass,
    cx,
} from '../utils/bookingStyleUtils';

function Stars({ rating = 0 }) {
    return (
        <span style={{ display: 'inline-flex', gap: 2, fontSize: 18 }}>
            {[1, 2, 3, 4, 5].map(i => (
                <span key={i} style={{ color: i <= Math.round(rating) ? '#f59e0b' : '#e2e8f0' }}>★</span>
            ))}
        </span>
    );
}

export default function WorkerDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [worker, setWorker] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showBooking, setShowBooking] = useState(false);
    const [bookForm, setBookForm] = useState(DEFAULT_BOOKING_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [availability, setAvailability] = useState([]);
    const [busySlots, setBusySlots] = useState([]);
    const [myJobs, setMyJobs] = useState([]);

    const availableJobOptions = useMemo(
        () => myJobs.filter((job) => ['active', 'assigned'].includes(String(job.jobStatus || '').toLowerCase())),
        [myJobs]
    );

    const loadWorkerData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [wRes, rRes, aRes, bsRes, jobsRes] = await Promise.allSettled([
                workerAPI.getById(id),
                reviewAPI.getForWorker(id),
                workerAPI.getAvailability(id),
                bookingAPI.getBusySlotsData(id),
                user?.role === 'customer' ? jobAPI.getMine() : Promise.resolve(null),
            ]);

            if (wRes.status === 'fulfilled') setWorker(wRes.value.data.data);
            else setError('Worker not found.');

            setReviews(rRes.status === 'fulfilled' ? (rRes.value.data.data || []) : []);
            setAvailability(aRes.status === 'fulfilled' ? (aRes.value?.data?.data || []) : []);
            setBusySlots(bsRes.status === 'fulfilled' ? bsRes.value : []);
            setMyJobs(jobsRes.status === 'fulfilled' ? (jobsRes.value?.data?.data || []) : []);
        } catch {
            setError('Failed to load worker.');
        } finally {
            setLoading(false);
        }
    }, [id, user?.role]);

    useEffect(() => {
        loadWorkerData();
    }, [loadWorkerData]);

    const updateBookForm = useCallback((patch) => {
        setBookForm((prev) => ({ ...prev, ...patch }));
    }, []);

    const applySlotToForm = useCallback((dateKey, minutes) => {
        updateBookForm({
            scheduledDate: dateKey,
            ...to12HourTimeParts(minutes),
        });
    }, [updateBookForm]);

    const nextSevenDays = useMemo(() => (
        Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() + index);
            return {
                date,
                key: toDateKey(date),
                label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            };
        })
    ), []);

    const busySlotKeySet = useMemo(() => new Set(
        busySlots.map((slot) => `${slot.scheduledDate}|${String(slot.scheduledTime || '').slice(0, 5)}`)
    ), [busySlots]);

    const busyDateSet = useMemo(() => new Set(
        busySlots.map((slot) => slot.scheduledDate).filter(Boolean)
    ), [busySlots]);

    const availabilityByDate = useMemo(() => {
        const grouped = new Map();
        availability.forEach((entry) => {
            const dateKey = entry.availableDate;
            if (!dateKey) return;

            const bucket = grouped.get(dateKey) || { hasEntries: false, windows: [] };
            bucket.hasEntries = true;
            if (entry.isAvailable !== false) {
                const start = parseTimeToMinutes(entry.startTime);
                const end = parseTimeToMinutes(entry.endTime);
                if (start !== null && end !== null && end > start) {
                    bucket.windows.push({ start, end });
                }
            }
            grouped.set(dateKey, bucket);
        });
        return grouped;
    }, [availability]);

    const isSlotAvailable = useCallback((dateKey, slotMinutes) => {
        const hhmm = `${String(Math.floor(slotMinutes / 60)).padStart(2, '0')}:${String(slotMinutes % 60).padStart(2, '0')}`;
        if (busySlotKeySet.has(`${dateKey}|${hhmm}`)) return false;

        const dayAvailability = availabilityByDate.get(dateKey);
        if (!dayAvailability?.hasEntries) return true;
        if (dayAvailability.windows.length === 0) return false;
        return dayAvailability.windows.some((window) => slotMinutes >= window.start && slotMinutes < window.end);
    }, [availabilityByDate, busySlotKeySet]);

    const getSelectedSlotMinutes = useCallback(() => {
        const hour24 = to24Hour(bookForm.scheduledHour, bookForm.scheduledPeriod);
        return hour24 * 60 + parseInt(bookForm.scheduledMinute || '0', 10);
    }, [bookForm.scheduledHour, bookForm.scheduledMinute, bookForm.scheduledPeriod]);

    const selectedSlotAvailable = bookForm.scheduledDate
        ? isSlotAvailable(bookForm.scheduledDate, getSelectedSlotMinutes())
        : true;

    const getDaySlots = useCallback((dateKey) => {
        const slots = [];
        for (let hour = 8; hour <= 19; hour += 1) {
            const slotMinutes = hour * 60;
            slots.push({
                minutes: slotMinutes,
                label: slotLabelFromMinutes(slotMinutes),
                available: isSlotAvailable(dateKey, slotMinutes),
            });
        }
        return slots;
    }, [isSlotAvailable]);

    const handleBook = async (e) => {
        e.preventDefault();
        if (!bookForm.scheduledDate) {
            setBookingError('Please select a date before creating the booking.');
            toast.error('Please select a date first.');
            return;
        }
        setSubmitting(true);
        setBookingError('');
        const scheduledTime = buildScheduledTime(bookForm.scheduledHour, bookForm.scheduledMinute, bookForm.scheduledPeriod);
        try {
            await bookingAPI.create({
                jobId: bookForm.jobId ? parseInt(bookForm.jobId, 10) : null,
                workerId: worker.workerId,
                scheduledDate: bookForm.scheduledDate,
                scheduledTime,
                notes: bookForm.notes,
            });
            toast.success('Booking created successfully!');
            setShowBooking(false);
            setBookForm(DEFAULT_BOOKING_FORM);
            loadWorkerData();
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to create booking.';
            setBookingError(message);
            toast.error(message);
        } finally { setSubmitting(false); }
    };

    const formatDate = (dt) => {
        if (!dt) return '';
        return new Date(dt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    if (loading) return (
        <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: '#0891b2' }}>
            <span className="spinner" /> Loading worker profile...
        </div>
    );

    if (error || !worker) return (
        <div className="fade-in">
            <div className="empty-state">
                <span className="empty-icon">👷</span>
                <p>{error || 'Worker not found.'}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-secondary" onClick={loadWorkerData}>Retry</button>
                    <Link to="/workers" className="btn-primary" style={{ textDecoration: 'none' }}>Back to Workers</Link>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fade-in">
            <Link to="/workers" style={{ color: '#0891b2', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
                ← Back to Workers
            </Link>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {/* Left: Profile */}
                <div style={{ flex: '1 1 60%', minWidth: 300 }}>
                    <div className="hm-card" style={{ padding: 28, marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                            <div className="avatar" style={{ width: 80, height: 80, fontSize: 28 }}>
                                {worker.firstName?.[0]}{worker.lastName?.[0]}
                            </div>
                            <div>
                                <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0c4a6e', marginBottom: 4 }}>
                                    {worker.firstName} {worker.lastName}
                                </h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                                    <span className={`badge ${worker.isVerified ? 'badge-green' : 'badge-yellow'}`}>
                                        {worker.isVerified ? '✓ Verified' : '⏳ Pending'}
                                    </span>
                                    {worker.district && <span className="badge badge-teal">📍 {worker.city ? `${worker.city}, ` : ''}{worker.district}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Stars rating={worker.averageRating} />
                                    <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
                                        {worker.averageRating || '0'} ({reviews.length} reviews)
                                    </span>
                                </div>
                            </div>
                        </div>

                        {worker.bio && (
                            <>
                                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0c4a6e', marginBottom: 6 }}>About</h3>
                                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>{worker.bio}</p>
                            </>
                        )}

                        {worker.hourlyRateMin && (
                            <div className="stat-card" style={{ display: 'inline-block', padding: '12px 20px' }}>
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Hourly Rate</span>
                                <div style={{ fontSize: 20, fontWeight: 900, color: '#0891b2' }}>
                                    LKR {worker.hourlyRateMin} – {worker.hourlyRateMax}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Reviews */}
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0c4a6e', marginBottom: 12 }}>Reviews ({reviews.length})</h2>
                    {reviews.length === 0 ? (
                        <div className="empty-state" style={{ padding: 40 }}>
                            <span className="empty-icon">⭐</span>
                            <p>No reviews yet for this worker.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {reviews.map(r => (
                                <div key={r.reviewId} className="hm-card" style={{ padding: '16px 20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <Stars rating={r.overallRating} />
                                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0c4a6e' }}>{r.overallRating}/5</span>
                                    </div>
                                    {r.reviewText && <p style={{ fontSize: 13, color: '#475569', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 6 }}>"{r.reviewText}"</p>}
                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                        By {r.reviewer?.email || 'Customer'} · {formatDate(r.createdAt)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Actions */}
                <div style={{ flex: '1 1 30%', minWidth: 260 }}>
                    <div className="hm-card" style={{ padding: 24, position: 'sticky', top: 88 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0c4a6e', marginBottom: 16 }}>Actions</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {user?.role === 'customer' && (
                                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => {
                                        setBookingError('');
                                        setShowBooking(true);
                                    }}>
                                    📅 Create Booking
                                </button>
                            )}
                            <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                                onClick={() => navigate('/messages')}>
                                💬 Message Worker
                            </button>
                            <hr className="hm-divider" />
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                <div>Total Jobs: <strong style={{ color: '#0c4a6e' }}>{worker.totalJobs || 0}</strong></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking Modal */}
            {showBooking && (
                <div className={BOOKING_MODAL_CLASS.overlay} onClick={() => setShowBooking(false)}>
                    <div className={BOOKING_MODAL_CLASS.panel} onClick={e => e.stopPropagation()}>
                        <h2 className={BOOKING_MODAL_CLASS.title}>
                            <span style={{ fontSize: '1.875rem' }}>📅</span> Book {worker.firstName}
                        </h2>
                        
                        <form onSubmit={handleBook} className="space-y-6">
                            <div className={BOOKING_MODAL_CLASS.section}>
                                <label className="booking-label">Link to My Job (Optional)</label>
                                <select
                                    className={bookingInputClass('text-sm text-slate-700')}
                                    value={bookForm.jobId}
                                    onChange={e => updateBookForm({ jobId: e.target.value })}
                                >
                                    <option value="">No linked job</option>
                                    {availableJobOptions.map(job => (
                                        <option key={job.jobId} value={job.jobId}>
                                            #{job.jobId} - {job.jobTitle}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={BOOKING_MODAL_CLASS.section}>
                                <label className="booking-label">Select Date</label>
                                <input type="date" required
                                    className={bookingInputClass('text-sm text-slate-700')}
                                    min={new Date().toISOString().split('T')[0]}
                                    value={bookForm.scheduledDate} 
                                    onChange={e => {
                                        setBookingError('');
                                        updateBookForm({ scheduledDate: e.target.value });
                                    }} 
                                />
                                {busyDateSet.has(bookForm.scheduledDate) && (
                                    <div className={bookingStateClass('error', 'text-xs font-bold py-2 px-2.5')}>
                                        ⚠️ Worker has existing bookings on this date. Please ensure you select an available time.
                                    </div>
                                )}
                            </div>

                            <div className={BOOKING_MODAL_CLASS.availability}>
                                <div className={BOOKING_MODAL_CLASS.availabilityHeader}>
                                    <label className="booking-label" style={{ marginBottom: 0 }}>7-Day Availability</label>
                                    <div className={BOOKING_MODAL_CLASS.legend}>
                                        <span className={bookingLegendPillClass('free')}>Free</span>
                                        <span className={bookingLegendPillClass('busy')}>Busy</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {nextSevenDays.map(day => {
                                        const slots = getDaySlots(day.key);
                                        const freeCount = slots.filter(s => s.available).length;
                                        return (
                                            <details key={day.key} className={BOOKING_MODAL_CLASS.dayDetails}>
                                                <summary className={BOOKING_MODAL_CLASS.daySummary}>
                                                    <span>{day.label}</span>
                                                    <span className={bookingAvailabilityPillClass(freeCount > 0)}>
                                                        {freeCount > 0 ? `${freeCount} free slot(s)` : 'Not available'}
                                                    </span>
                                                </summary>
                                                <div className={BOOKING_MODAL_CLASS.daySlots}>
                                                    {slots.map(slot => (
                                                        <button
                                                            type="button"
                                                            key={slot.label}
                                                            onClick={() => slot.available && applySlotToForm(day.key, slot.minutes)}
                                                            disabled={!slot.available}
                                                            className={bookingSlotButtonClass(slot.available)}
                                                        >
                                                            {slot.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </details>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className={BOOKING_MODAL_CLASS.section}>
                                <label className="booking-label">Exact Time</label>
                                <div className={BOOKING_MODAL_CLASS.timeGroup}>
                                    <select className={bookingInputClass('flex-1 text-sm text-slate-700')}
                                        value={bookForm.scheduledHour}
                                        onChange={e => {
                                            setBookingError('');
                                            updateBookForm({ scheduledHour: e.target.value });
                                    }}>
                                        {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                    <span className={BOOKING_MODAL_CLASS.timeSeparator}>:</span>
                                    <select className={bookingInputClass('flex-1 text-sm text-slate-700')}
                                        value={bookForm.scheduledMinute}
                                        onChange={e => {
                                            setBookingError('');
                                            updateBookForm({ scheduledMinute: e.target.value });
                                    }}>
                                        {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select className={bookingInputClass(cx('flex-1 text-sm', BOOKING_MODAL_CLASS.periodInput))}
                                        value={bookForm.scheduledPeriod}
                                        onChange={e => {
                                            setBookingError('');
                                            updateBookForm({ scheduledPeriod: e.target.value });
                                        }}>
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                            </div>

                            <div className={BOOKING_MODAL_CLASS.section}>
                                <label className="booking-label">Notes for Worker</label>
                                <textarea 
                                    className={bookingInputClass('resize-y text-sm text-slate-700')} 
                                    rows={3} 
                                    placeholder="Describe what you need help with..."
                                    value={bookForm.notes} 
                                    onChange={e => {
                                        setBookingError('');
                                        updateBookForm({ notes: e.target.value });
                                    }} 
                                />
                            </div>

                            {(bookingError || !selectedSlotAvailable) && (
                                <div className={bookingStateClass('error', 'text-sm font-medium')}>
                                    {bookingError || 'The selected time is no longer available. Please choose another slot.'}
                                </div>
                            )}

                            <div className={BOOKING_MODAL_CLASS.actions}>
                                <button type="submit" 
                                    disabled={submitting || !selectedSlotAvailable}
                                    className={bookingSubmitButtonClass(submitting || !selectedSlotAvailable)}
                                >
                                    {submitting ? 'Creating booking…' : (!selectedSlotAvailable ? 'Selected time unavailable' : 'Create Booking')}
                                </button>
                                <button type="button" 
                                    className={cx(bookingButtonClass('neutral'), BOOKING_MODAL_CLASS.closeButton)}
                                    onClick={() => {
                                        setBookingError('');
                                        setShowBooking(false);
                                    }}>
                                    Close
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
