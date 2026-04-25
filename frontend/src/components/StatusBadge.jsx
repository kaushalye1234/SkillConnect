const STATUS_MAP = {
  requested: 'badge-orange',
  pending: 'badge-yellow',
  open: 'badge-yellow',
  active: 'badge-yellow',
  draft: 'badge-gray',
  assigned: 'badge-blue',
  accepted: 'badge-blue',
  investigating: 'badge-blue',
  in_progress: 'badge-purple',
  completed: 'badge-green',
  resolved: 'badge-green',
  cancelled: 'badge-red',
  rejected: 'badge-red',
  closed: 'badge-red',
  expired: 'badge-red',
  rented: 'badge-purple',
};

export default function StatusBadge({ status }) {
  const normalized = status ? String(status).toLowerCase().trim() : '';
  const badgeClass = STATUS_MAP[normalized] || 'badge-gray';
  const displayText = status
    ? String(status).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  return (
    <span className={`badge ${badgeClass}`}>
      {displayText}
    </span>
  );
}
