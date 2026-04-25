import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { bookingAPI, userAPI } from '../api';
import { useAuth } from '../AuthContext';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import {
    BOOKING_TIMELINE_COLORS,
    CUSTOMER_CANCEL_STATES,
    WORKER_PENDING_STATES,
    formatBookingStatusLabel,
} from '../utils/bookingUtils';
import {
    BOOKING_DETAIL_CLASS,
    BOOKING_SURFACE_CLASS,
    bookingInputClass,
    bookingButtonClass,
    bookingDetailFieldCardClass,
    bookingDetailPanelClass,
    bookingStateClass,
    bookingTimelineBlockClass,
} from '../utils/bookingStyleUtils';

export default function BookingDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [booking, setBooking] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reason, setReason] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState('');
    const [customerProfile, setCustomerProfile] = useState(null);
    const [pastBookingsCount, setPastBookingsCount] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [bRes, hRes] = await Promise.allSettled([
                bookingAPI.getByIdData(id),
                bookingAPI.getHistoryData(id),
            ]);
            if (bRes.status === 'fulfilled') setBooking(bRes.value);
            else setError('Booking not found.');
            if (hRes.status === 'fulfilled') setHistory(hRes.value);
        } catch (err) { setError('Failed to load booking.'); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const changeStatus = useCallback(async (status) => {
        setUpdatingStatus(status);
        try {
            const updatedBooking = await bookingAPI.updateStatusData(id, status, reason);
            setReason('');
            if (updatedBooking) {
                setBooking(updatedBooking);
            }
            setHistory(await bookingAPI.getHistoryData(id));
            toast.success(`Status updated to ${formatBookingStatusLabel(status)}`);
        } catch (err) { 
            toast.error(err.response?.data?.message || 'Failed to change status'); 
        } finally {
            setUpdatingStatus('');
        }
    }, [id, reason]);

    const formatDate = (dt) => dt ? new Date(dt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    const isCustomer = booking?.customer?.user?.userId === user?.userId;
    const isWorker = booking?.worker?.user?.userId === user?.userId;
    const isRequestedBooking = String(booking?.bookingStatus || '').toLowerCase() === 'requested';
    const isAcceptedBooking = String(booking?.bookingStatus || '').toLowerCase() === 'accepted';



    useEffect(() => {
        if (!booking || !isWorker || !isRequestedBooking) {
            setCustomerProfile(null);
            setPastBookingsCount(0);
            return;
        }

        const customerUserId = booking.customer?.user?.userId;
        const customerProfileId = booking.customer?.customerId;

        if (!customerUserId && !customerProfileId) return;

        const unwrapData = (response) => response?.data?.data || response?.data || null;

        Promise.allSettled([
            customerUserId ? userAPI.getProfile(customerUserId) : Promise.resolve(null),
            bookingAPI.getMineData('worker'),
        ]).then(([profileRes, workerBookingsRes]) => {
            if (profileRes.status === 'fulfilled') {
                setCustomerProfile(unwrapData(profileRes.value));
            }

            if (workerBookingsRes.status === 'fulfilled') {
                const workerBookings = Array.isArray(workerBookingsRes.value) ? workerBookingsRes.value : [];
                const currentBookingId = booking.bookingId;
                const currentCreatedAt = booking.createdAt ? new Date(booking.createdAt).getTime() : null;

                const previousForCustomer = workerBookings.filter((item) => {
                    const sameCustomerUser = customerUserId && String(item?.customer?.user?.userId) === String(customerUserId);
                    const sameCustomerProfile = customerProfileId && String(item?.customer?.customerId) === String(customerProfileId);
                    if (!sameCustomerUser && !sameCustomerProfile) return false;
                    if (String(item?.bookingId) === String(currentBookingId)) return false;
                    if (!currentCreatedAt || !item?.createdAt) return true;
                    return new Date(item.createdAt).getTime() < currentCreatedAt;
                });
                setPastBookingsCount(previousForCustomer.length);
            }
        });
    }, [booking, isWorker, isRequestedBooking]);

    if (loading) return (
        <div className="animate-fade-in flex items-center justify-center h-64 gap-5" style={{ color: 'var(--b-primary)' }}>
            <span className="spinner" /> Loading booking...
        </div>
    );
    if (error || !booking) return (
        <div className={`animate-fade-in ${BOOKING_SURFACE_CLASS.emptyState} p-12 max-w-lg mx-auto mt-12`}>
            <span className="text-5xl block mb-4">📅</span>
            <p className="mb-6" style={{ color: 'var(--b-on-surface-variant)' }}>{error || 'Booking not found.'}</p>
            <Link to="/bookings" className={bookingButtonClass('primary')}>Back to Bookings</Link>
        </div>
    );

    return (
        <div className="booking-detail-page animate-fade-in max-w-6xl mx-auto px-4 py-8">
            <Link to="/bookings" className={BOOKING_DETAIL_CLASS.backLink}>
                &larr; Back to Bookings
            </Link>

            <div className="flex flex-wrap lg:flex-nowrap gap-10">
                {/* Left: Details */}
                <div className="flex-1 w-full lg:w-2/3 min-w-[300px]">
                    <div className={bookingDetailPanelClass('summary', 'p-10 md:p-12 mb-8')}>
                        <div className={BOOKING_DETAIL_CLASS.heroHeader}>
                            <h1 className={`${BOOKING_DETAIL_CLASS.title} text-2xl font-extrabold`}>Booking #{booking.bookingId}</h1>
                            <div className={BOOKING_DETAIL_CLASS.statusWrap}>
                                <StatusBadge status={booking.bookingStatus} />
                            </div>
                        </div>

                        <div className={BOOKING_DETAIL_CLASS.fieldGrid}>
                            <div className={bookingDetailFieldCardClass('party')}>
                                <div className={BOOKING_DETAIL_CLASS.fieldLabel}>Customer</div>
                                <div className={BOOKING_DETAIL_CLASS.fieldValue}>{booking.customer?.firstName} {booking.customer?.lastName}</div>
                                <div className={BOOKING_DETAIL_CLASS.fieldSubvalue}>{booking.customer?.user?.email}</div>
                            </div>
                            <div className={bookingDetailFieldCardClass('party')}>
                                <div className={BOOKING_DETAIL_CLASS.fieldLabel}>Worker</div>
                                <div className={BOOKING_DETAIL_CLASS.fieldValue}>
                                    {booking.worker?.firstName} {booking.worker?.lastName}
                                </div>
                                <div className={BOOKING_DETAIL_CLASS.fieldSubvalue}>{booking.worker?.user?.email}</div>
                            </div>
                            <div className={bookingDetailFieldCardClass('schedule')}>
                                <div className={BOOKING_DETAIL_CLASS.fieldLabel}>Scheduled Date</div>
                                <div className={BOOKING_DETAIL_CLASS.fieldValue}>{booking.scheduledDate || 'N/A'}</div>
                            </div>
                            <div className={bookingDetailFieldCardClass('schedule')}>
                                <div className={BOOKING_DETAIL_CLASS.fieldLabel}>Scheduled Time</div>
                                <div className={BOOKING_DETAIL_CLASS.fieldValue}>{booking.scheduledTime || 'N/A'}</div>
                            </div>
                        </div>

                        {booking.notes && (
                            <div className="mb-6">
                                <div className={BOOKING_DETAIL_CLASS.fieldLabel}>Notes</div>
                                <div className={bookingStateClass('neutral', 'text-sm italic')}>
                                    {booking.notes}
                                </div>
                            </div>
                        )}

                        {booking.finalCost && (
                            <div className={BOOKING_DETAIL_CLASS.highlightField}>
                                <span className={BOOKING_DETAIL_CLASS.fieldLabel}>Total Price</span>
                                <div className="text-2xl font-black" style={{ color: 'var(--b-primary)' }}>LKR {booking.finalCost}</div>
                            </div>
                        )}

                        {/* — Extra metadata — */}
                        <div className={`${BOOKING_DETAIL_CLASS.fieldGrid} mt-6`}>
                            {booking.createdAt && (
                                <div className={bookingDetailFieldCardClass()}>
                                    <div className={BOOKING_DETAIL_CLASS.fieldLabel}>Created At</div>
                                    <div className={BOOKING_DETAIL_CLASS.fieldValue}>{formatDate(booking.createdAt)}</div>
                                </div>
                            )}
                            {booking.estimatedDurationHours && (
                                <div className={bookingDetailFieldCardClass()}>
                                    <div className={BOOKING_DETAIL_CLASS.fieldLabel}>Estimated Duration</div>
                                    <div className={BOOKING_DETAIL_CLASS.fieldValue}>{booking.estimatedDurationHours} hour{booking.estimatedDurationHours !== 1 ? 's' : ''}</div>
                                </div>
                            )}
                        </div>

                        {booking.cancellationReason && (
                            <div className="mt-4">
                                <div className={BOOKING_DETAIL_CLASS.fieldLabel}>Cancellation Reason</div>
                                <div className={bookingStateClass('error', 'text-sm')}>
                                    {booking.cancellationReason}
                                </div>
                            </div>
                        )}


                    </div>

                    {isWorker && isRequestedBooking && (
                        <div className={bookingDetailPanelClass('summary', 'p-8 md:p-10 mb-8')}>
                            <h3 className={`${BOOKING_DETAIL_CLASS.actionsHeading} text-lg font-bold mb-4`}>Customer Info</h3>
                            <div className={BOOKING_DETAIL_CLASS.infoBlock}>
                                <div className="flex flex-wrap items-start justify-between gap-6">
                                    <div className="flex items-center gap-5 min-w-0">
                                        {booking.customer?.profilePicture ? (
                                            <img
                                                src={booking.customer.profilePicture}
                                                alt={`${booking.customer?.firstName || ''} ${booking.customer?.lastName || ''}`.trim() || 'Customer'}
                                                className="h-14 w-14 rounded-full object-cover ring-2 ring-white"
                                            />
                                        ) : (
                                            <div className="h-14 w-14 rounded-full font-bold flex items-center justify-center ring-2 ring-white" style={{ background: 'var(--b-primary-fixed)', color: 'var(--b-primary)' }}>
                                                {`${booking.customer?.firstName?.[0] || ''}${booking.customer?.lastName?.[0] || ''}`.toUpperCase() || 'CU'}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm" style={{ color: 'var(--b-secondary)' }}>Customer</p>
                                            <p className="text-base font-bold truncate" style={{ color: 'var(--b-on-surface)' }}>
                                                {booking.customer?.firstName} {booking.customer?.lastName}
                                            </p>
                                            <p className="text-xs truncate" style={{ color: 'var(--b-secondary)' }}>{booking.customer?.user?.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className={bookingButtonClass('primary', 'text-sm')}
                                        onClick={() =>
                                            navigate(
                                                `/customers/${booking.customer?.user?.userId || booking.customer?.customerId}`,
                                                {
                                                    state: {
                                                        customer: {
                                                            ...(booking.customer || {}),
                                                            ...(customerProfile || {}),
                                                        },
                                                    },
                                                }
                                            )
                                        }
                                    >
                                        View Profile
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className={BOOKING_DETAIL_CLASS.infoBlock}>
                                    <p className={BOOKING_DETAIL_CLASS.infoLabel}>Location</p>
                                    <p className={BOOKING_DETAIL_CLASS.infoValue}>
                                        {customerProfile?.location
                                            || customerProfile?.district
                                            || booking.customer?.district
                                            || 'Not specified'}
                                    </p>
                                </div>
                                <div className={BOOKING_DETAIL_CLASS.infoBlock}>
                                    <p className={BOOKING_DETAIL_CLASS.infoLabel}>Past Bookings</p>
                                    <p className={BOOKING_DETAIL_CLASS.infoValue}>{pastBookingsCount}</p>
                                </div>
                                <div className={BOOKING_DETAIL_CLASS.infoBlock}>
                                    <p className={BOOKING_DETAIL_CLASS.infoLabel}>Estimated Pay</p>
                                    <p className={BOOKING_DETAIL_CLASS.infoValue} style={{ color: 'var(--b-primary)' }}>
                                        {booking.finalCost ? `LKR ${booking.finalCost}` : (booking.notes ? 'See booking notes' : 'Not specified')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {isWorker && isRequestedBooking && (booking.job || booking.jobId) && (
                        <div className={bookingDetailPanelClass('summary', 'p-8 md:p-10 mb-8')}>
                            <h3 className={`${BOOKING_DETAIL_CLASS.actionsHeading} text-lg font-bold mb-4`}>Job Details</h3>
                            <div className="space-y-3">
                                <div className={BOOKING_DETAIL_CLASS.infoBlock}>
                                    <p className={BOOKING_DETAIL_CLASS.infoLabel}>Title</p>
                                    <p className={BOOKING_DETAIL_CLASS.infoValue}>
                                        {booking.job?.jobTitle || booking.job?.title || 'Untitled job'}
                                    </p>
                                </div>
                                <div className={BOOKING_DETAIL_CLASS.infoBlock}>
                                    <p className={BOOKING_DETAIL_CLASS.infoLabel}>Description</p>
                                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--b-on-surface-variant)' }}>
                                        {booking.job?.jobDescription || booking.job?.description || 'No job description provided.'}
                                    </p>
                                </div>
                                <div className={BOOKING_DETAIL_CLASS.infoBlock}>
                                    <p className={BOOKING_DETAIL_CLASS.infoLabel}>Booking Notes</p>
                                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--b-on-surface-variant)' }}>
                                        {booking.notes || 'No booking notes provided.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className={bookingDetailPanelClass('actions', 'p-8')}>
                        <h3 className={`${BOOKING_DETAIL_CLASS.actionsHeading} text-base font-bold mb-4`}>Manage Booking Actions</h3>
                        
                        <div className={BOOKING_DETAIL_CLASS.actionsGrid}>
                            {isCustomer && CUSTOMER_CANCEL_STATES.includes(booking.bookingStatus) && (
                                <button disabled={!!updatingStatus} className={bookingButtonClass('danger')} onClick={() => changeStatus('cancelled')}>{updatingStatus === 'cancelled' ? 'Cancelling…' : 'Cancel Booking'}</button>
                            )}
                            {isWorker && WORKER_PENDING_STATES.includes(booking.bookingStatus) && (
                                <>
                                    <button disabled={!!updatingStatus} className={bookingButtonClass('info')} onClick={() => changeStatus('accepted')}>{updatingStatus === 'accepted' ? 'Updating…' : 'Accept Booking'}</button>
                                    <button disabled={!!updatingStatus} className={bookingButtonClass('neutral')} onClick={() => changeStatus('rejected')}>{updatingStatus === 'rejected' ? 'Updating…' : 'Reject Booking'}</button>
                                </>
                            )}
                            {isWorker && booking.bookingStatus === 'accepted' && (
                                <button disabled={!!updatingStatus} className={bookingButtonClass('progress')} onClick={() => changeStatus('in_progress')}>{updatingStatus === 'in_progress' ? 'Updating…' : 'Confirm Arrival (Start Job)'}</button>
                            )}
                            {isWorker && booking.bookingStatus === 'in_progress' && (
                                <button disabled={!!updatingStatus} className={bookingButtonClass('success')} onClick={() => changeStatus('completed')}>{updatingStatus === 'completed' ? 'Updating…' : 'Mark as Completed'}</button>
                            )}
                            {isWorker && ['accepted', 'in_progress'].includes(booking.bookingStatus) && (
                                <button disabled={!!updatingStatus} className={bookingButtonClass('danger')} onClick={() => changeStatus('cancelled')}>{updatingStatus === 'cancelled' ? 'Cancelling…' : 'Cancel Booking'}</button>
                            )}
                            <Link to="/messages" className={bookingButtonClass('neutral')}>💬 Message Participant</Link>
                        </div>
                        <div className={BOOKING_DETAIL_CLASS.reasonNote}>
                            <label className={BOOKING_DETAIL_CLASS.reasonLabel}>Reason / Note (optional when changing status)</label>
                            <input className={bookingInputClass(`${BOOKING_DETAIL_CLASS.reasonInput} text-sm text-[#564334]`)}
                                placeholder="Add an optional reason..." value={reason} onChange={e => setReason(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Right: Timeline */}
                <div className="flex-none w-full lg:w-1/3 min-w-[260px]">
                    <div className={bookingDetailPanelClass('timeline', `${BOOKING_DETAIL_CLASS.sidebarCard} p-8`)}>
                        <h3 className={BOOKING_DETAIL_CLASS.timelineHeading}>
                            <span className={BOOKING_DETAIL_CLASS.timelineHeadingIcon}>📜</span> Status Timeline
                        </h3>
                        {history.length === 0 ? (
                            <p className={bookingStateClass('neutral', 'text-sm')}>No status updates yet.</p>
                        ) : (
                            <div className={BOOKING_DETAIL_CLASS.timelineTrack}>
                                {history.map((h, i) => {
                                    const statusVal = h.newStatus || h.status; 
                                    const color = BOOKING_TIMELINE_COLORS[statusVal] || '#94a3b8';
                                    return (
                                        <div key={i} className={bookingTimelineBlockClass(`mb-6 relative group ${BOOKING_DETAIL_CLASS.timelineEntry}`)}>
                                            <div
                                                className={BOOKING_DETAIL_CLASS.timelineDot}
                                                style={{ '--booking-dot-color': color, '--booking-dot-ring': `${color}40` }}
                                            />
                                            <div className="font-bold text-sm text-[#213145]">
                                                {formatBookingStatusLabel(statusVal)}
                                            </div>
                                            <div className={BOOKING_DETAIL_CLASS.timelineDate}>{formatDate(h.changedAt)}</div>
                                            {h.changeReason && (
                                                <div className={bookingStateClass('neutral', 'text-xs mt-2 py-2 px-3')}>
                                                    {h.changeReason}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {booking.bookingStatus === 'completed' && (isCustomer || isWorker) && (
                <div className={BOOKING_DETAIL_CLASS.nextActionCard}>
                    <h3 className={`${BOOKING_DETAIL_CLASS.actionsHeading} text-lg font-bold mb-2`}>What's Next?</h3>
                    {isCustomer && (
                        <>
                            <p className="text-sm mb-4" style={{ color: 'var(--b-on-surface-variant)' }}>
                                How did it go? Your feedback helps the community.
                            </p>
                            <div className="flex flex-wrap gap-5">
                                <button
                                    type="button"
                                    className={bookingButtonClass('success')}
                                    onClick={() =>
                                        navigate(
                                            `/reviews/create?bookingId=${booking.bookingId || id}&workerId=${booking.worker?.user?.userId}`
                                        )
                                    }
                                >
                                    Leave a Review
                                </button>
                                <button
                                    type="button"
                                    className={bookingButtonClass('danger')}
                                    onClick={() =>
                                        navigate(
                                            `/complaints/create?bookingId=${booking.bookingId || id}&workerId=${booking.worker?.user?.userId}`
                                        )
                                    }
                                >
                                    File a Complaint
                                </button>
                            </div>
                        </>
                    )}

                    {isWorker && (
                        <>
                            <p className="text-sm mb-4" style={{ color: 'var(--b-on-surface-variant)' }}>
                                Rate your experience with this customer.
                            </p>
                            <button
                                type="button"
                                className={bookingButtonClass('success')}
                                onClick={() =>
                                    navigate(
                                        `/reviews/create?bookingId=${booking.bookingId || id}&customerId=${booking.customer?.user?.userId}`
                                    )
                                }
                            >
                                Review this Customer
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
