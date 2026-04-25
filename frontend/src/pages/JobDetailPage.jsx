import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { jobAPI, messageAPI, reviewAPI, complaintAPI } from '../api';
import { useAuth } from '../AuthContext';
import StatusBadge from '../components/StatusBadge';
import StarRating from '../components/StarRating';

const URGENCY = { emergency: 'badge-red', urgent: 'badge-yellow', standard: 'badge-green' };

export default function JobDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [applications, setApplications] = useState([]);
    const [appsSupported, setAppsSupported] = useState(true);
    const [applyForm, setApplyForm] = useState({ coverNote: '', proposedPrice: '' });
    const [applied, setApplied] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [messageLoading, setMessageLoading] = useState(false);
    const [pendingReview, setPendingReview] = useState(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [complaintForm, setComplaintForm] = useState({
        complaintCategory: 'service_quality',
        complaintTitle: '',
        complaintDescription: '',
    });
    const [complaintSubmitting, setComplaintSubmitting] = useState(false);

    const [isWorkerAccepted, setIsWorkerAccepted] = useState(false);
    const [acceptingAppId, setAcceptingAppId] = useState(null);
    const [acceptSchedule, setAcceptSchedule] = useState({ scheduledDate: '', scheduledTime: '' });
    const [acceptSubmitting, setAcceptSubmitting] = useState(false);
    const [acceptError, setAcceptError] = useState('');

    const isOwner = job?.customer?.user?.userId === user?.userId;
    const acceptedApplication = applications.find(a => String(a.status).toLowerCase() === 'accepted');
    const isAcceptedWorker = user?.role === 'worker' && isWorkerAccepted;

    const getWorkerDisplay = (application) => {
        const worker = application?.workerUser;
        if (!worker) return 'Unknown worker';
        if (worker.email) return worker.email;
        return `Worker #${worker.userId || 'N/A'}`;
    };

    const getCustomerDisplay = () => {
        const customer = job?.customer;
        if (!customer) return 'Unknown';
        const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
        if (fullName) return fullName;
        return customer.user?.email || 'Unknown';
    };

    const loadJob = async () => {
        setLoading(true);
        try {
            const res = await jobAPI.getById(id);
            const j = res.data.data;
            setJob(j);
            setEditForm({
                title: j.jobTitle || '',
                description: j.jobDescription || '',
                budgetMin: j.budgetMin || '',
                budgetMax: j.budgetMax || ''
            });
        } catch { setError('Job not found.'); }
        finally { setLoading(false); }
    };

    const loadApplications = async () => {
        try {
            const res = await jobAPI.getApplications(id);
            setApplications(res.data.data || []);
        } catch { setAppsSupported(false); }
    };

    const checkApplied = async () => {
        try {
            const res = await jobAPI.getApplied();
            const myApps = res.data.data || [];
            const appForThisJob = myApps.find(a => a.job?.jobId === parseInt(id));
            setApplied(!!appForThisJob);
            setIsWorkerAccepted(!!appForThisJob && String(appForThisJob.status).toLowerCase() === 'accepted');
        } catch { /* ignore */ }
    };

    useEffect(() => {
        loadJob();
        if (user?.role === 'worker') checkApplied();
    }, [id]);

    useEffect(() => {
        if (isOwner) loadApplications();
    }, [isOwner, job?.jobId]);

    useEffect(() => {
        const loadPendingReview = async () => {
            if (!job?.jobId || !user) return;
            try {
                const res = await reviewAPI.getPendingForJob(job.jobId);
                const list = res.data?.data || [];
                if (list.length > 0) {
                    setPendingReview(list[0]);
                    setReviewRating(5);
                    setReviewText('');
                } else {
                    setPendingReview(null);
                }
            } catch {
                setPendingReview(null);
            }
        };
        loadPendingReview();
    }, [job?.jobId, user?.userId]);

    const handleApply = async (e) => {
        e.preventDefault();
        try {
            await jobAPI.apply(id, {
                coverNote: applyForm.coverNote,
                proposedPrice: applyForm.proposedPrice ? parseFloat(applyForm.proposedPrice) : null,
            });
            setApplied(true);
            alert('Application submitted!');
        } catch (err) { alert('Error: ' + (err.response?.data?.message || 'Failed')); }
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        try {
            await jobAPI.update(id, editForm);
            setEditing(false);
            loadJob();
        } catch (err) { alert('Error: ' + (err.response?.data?.message || 'Update failed')); }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this job?')) return;
        try { await jobAPI.delete(id); window.history.back(); }
        catch (err) { alert('Error: ' + (err.response?.data?.message || 'Delete failed')); }
    };

    const handleStatusChange = async (status) => {
        try { await jobAPI.updateStatus(id, status); loadJob(); }
        catch (err) { alert('Error: ' + (err.response?.data?.message || 'Failed')); }
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (!pendingReview) return;
        setReviewSubmitting(true);
        try {
            await reviewAPI.submit({
                bookingId: pendingReview.bookingId,
                revieweeId: pendingReview.revieweeUserId,
                rating: reviewRating,
                reviewText,
                reviewerType: pendingReview.reviewerType,
            });
            alert('Thank you for your review!');
            setPendingReview(null);
        } catch (err) {
            alert('Error: ' + (err.response?.data?.message || 'Failed to submit review'));
        } finally {
            setReviewSubmitting(false);
        }
    };

    const handleSubmitComplaint = async (e) => {
        e.preventDefault();
        setComplaintSubmitting(true);
        try {
            await complaintAPI.submit({
                complaintCategory: complaintForm.complaintCategory,
                complaintTitle: complaintForm.complaintTitle,
                complaintDescription: complaintForm.complaintDescription,
                bookingId: pendingReview?.bookingId || null,
                complainedAgainstUserId: pendingReview?.revieweeUserId || null,
                reviewId: null,
            });
            alert('Complaint submitted. Our team will review it.');
            setComplaintForm({ complaintCategory: 'service_quality', complaintTitle: '', complaintDescription: '' });
        } catch (err) {
            alert('Error: ' + (err.response?.data?.message || 'Failed to submit complaint'));
        } finally {
            setComplaintSubmitting(false);
        }
    };

    const handleAppAction = async (appId, status) => {
        try { await jobAPI.updateApplication(id, appId, { status }); loadApplications(); }
        catch (err) { alert('Error: ' + (err.response?.data?.message || 'Failed')); }
    };

    const openAcceptSchedule = (appId) => {
        setAcceptingAppId(appId);
        setAcceptSchedule({ scheduledDate: '', scheduledTime: '' });
        setAcceptError('');
    };

    const closeAcceptSchedule = () => {
        setAcceptingAppId(null);
        setAcceptSchedule({ scheduledDate: '', scheduledTime: '' });
        setAcceptError('');
    };

    const handleAcceptWithSchedule = async (appId) => {
        const scheduledDate = acceptSchedule.scheduledDate?.trim();
        const scheduledTime = acceptSchedule.scheduledTime?.trim();

        if (!scheduledDate || !scheduledTime) {
            setAcceptError('Please select both a date and time before accepting.');
            return;
        }

        setAcceptSubmitting(true);
        setAcceptError('');
        try {
            await jobAPI.updateApplication(id, appId, {
                status: 'accepted',
                scheduledDate,
                scheduledTime,
            });
            closeAcceptSchedule();
            loadApplications();
        } catch (err) {
            setAcceptError(err.response?.data?.message || 'Unable to accept application. Please try again.');
        } finally {
            setAcceptSubmitting(false);
        }
    };

    const handleMessageCustomer = async () => {
        const customerUserId = job?.customer?.user?.userId;
        if (!customerUserId) {
            alert('Customer details are unavailable for this job.');
            return;
        }
        setMessageLoading(true);
        try {
            const threadRes = await messageAPI.getMyThreads();
            const threads = threadRes.data?.data || [];
            const existingThread = threads.find(thread => {
                const participant1Id = thread?.participant1?.userId;
                const participant2Id = thread?.participant2?.userId;
                return participant1Id === customerUserId || participant2Id === customerUserId;
            });

            if (existingThread) {
                navigate(`/messages/${existingThread.threadId}`);
                return;
            }

            const createRes = await messageAPI.createThread({ participant2Id: customerUserId });
            const threadId = createRes.data?.data?.threadId;
            navigate(threadId ? `/messages/${threadId}` : '/messages');
        } catch (err) {
            alert('Unable to start a chat: ' + (err.response?.data?.message || 'Please try again later.'));
        } finally {
            setMessageLoading(false);
        }
    };

    const formatDate = (dt) => dt ? new Date(dt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    const formatTime = (time) => {
        if (!time) return '';
        const parts = String(time).split(':');
        if (parts.length < 2) return String(time);
        return `${parts[0]}:${parts[1]}`;
    };
    const todayIso = new Date().toISOString().split('T')[0];

    if (loading) return (
        <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: '#0891b2' }}>
            <span className="spinner" /> Loading job...
        </div>
    );
    if (error || !job) return (
        <div className="fade-in empty-state">
            <span className="empty-icon">📋</span>
            <p>{error || 'Job not found.'}</p>
            <Link to="/jobs" className="btn-primary" style={{ textDecoration: 'none' }}>Back to Jobs</Link>
        </div>
    );

    return (
        <div className="fade-in">
            <Link to="/jobs" style={{ color: '#0891b2', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
                ← Back to Jobs
            </Link>

            <div className="hm-card" style={{ padding: 28, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0c4a6e', marginBottom: 8 }}>{job.jobTitle}</h1>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <StatusBadge status={job.jobStatus} />
                            {job.category && <span className="badge badge-blue">{job.category.categoryName}</span>}
                            {job.district && <span className="badge badge-teal">📍 {job.district}</span>}
                            {job.urgencyLevel && <span className={`badge ${URGENCY[job.urgencyLevel] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>{job.urgencyLevel}</span>}
                        </div>
                    </div>
                    {(job.budgetMin || job.budgetMax) && (
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Budget</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: '#0891b2' }}>
                                LKR {job.budgetMin || '?'} – {job.budgetMax || '?'}
                            </div>
                        </div>
                    )}
                </div>

                <hr className="hm-divider" />
                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>{job.jobDescription}</p>

                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Posted by {getCustomerDisplay()} · {formatDate(job.createdAt)}
                </div>
            </div>

            {/* Owner Actions */}
            {isOwner && (
                <div className="hm-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0c4a6e', marginBottom: 12 }}>Manage Job</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn-secondary" onClick={() => setEditing(!editing)}>
                            {editing ? 'Cancel Edit' : '✏ Edit'}
                        </button>
                        {job.jobStatus === 'active' && <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={() => handleStatusChange('cancelled')}>Close Job</button>}
                        {job.jobStatus === 'assigned' && <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={() => handleStatusChange('completed')}>Mark as Completed</button>}
                        {job.jobStatus === 'cancelled' && <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={() => handleStatusChange('active')}>Reopen</button>}
                        <button className="btn-danger" onClick={handleDelete}>🗑 Delete</button>
                    </div>

                    {editing && (
                        <form onSubmit={handleEdit} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label className="hm-label">Title</label>
                                <input className="hm-input" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                            </div>
                            <div>
                                <label className="hm-label">Description</label>
                                <textarea className="hm-input" rows={4} style={{ resize: 'vertical' }} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label className="hm-label">Budget Min (LKR)</label>
                                    <input className="hm-input" type="number" value={editForm.budgetMin} onChange={e => setEditForm({ ...editForm, budgetMin: e.target.value })} />
                                </div>
                                <div>
                                    <label className="hm-label">Budget Max (LKR)</label>
                                    <input className="hm-input" type="number" value={editForm.budgetMax} onChange={e => setEditForm({ ...editForm, budgetMax: e.target.value })} />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>Save Changes</button>
                        </form>
                    )}
                </div>
            )}

            {/* Applications (Owner) */}
            {isOwner && appsSupported && (
                <div className="hm-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0c4a6e', marginBottom: 12 }}>Applications ({applications.length})</h3>

                    <div style={{
                        marginBottom: 14,
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: '1px solid #dbeafe',
                        background: acceptedApplication ? '#eff6ff' : '#f8fafc'
                    }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#0c4a6e', marginBottom: 6 }}>Accepted Worker</div>
                        {acceptedApplication ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#1e3a8a' }}>
                                <span><strong>{getWorkerDisplay(acceptedApplication)}</strong></span>
                                {acceptedApplication.proposedPrice && <span>Agreed price: LKR {acceptedApplication.proposedPrice}</span>}
                                {(acceptedApplication.scheduledDate || acceptedApplication.scheduledTime) && (
                                    <span>
                                        Scheduled for: {acceptedApplication.scheduledDate ? formatDate(acceptedApplication.scheduledDate) : 'TBD'}
                                        {acceptedApplication.scheduledTime ? ` at ${formatTime(acceptedApplication.scheduledTime)}` : ''}
                                    </span>
                                )}
                                <span>Accepted on: {formatDate(acceptedApplication.updatedAt || acceptedApplication.appliedAt)}</span>
                            </div>
                        ) : (
                            <div style={{ fontSize: 13, color: '#64748b' }}>No worker accepted yet.</div>
                        )}
                    </div>

                    {applications.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: 13 }}>No applications yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {applications.map(a => (
                                <div key={a.applicationId} style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e0f2fe' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0c4a6e' }}>{getWorkerDisplay(a)}</div>
                                            {a.proposedPrice && <span className="badge badge-green">LKR {a.proposedPrice}</span>}
                                            <StatusBadge status={a.status} />
                                        </div>
                                        {a.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    className="btn-primary"
                                                    style={{ padding: '5px 12px', fontSize: 11 }}
                                                    disabled={!!acceptedApplication}
                                                    onClick={() => openAcceptSchedule(a.applicationId)}
                                                >
                                                    Accept
                                                </button>
                                                <button className="btn-danger" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => handleAppAction(a.applicationId, 'rejected')}>Reject</button>
                                            </div>
                                        )}
                                    </div>
                                    {a.coverNote && <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{a.coverNote}</p>}
                                    {a.status === 'pending' && acceptingAppId === a.applicationId && (
                                        <div style={{ marginTop: 10, padding: 12, borderRadius: 10, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#0c4a6e', marginBottom: 8 }}>
                                                Schedule before accepting
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                <div>
                                                    <label className="hm-label" style={{ marginBottom: 4 }}>Date</label>
                                                    <input
                                                        type="date"
                                                        className="hm-input"
                                                        min={todayIso}
                                                        value={acceptSchedule.scheduledDate}
                                                        onChange={e => {
                                                            setAcceptSchedule({ ...acceptSchedule, scheduledDate: e.target.value });
                                                            if (acceptError) setAcceptError('');
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="hm-label" style={{ marginBottom: 4 }}>Time</label>
                                                    <input
                                                        type="time"
                                                        className="hm-input"
                                                        value={acceptSchedule.scheduledTime}
                                                        onChange={e => {
                                                            setAcceptSchedule({ ...acceptSchedule, scheduledTime: e.target.value });
                                                            if (acceptError) setAcceptError('');
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            {acceptError && (
                                                <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>{acceptError}</div>
                                            )}
                                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                                <button
                                                    className="btn-primary"
                                                    style={{ padding: '6px 12px', fontSize: 11 }}
                                                    disabled={acceptSubmitting}
                                                    onClick={() => handleAcceptWithSchedule(a.applicationId)}
                                                >
                                                    {acceptSubmitting ? 'Accepting...' : 'Confirm Accept'}
                                                </button>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '6px 12px', fontSize: 11 }}
                                                    disabled={acceptSubmitting}
                                                    onClick={closeAcceptSchedule}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Worker Apply */}
            {!isOwner && user?.role === 'worker' && (
                <div className="hm-card" style={{ padding: 20 }}>
                    {applied ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="badge badge-blue" style={{ fontSize: 13, padding: '6px 14px' }}>✓ Application Submitted</span>
                        </div>
                    ) : job.jobStatus === 'active' ? (
                        <>
                            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0c4a6e', marginBottom: 12 }}>Apply to This Job</h3>
                            <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                    <label className="hm-label">Proposed Price (LKR)</label>
                                    <input className="hm-input" type="number" placeholder="Your proposed price"
                                        value={applyForm.proposedPrice} onChange={e => setApplyForm({ ...applyForm, proposedPrice: e.target.value })} />
                                </div>
                                <div>
                                    <label className="hm-label">Cover Note</label>
                                    <textarea className="hm-input" rows={3} style={{ resize: 'vertical' }} placeholder="Why you're a good fit..."
                                        value={applyForm.coverNote} onChange={e => setApplyForm({ ...applyForm, coverNote: e.target.value })} />
                                </div>
                                <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>Submit Application</button>
                            </form>
                        </>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: 13 }}>This job is no longer accepting applications.</p>
                    )}

                    {job?.customer?.user?.userId && (
                        <button
                            className="btn-secondary"
                            style={{ marginTop: 16, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={handleMessageCustomer}
                            disabled={messageLoading}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                                chat
                            </span>
                            {messageLoading ? 'Opening chat...' : `Message ${getCustomerDisplay()}`}
                        </button>
                    )}
                </div>
            )}

            {/* Post-Job Feedback */}
            {(isOwner || isAcceptedWorker) && (
                <div className="hm-card" style={{ padding: 20, marginTop: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0c4a6e', marginBottom: 12 }}>Feedback for This Job</h3>
                    {pendingReview ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr', gap: 20, alignItems: 'flex-start' }}>
                            <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                                    {pendingReview.reviewerType === 'customer'
                                        ? 'Rate the worker who completed this job'
                                        : 'Rate the customer for this job'}
                                </div>
                                <StarRating value={reviewRating} onChange={setReviewRating} size={24} />
                                <textarea
                                    className="hm-input"
                                    rows={3}
                                    style={{ resize: 'vertical', marginTop: 8 }}
                                    placeholder="Share a few words about your experience (optional)"
                                    value={reviewText}
                                    onChange={e => setReviewText(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    style={{ alignSelf: 'flex-start', marginTop: 4 }}
                                    disabled={reviewSubmitting}
                                >
                                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                                </button>
                            </form>

                            <form onSubmit={handleSubmitComplaint} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Have an issue with this job?</div>
                                <div>
                                    <label className="hm-label">Category</label>
                                    <select
                                        className="hm-input"
                                        value={complaintForm.complaintCategory}
                                        onChange={e => setComplaintForm({ ...complaintForm, complaintCategory: e.target.value })}
                                    >
                                        <option value="service_quality">Service quality</option>
                                        <option value="inappropriate_behavior">Inappropriate behavior</option>
                                        <option value="fraud">Fraud</option>
                                        <option value="payment_issue">Payment issue</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="hm-label">Title</label>
                                    <input
                                        className="hm-input"
                                        value={complaintForm.complaintTitle}
                                        onChange={e => setComplaintForm({ ...complaintForm, complaintTitle: e.target.value })}
                                        placeholder="Short summary of the problem"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="hm-label">Details</label>
                                    <textarea
                                        className="hm-input"
                                        rows={3}
                                        style={{ resize: 'vertical' }}
                                        value={complaintForm.complaintDescription}
                                        onChange={e => setComplaintForm({ ...complaintForm, complaintDescription: e.target.value })}
                                        placeholder="Describe what happened so we can help"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn-secondary"
                                    style={{ alignSelf: 'flex-start', marginTop: 4 }}
                                    disabled={complaintSubmitting}
                                >
                                    {complaintSubmitting ? 'Submitting...' : 'Submit Complaint'}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <p style={{ fontSize: 13, color: '#94a3b8' }}>
                            Once this job's booking is completed, you'll be able to leave a review and optionally submit a complaint directly from here.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
