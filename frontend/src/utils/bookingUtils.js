export const SERVICE_BOOKING_TABS = ['Pending', 'Upcoming', 'Completed', 'Cancelled'];

export const SERVICE_STATUS_STYLE = {
    requested: { bg: 'bg-orange-100', color: 'text-orange-800', label: '⏳ Requested' },
    accepted: { bg: 'bg-blue-100', color: 'text-blue-800', label: '✓ Accepted' },
    in_progress: { bg: 'bg-purple-100', color: 'text-purple-800', label: '🔨 In Progress' },
    completed: { bg: 'bg-green-100', color: 'text-green-800', label: '✅ Completed' },
    cancelled: { bg: 'bg-red-100', color: 'text-red-800', label: '❌ Cancelled' },
    rejected: { bg: 'bg-rose-100', color: 'text-rose-800', label: '🚫 Rejected' },
};

export const EQUIPMENT_STATUS_STYLE = {
    reserved: { bg: 'bg-yellow-100', color: 'text-yellow-800', label: 'Reserved' },
    rented_out: { bg: 'bg-blue-100', color: 'text-blue-800', label: 'Rented Out' },
    returned: { bg: 'bg-green-100', color: 'text-green-800', label: 'Returned' },
    cancelled: { bg: 'bg-red-100', color: 'text-red-800', label: 'Cancelled' },
    damaged: { bg: 'bg-red-100', color: 'text-red-800', label: 'Damaged' },
};

export const BOOKING_STATUS_TRANSITIONS = {
    requested: ['accepted', 'rejected', 'cancelled'],
    accepted: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    rejected: [],
};

export const WORKER_PENDING_STATES = ['requested'];
export const CUSTOMER_CANCEL_STATES = ['requested', 'accepted'];

export const BOOKING_TIMELINE_COLORS = {
    requested: '#904d00',
    accepted: '#00658f',
    in_progress: '#8b5cf6',
    completed: '#10b981',
    cancelled: '#ba1a1a',
    rejected: '#ba1a1a',
};

export const DEFAULT_BOOKING_FORM = {
    jobId: '',
    scheduledDate: '',
    scheduledHour: '09',
    scheduledMinute: '00',
    scheduledPeriod: 'AM',
    notes: '',
};

export function formatBookingStatusLabel(status) {
    return String(status || '')
        .replace(/_/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getServiceStatusMeta(status) {
    return SERVICE_STATUS_STYLE[status] || { bg: 'bg-slate-100', color: 'text-slate-800', label: status };
}

export function getEquipmentStatusMeta(status) {
    return EQUIPMENT_STATUS_STYLE[status] || { bg: 'bg-slate-100', color: 'text-slate-700', label: status || 'Unknown' };
}

export function matchesServiceTab(status, tab) {
    if (tab === 'Pending') return status === 'requested';
    if (tab === 'Upcoming') return ['accepted', 'in_progress'].includes(status);
    if (tab === 'Completed') return status === 'completed';
    if (tab === 'Cancelled') return ['cancelled', 'rejected'].includes(status);
    return true;
}

export function toDateKey(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [hour, minute] = String(timeStr).split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return hour * 60 + minute;
}

export function to24Hour(hour12, period) {
    let hour = parseInt(hour12, 10);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour;
}

export function to12HourTimeParts(minutes) {
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return {
        scheduledHour: String(hour12).padStart(2, '0'),
        scheduledMinute: String(minute).padStart(2, '0'),
        scheduledPeriod: period,
    };
}

export function slotLabelFromMinutes(minutes) {
    const { scheduledHour, scheduledMinute, scheduledPeriod } = to12HourTimeParts(minutes);
    return `${scheduledHour}:${scheduledMinute} ${scheduledPeriod}`;
}

export function buildScheduledTime(hour12, minute, period) {
    const hour24 = to24Hour(hour12, period);
    return `${String(hour24).padStart(2, '0')}:${minute}`;
}
