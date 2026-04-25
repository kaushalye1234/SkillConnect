export const BOOKING_SURFACE_CLASS = {
    card: 'booking-card',
    cardHover: 'booking-card booking-card--hover',
    cardPadded: 'booking-card booking-card--padded',
    cardHoverPadded: 'booking-card booking-card--hover booking-card--padded',
    emptyState: 'booking-card booking-empty-state',
};

export const BOOKING_LAYOUT_CLASS = {
    page: 'max-w-7xl mx-auto px-4 py-12 md:py-16 animate-fade-in',
    pageHeader: 'flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6',
    title: 'text-4xl font-extrabold text-slate-900 flex items-center gap-3',
    subtitle: 'text-slate-500 mt-2 text-lg',
    serviceTabs: 'flex gap-3 border-b border-slate-200 mb-8 overflow-x-auto pb-2',
    cardGrid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8',
    loadingState: 'flex justify-center items-center h-48 text-cyan-600 font-medium text-lg',
    emptyStatePadding: 'p-16',
    bookingsStateInline: 'booking-bookings-state-inline',
    bookingsStateMessage: 'booking-bookings-state-message',
    bookingsLoadingState: 'booking-bookings-loading',
    bookingsEmptyIcon: 'booking-bookings-empty-icon',
    bookingsMetricRow: 'booking-bookings-metric-row',
    bookingsMetricIcon: 'booking-bookings-metric-icon',
    bookingsNote: 'booking-bookings-note',
};

export const BOOKING_LIST_CLASS = {
    cardWrapper: 'booking-card-wrapper group',
    cardHeading: 'booking-card-heading',
    bookingId: 'booking-id-label',
    bookingTitle: 'booking-title-text',
    
    participantBox: 'booking-participant-box',
    avatarPlaceholder: 'booking-avatar-placeholder',
    avatarImg: 'booking-avatar-img',
    participantInfo: 'booking-participant-info',
    participantName: 'booking-participant-name',
    participantMeta: 'booking-participant-meta',
    ratingBadge: 'booking-rating-badge',
    ratingStars: 'booking-rating-stars',
    ratingStarFilled: 'text-amber-400',
    ratingStarEmpty: 'text-slate-200',
    ratingValue: 'booking-rating-value',
    noRating: 'booking-no-rating',

    infoGrid: 'booking-info-grid',
    infoBox: 'booking-info-box',
    infoLabel: 'booking-info-label',
    infoValue: 'booking-info-value',
    infoSubtext: 'booking-info-subtext',
    infoSubhighlight: 'booking-info-subhighlight',

    descBox: 'booking-desc-box',
    descLabel: 'booking-desc-label',
    descText: 'booking-desc-text',

    actionsBlock: 'space-y-3',
    cardBody: 'booking-list-card-body',
    cardActions: 'booking-list-card-actions',
    actionGrid: 'booking-list-action-grid',
};

export const BOOKING_MODAL_CLASS = {
    overlay: 'booking-modal-overlay',
    panel: 'booking-modal-panel',
    title: 'booking-modal-title',
    section: 'booking-modal-section',
    availability: 'booking-modal-availability',
    availabilityHeader: 'booking-modal-availability-header',
    legend: 'booking-modal-legend',
    legendPill: 'booking-modal-legend-pill',
    dayDetails: 'booking-modal-day-details',
    daySummary: 'booking-modal-day-summary',
    daySlots: 'booking-modal-day-slots',
    slotButton: 'booking-modal-slot-button',
    timeGroup: 'booking-modal-time-group',
    timeSeparator: 'booking-modal-time-separator',
    periodInput: 'booking-modal-period-input',
    actions: 'booking-modal-actions',
    closeButton: 'booking-modal-close-button',
};

export const BOOKING_DETAIL_CLASS = {
    backLink: 'booking-detail-back-link',
    sectionHeader: 'booking-detail-section-header',
    heroHeader: 'booking-detail-section-header booking-detail-section-header--hero',
    title: 'booking-detail-title',
    statusWrap: 'booking-detail-status-wrap',
    fieldGrid: 'booking-detail-field-grid',
    fieldCard: 'booking-muted-block booking-detail-field-card',
    fieldCardParty: 'booking-muted-block booking-detail-field-card booking-detail-field-card--party',
    fieldCardSchedule: 'booking-muted-block booking-detail-field-card booking-detail-field-card--schedule',
    fieldLabel: 'booking-detail-field-label',
    fieldValue: 'booking-detail-field-value',
    fieldSubvalue: 'booking-detail-field-subvalue',
    highlightField: 'booking-detail-highlight',
    summaryPanel: 'booking-detail-panel booking-detail-panel--summary',
    actionsPanel: 'booking-detail-panel booking-detail-panel--actions',
    actionList: 'booking-detail-actions',
    actionsGrid: 'booking-detail-actions booking-detail-actions-grid',
    actionsHeading: 'booking-detail-actions-heading',
    actionNote: 'booking-detail-action-note',
    reasonNote: 'booking-detail-action-note booking-detail-action-note--reason',
    reasonLabel: 'booking-label booking-detail-reason-label',
    reasonInput: 'booking-detail-reason-input',
    timelineTrack: 'booking-detail-timeline-track',
    timelineHeading: 'booking-detail-timeline-heading',
    timelineHeadingIcon: 'booking-detail-timeline-heading-icon',
    timelinePanel: 'booking-detail-panel booking-detail-panel--timeline',
    timelineEntry: 'booking-detail-timeline-entry',
    sidebarCard: 'booking-detail-sidebar-card',
    timelineDot: 'booking-detail-timeline-dot',
    timelineDate: 'booking-detail-timeline-date',
    infoBlock: 'booking-detail-info-block',
    infoLabel: 'booking-detail-info-label',
    infoValue: 'booking-detail-info-value',
    arrivalCardCustomer: 'booking-detail-arrival-customer',
    arrivalCardWorker: 'booking-detail-arrival-worker',
    nextActionCard: 'booking-detail-next-card',
};

const BOOKING_BUTTON_VARIANTS = {
    primary: 'booking-btn--primary',
    neutral: 'booking-btn--neutral',
    success: 'booking-btn--success',
    danger: 'booking-btn--danger',
    info: 'booking-btn--info',
    warning: 'booking-btn--warning',
    progress: 'booking-btn--progress',
};

export function cx(...classes) {
    return classes.filter(Boolean).join(' ');
}

export function bookingButtonClass(variant = 'neutral', className = '') {
    return cx('booking-btn', BOOKING_BUTTON_VARIANTS[variant] || BOOKING_BUTTON_VARIANTS.neutral, className);
}

export function bookingPillTabClass(isActive, className = '') {
    return cx('booking-tab-button', isActive && 'booking-tab-button--active', className);
}

export function bookingUnderlineTabClass(isActive, className = '') {
    return cx('booking-tab-underline', isActive && 'booking-tab-underline--active', className);
}

export function bookingStateClass(type = 'error', className = '') {
    return cx(
        'booking-state',
        type === 'error' && 'booking-state--error',
        type === 'neutral' && 'booking-state--neutral',
        className
    );
}

export function bookingInputClass(className = '') {
    return cx('booking-input', className);
}

export function bookingTimelineBlockClass(className = '') {
    return cx('booking-timeline-block', className);
}

const BOOKING_DETAIL_FIELD_VARIANTS = {
    party: BOOKING_DETAIL_CLASS.fieldCardParty,
    schedule: BOOKING_DETAIL_CLASS.fieldCardSchedule,
};

export function bookingDetailFieldCardClass(variant = 'default', className = '') {
    return cx(BOOKING_DETAIL_FIELD_VARIANTS[variant] || BOOKING_DETAIL_CLASS.fieldCard, className);
}

const BOOKING_DETAIL_PANEL_VARIANTS = {
    summary: BOOKING_DETAIL_CLASS.summaryPanel,
    actions: BOOKING_DETAIL_CLASS.actionsPanel,
    timeline: BOOKING_DETAIL_CLASS.timelinePanel,
};

export function bookingDetailPanelClass(variant = 'summary', className = '') {
    return cx(BOOKING_SURFACE_CLASS.card, BOOKING_DETAIL_PANEL_VARIANTS[variant] || BOOKING_DETAIL_PANEL_VARIANTS.summary, className);
}

export function bookingLegendPillClass(type = 'free', className = '') {
    return cx(
        BOOKING_MODAL_CLASS.legendPill,
        type === 'free' && 'booking-modal-legend-pill--free',
        type === 'busy' && 'booking-modal-legend-pill--busy',
        className
    );
}

export function bookingAvailabilityPillClass(isAvailable, className = '') {
    return cx(
        'booking-modal-availability-pill',
        isAvailable ? 'booking-modal-availability-pill--free' : 'booking-modal-availability-pill--busy',
        className
    );
}

export function bookingSlotButtonClass(isAvailable, className = '') {
    return cx(
        BOOKING_MODAL_CLASS.slotButton,
        isAvailable ? 'booking-modal-slot-button--available' : 'booking-modal-slot-button--busy',
        className
    );
}

export function bookingSubmitButtonClass(isDisabled, className = '') {
    return bookingButtonClass(isDisabled ? 'neutral' : 'primary', cx('w-full py-3 px-4 font-bold', className));
}

export function bookingStatusBadgeClass(statusMeta, className = '') {
    return cx('px-3 py-1 rounded-full text-xs font-bold', statusMeta?.bg, statusMeta?.color, className);
}
