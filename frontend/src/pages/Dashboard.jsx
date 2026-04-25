import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { workerAPI, jobAPI, bookingAPI, equipmentAPI } from '../api';

const CATEGORIES = [
    { icon: '⚡', label: 'Electrical', color: '#fef3c7', text: '#92400e', skillCategory: 'Electrician' },
    { icon: '🔩', label: 'Plumbing', color: '#dbeafe', text: '#1e40af', skillCategory: 'Plumber' },
    { icon: '🏗️', label: 'Construction', color: '#f3e8ff', text: '#5b21b6', skillCategory: 'Mason' },
    { icon: '🎨', label: 'Painting', color: '#fce7f3', text: '#9d174d', skillCategory: 'Painter' },
    { icon: '🪵', label: 'Carpentry', color: '#ffedd5', text: '#9a3412', skillCategory: 'Carpenter' },
    { icon: '🌿', label: 'Landscaping', color: '#d1fae5', text: '#065f46', skillCategory: 'Gardener' },
    { icon: '❄️', label: 'HVAC', color: '#e0f2fe', text: '#0369a1', skillCategory: 'Technician' },
    { icon: '🧹', label: 'Cleaning', color: '#f1f5f9', text: '#475569', skillCategory: 'Cleaner' },
];

const ROUTE_MAP = {
    workers: '/workers', jobs: '/jobs', bookings: '/bookings',
    equipment: '/equipment', reviews: '/reviews', messages: '/messages',
    'worker-schedule': '/worker/schedule',
    'admin-users': '/admin/users',
};

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const go = (key) => navigate(ROUTE_MAP[key] || `/${key}`);
    const [stats, setStats] = useState([]);
    const [myWorkerId, setMyWorkerId] = useState(null);
    const [availabilityRows, setAvailabilityRows] = useState([]);
    const [busySlotRows, setBusySlotRows] = useState([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [savingDay, setSavingDay] = useState('');
    const [dayDraft, setDayDraft] = useState({});

    const toDateKey = (dateObj) => {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseTimeToMinutes = (timeStr) => {
        const [h, m] = String(timeStr || '').split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return h * 60 + m;
    };

    const toHHMM = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const toDisplayTime = (minutes) => {
        const h24 = Math.floor(minutes / 60);
        const m = minutes % 60;
        const period = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    };

    const getAvailabilityWindows = (dateKey) => {
        return availabilityRows
            .filter((row) => row.availableDate === dateKey)
            .map((row) => ({
                start: parseTimeToMinutes(row.startTime),
                end: parseTimeToMinutes(row.endTime),
                isAvailable: row.isAvailable !== false,
            }))
            .filter((w) => w.start !== null && w.end !== null && w.end > w.start);
    };

    const busySlotSet = useMemo(() => new Set(
        (busySlotRows || []).map((row) => {
            const hhmm = String(row.scheduledTime || '').slice(0, 5);
            return `${row.scheduledDate}|${hhmm}`;
        })
    ), [busySlotRows]);

    const isFreeSlot = (dateKey, minutes) => {
        const windows = getAvailabilityWindows(dateKey);
        if (windows.length === 0) return false;
        return windows.some((w) => w.isAvailable && minutes >= w.start && minutes < w.end);
    };

    const next7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            key: toDateKey(d),
            label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        };
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const results = await Promise.allSettled([
                    workerAPI.getAll(),
                    jobAPI.getAll({}),
                    bookingAPI.getMine(user?.role === 'worker' ? 'worker' : 'customer'),
                    equipmentAPI.getAvailable(),
                ]);
                const get = (i) => results[i]?.status === 'fulfilled' ? (results[i].value?.data?.data?.length ?? 0) : 0;
                setStats([
                    { label: 'Workers', value: get(0), icon: '👷', color: '#e0f2fe', text: '#0e7490' },
                    { label: 'Active Jobs', value: get(1), icon: '📋', color: '#ffedd5', text: '#9a3412' },
                    { label: 'My Bookings', value: get(2), icon: '📅', color: '#d1fae5', text: '#065f46' },
                    { label: 'Equipment', value: get(3), icon: '🔧', color: '#ede9fe', text: '#5b21b6' },
                ]);

                if (user?.role === 'worker') {
                    setAvailabilityLoading(true);
                    const meRes = await workerAPI.getMe();
                    const workerId = meRes?.data?.data?.workerId;
                    setMyWorkerId(workerId);
                    if (workerId) {
                        const [aRes, busyRes] = await Promise.allSettled([
                            workerAPI.getAvailability(workerId),
                            bookingAPI.getBusySlots(workerId),
                        ]);
                        if (aRes.status === 'fulfilled') setAvailabilityRows(aRes.value?.data?.data || []);
                        if (busyRes.status === 'fulfilled') setBusySlotRows(busyRes.value?.data?.data || []);
                    }
                }
            } catch { /* stats are non-critical */ }
            finally {
                setAvailabilityLoading(false);
            }
        };
        fetchStats();
    }, [user?.role]);

    const toggleSlot = (dateKey, minutes, checked) => {
        setDayDraft((prev) => {
            const current = prev[dateKey] || {};
            return {
                ...prev,
                [dateKey]: {
                    ...current,
                    [minutes]: checked,
                },
            };
        });
    };

    const getDraftValue = (dateKey, minutes) => {
        if (dayDraft[dateKey] && Object.prototype.hasOwnProperty.call(dayDraft[dateKey], minutes)) {
            return dayDraft[dateKey][minutes];
        }
        return isFreeSlot(dateKey, minutes);
    };

    const saveDaySlots = async (dateKey) => {
        try {
            setSavingDay(dateKey);
            const slots = [];
            for (let hour = 8; hour <= 19; hour += 1) {
                const start = hour * 60;
                const end = (hour + 1) * 60;
                const key = `${dateKey}|${toHHMM(start)}`;
                if (busySlotSet.has(key)) {
                    continue;
                }
                slots.push({
                    startTime: toHHMM(start),
                    endTime: toHHMM(end),
                    isAvailable: getDraftValue(dateKey, start),
                });
            }

            await workerAPI.upsertMyAvailabilityBulk({ date: dateKey, slots });

            if (myWorkerId) {
                const [aRes, busyRes] = await Promise.allSettled([
                    workerAPI.getAvailability(myWorkerId),
                    bookingAPI.getBusySlots(myWorkerId),
                ]);
                if (aRes.status === 'fulfilled') setAvailabilityRows(aRes.value?.data?.data || []);
                if (busyRes.status === 'fulfilled') setBusySlotRows(busyRes.value?.data?.data || []);
            }

            setDayDraft((prev) => {
                const copy = { ...prev };
                delete copy[dateKey];
                return copy;
            });
        } catch {
            alert('Failed to save availability slots.');
        } finally {
            setSavingDay('');
        }
    };

    const name = user?.email?.split('@')[0] || 'there';

    return (
        <div className="fade-in">
            {/* ── Hero ── */}
            <div style={{
                background: 'linear-gradient(135deg,#111827 0%,#020617 45%,#111827 100%)',
                borderRadius: 24, padding: '40px 36px', marginBottom: 28,
                color: '#f9fafb', position: 'relative', overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(0,0,0,0.7)'
            }}>
                {/* Decorative shapes */}
                <div style={{ position: 'absolute', right: -40, top: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, rgba(249,115,22,0.4), transparent 60%)' }} />
                <div style={{ position: 'absolute', right: 40, bottom: -80, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%, rgba(249,115,22,0.18), transparent 65%)' }} />

                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.8, marginBottom: 6, color: '#fed7aa' }}>
                    Welcome back
                </p>
                <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.5px' }}>
                    Hello, {name} 👋
                </h1>
                <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 28, textTransform: 'capitalize', color: '#e5e7eb' }}>
                    Logged in as: <strong style={{ opacity: 1 }}>{user?.role}</strong>
                </p>

                {/* (Search bar removed as requested) */}
            </div>

            {/* ── Stats Row ── */}
            {stats.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 28 }}>
                    {stats.map(s => (
                        <div key={s.label} className="hm-card" style={{ padding: '18px 20px' }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: 12,
                                background: s.color, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: 20, marginBottom: 10
                            }}>{s.icon}</div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: '#0c4a6e' }}>{s.value}</div>
                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Categories ── */}
            <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0c4a6e', marginBottom: 4 }}>Browse by Category</h2>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Find the right professional for your needs</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 12 }}>
                    {CATEGORIES.map(c => (
                        <button
                            key={c.label}
                            className="cat-card"
                            onClick={() => navigate(`/workers?category=${encodeURIComponent(c.skillCategory)}`)}
                        >
                            <div className="cat-icon" style={{ background: c.color }}>
                                {c.icon}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{c.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Quick Access ── */}
            <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0c4a6e', marginBottom: 16 }}>Quick Access</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
                    {[
                        { key: 'workers', icon: '👷', label: 'Find Workers', desc: 'Browse skilled professionals', color: '#e0f2fe' },
                        { key: 'jobs', icon: '📋', label: 'Post a Job', desc: 'Create job listings', color: '#ffedd5' },
                        { key: 'bookings', icon: '📅', label: 'My Bookings', desc: 'Track your bookings', color: '#d1fae5' },
                        { key: 'equipment', icon: '🔧', label: 'Rent Equipment', desc: 'Browse tools & equipment', color: '#ede9fe' },
                        { key: 'reviews', icon: '⭐', label: 'Reviews', desc: 'Rate workers & complaints', color: '#fef3c7' },
                        { key: 'messages', icon: '💬', label: 'Messages', desc: 'Chat with users', color: '#e0f2fe' },
                        ...(user?.role === 'worker'
                            ? [{ key: 'worker-schedule', icon: '🗓️', label: 'My Schedule', desc: 'Manage monthly time slots', color: '#e0f2fe' }]
                            : []),
                        ...(user?.role === 'admin' ? [{ key: 'admin-users', icon: '🛡', label: 'Manage Users', desc: 'View, suspend & activate users', color: '#fee2e2' }] : []),
                    ].map(m => (
                        <button key={m.key} onClick={() => go(m.key)}
                            className="hm-card"
                            style={{ border: 'none', cursor: 'pointer', padding: '20px', textAlign: 'left', width: '100%' }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12, background: m.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 22, marginBottom: 12
                            }}>{m.icon}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#0c4a6e', marginBottom: 3 }}>{m.label}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{m.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            {user?.role === 'worker' && (
                <div style={{ marginTop: 30 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0c4a6e', marginBottom: 6 }}>My Time Slots (7 Days)</h2>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                        Tick to mark a slot free. Untick to mark unavailable. Booked slots are locked.
                    </p>

                    {availabilityLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 }}>
                            <span className="spinner" /> Loading schedule...
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {next7Days.map((day) => (
                                <details key={day.key} className="hm-card" style={{ padding: 0 }}>
                                    <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 800, color: '#0c4a6e', fontSize: 14 }}>{day.label}</span>
                                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Click to manage slots</span>
                                    </summary>

                                    <div style={{ padding: '0 14px 14px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8, marginBottom: 10 }}>
                                            {Array.from({ length: 12 }, (_, idx) => {
                                                const minutes = (8 + idx) * 60;
                                                const slotKey = `${day.key}|${toHHMM(minutes)}`;
                                                const isBooked = busySlotSet.has(slotKey);
                                                const checked = getDraftValue(day.key, minutes);

                                                return (
                                                    <label key={slotKey} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        padding: '8px 10px',
                                                        borderRadius: 10,
                                                        border: '1px solid',
                                                        borderColor: isBooked ? '#fecaca' : checked ? '#86efac' : '#e2e8f0',
                                                        background: isBooked ? '#fee2e2' : checked ? '#dcfce7' : '#f8fafc',
                                                        color: isBooked ? '#991b1b' : checked ? '#166534' : '#475569',
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            disabled={isBooked}
                                                            onChange={(e) => toggleSlot(day.key, minutes, e.target.checked)}
                                                        />
                                                        <span>{toDisplayTime(minutes)}</span>
                                                        {isBooked && <span style={{ marginLeft: 'auto', fontSize: 10 }}>Booked</span>}
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        <button
                                            className="btn-primary"
                                            onClick={() => saveDaySlots(day.key)}
                                            disabled={savingDay === day.key}
                                            style={{ padding: '8px 14px', fontSize: 12 }}
                                        >
                                            {savingDay === day.key ? 'Saving...' : `Save ${day.label}`}
                                        </button>
                                    </div>
                                </details>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
