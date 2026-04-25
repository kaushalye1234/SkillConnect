import { useState, useEffect } from 'react';
import { workerAPI, reviewAPI, complaintAPI } from '../api';

const STATUS_COLORS = {
  true: 'bg-green-50 text-green-600',
  false: 'bg-red-50 text-red-600',
  pending: 'bg-yellow-50 text-yellow-600',
  investigating: 'bg-blue-50 text-blue-600',
  resolved: 'bg-green-50 text-green-600',
  rejected: 'bg-red-50 text-red-600',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('users');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, complaintsRes, reviewsRes] = await Promise.allSettled([
        workerAPI.getAllUsers(),
        complaintAPI.getAll(),
        reviewAPI.getAll(),
      ]);
      setUsers(usersRes.status === 'fulfilled' ? usersRes.value?.data?.data || [] : []);
      setComplaints(complaintsRes.status === 'fulfilled' ? complaintsRes.value?.data?.data || [] : []);
      setReviews(reviewsRes.status === 'fulfilled' ? reviewsRes.value?.data?.data || [] : []);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = async (userId) => {
    try {
      await workerAPI.toggleUser(userId);
      loadData();
    } catch {
      // ignore
    }
  };

  const handleComplaintStatus = async (id, status) => {
    try {
      await complaintAPI.updateStatus(id, status);
      loadData();
    } catch {
      // ignore
    }
  };

  const filteredUsers = roleFilter ? users.filter((u) => u.role === roleFilter) : users;
  const totalCustomers = users.filter((u) => u.role === 'customer').length;
  const totalWorkers = users.filter((u) => u.role === 'worker').length;
  const openComplaints = complaints.filter((c) => c.complaintStatus === 'pending').length;

  const TABS = [
    { key: 'users', label: 'Users', icon: 'group' },
    { key: 'complaints', label: 'Complaints', icon: 'report' },
    { key: 'reviews', label: 'Reviews', icon: 'star' },
  ];

  const stats = [
    { label: 'Total Users', value: users.length, icon: '👥', color: '#e0f2fe' },
    { label: 'Customers', value: totalCustomers, icon: '🧑‍💼', color: '#dbeafe' },
    { label: 'Workers', value: totalWorkers, icon: '👷', color: '#ffedd5' },
    { label: 'Open Complaints', value: openComplaints, icon: '⚠️', color: '#fee2e2' },
  ];

  const renderUsersTable = () => (
    <div className="hm-card" style={{ padding: 20, marginTop: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 12,
      }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            All Users ({filteredUsers.length})
          </h3>
          <p style={{ fontSize: 12, color: '#64748b' }}>Enable, disable or review any account on the platform.</p>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="hm-input"
          style={{
            height: 34,
            padding: '4px 10px',
            borderRadius: 999,
            border: '1px solid #e2e8f0',
            fontSize: 12,
            color: '#0f172a',
            background: '#fff',
          }}
        >
          <option value="">All Roles</option>
          <option value="customer">Customer</option>
          <option value="worker">Worker</option>
          <option value="supplier">Supplier</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f0f9ff', textAlign: 'left' }}>
              {['User', 'Role', 'Status', 'Actions'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => {
              const initials = (u.email || '').split('@')[0].slice(0, 2).toUpperCase();
              const active = u.isActive !== false;
              return (
                <tr
                  key={u.userId || u.id}
                  style={{ borderTop: '1px solid #e2e8f0', background: '#fff' }}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '999px',
                          background: 'linear-gradient(135deg,#0891b2,#06b6d4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: 11,
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{u.email}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>ID: {u.userId || u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      className="badge badge-blue"
                      style={{
                        textTransform: 'capitalize',
                        fontSize: 11,
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      className={`badge ${active ? 'badge-green' : 'badge-red'}`}
                      style={{ fontSize: 11 }}
                    >
                      {active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleUser(u.userId || u.id)}
                      className={active ? 'btn-danger' : 'btn-primary'}
                      style={{
                        fontSize: 11,
                        padding: '6px 14px',
                        justifyContent: 'center',
                        minWidth: 88,
                      }}
                    >
                      {active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderComplaintsTable = () => (
    <div className="hm-card" style={{ padding: 20, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            All Complaints ({complaints.length})
          </h3>
          <p style={{ fontSize: 12, color: '#64748b' }}>Track and update complaint status across the platform.</p>
        </div>
      </div>

      {complaints.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}>
          <span className="empty-icon">⚖️</span>
          <p>No complaints recorded.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {['Category', 'Description', 'Priority', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      fontWeight: 700,
                      color: '#0f172a',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <tr
                  key={c.complaintId || c.id}
                  style={{ borderTop: '1px solid #e2e8f0', background: '#fff' }}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>
                    {(c.complaintCategory || '').replace(/_/g, ' ') || 'General'}
                  </td>
                  <td
                    style={{ padding: '10px 14px', color: '#475569', maxWidth: 320 }}
                    title={c.complaintDescription || c.description}
                  >
                    {(c.complaintDescription || c.description || '').slice(0, 80)}
                    {(c.complaintDescription || c.description || '').length > 80 ? '…' : ''}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      className="badge"
                      style={{
                        fontSize: 11,
                        background:
                          c.priority === 'urgent' || c.priority === 'high'
                            ? '#fee2e2'
                            : c.priority === 'medium'
                              ? '#fef9c3'
                              : '#e5e7eb',
                        color:
                          c.priority === 'urgent' || c.priority === 'high'
                            ? '#b91c1c'
                            : c.priority === 'medium'
                              ? '#92400e'
                              : '#374151',
                      }}
                    >
                      {c.priority || 'normal'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      className="badge"
                      style={{
                        fontSize: 11,
                        background:
                          c.complaintStatus === 'pending'
                            ? '#fefce8'
                            : c.complaintStatus === 'investigating'
                              ? '#eff6ff'
                              : c.complaintStatus === 'resolved'
                                ? '#ecfdf3'
                                : '#fef2f2',
                        color:
                          c.complaintStatus === 'pending'
                            ? '#92400e'
                            : c.complaintStatus === 'investigating'
                              ? '#1d4ed8'
                              : c.complaintStatus === 'resolved'
                                ? '#15803d'
                                : '#b91c1c',
                        textTransform: 'capitalize',
                      }}
                    >
                      {c.complaintStatus}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <select
                      value={c.complaintStatus}
                      onChange={(e) => handleComplaintStatus(c.complaintId || c.id, e.target.value)}
                      style={{
                        height: 30,
                        padding: '4px 10px',
                        borderRadius: 999,
                        border: '1px solid #e2e8f0',
                        fontSize: 11,
                        color: '#0f172a',
                        background: '#fff',
                      }}
                    >
                      <option value="pending">Pending</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderReviews = () => (
    <div className="hm-card" style={{ padding: 20, marginTop: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
          All Reviews ({reviews.length})
        </h3>
        <p style={{ fontSize: 12, color: '#64748b' }}>Recent feedback left by customers and workers.</p>
      </div>

      {reviews.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}>
          <span className="empty-icon">⭐</span>
          <p>No reviews yet.</p>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid #e2e8f0' }}>
          {reviews.map((r) => (
            <div
              key={r.reviewId || r.id}
              style={{
                padding: '12px 4px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 16,
                          color: i <= (r.overallRating || r.rating) ? '#f59e0b' : '#e2e8f0',
                        }}
                      >
                        star
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {r.overallRating || r.rating}/5
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#475569' }}>
                  {r.reviewText || r.text || 'No comment'}
                </p>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">👮‍♀️ Admin Dashboard</h1>
          <p className="page-subtitle">Monitor and manage platform activity</p>
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="stat-card"
            style={{
              padding: 18,
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: s.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
                fontSize: 18,
              }}
            >
              {s.icon}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0c4a6e' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'inline-flex',
            padding: 4,
            borderRadius: 999,
            background: '#e0f2fe',
            gap: 4,
          }}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#0c4a6e' : '#64748b',
                  boxShadow: active ? '0 2px 6px rgba(15,23,42,0.12)' : 'none',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 200,
            gap: 10,
            color: '#0891b2',
          }}
        >
          <span className="spinner" /> Loading admin data...
        </div>
      ) : (
        <>
          {tab === 'users' && renderUsersTable()}
          {tab === 'complaints' && renderComplaintsTable()}
          {tab === 'reviews' && renderReviews()}
        </>
      )}
    </div>
  );
}
