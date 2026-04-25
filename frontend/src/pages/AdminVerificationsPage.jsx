import { useEffect, useState } from 'react';
import { FILE_BASE_URL, verificationAPI } from '../api';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function AdminVerificationsPage() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');

  const load = async () => {
    setLoading(true);
    try {
      const res = await verificationAPI.adminList();
      setVerifications(res.data?.data || []);
    } catch {
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdateStatus = async (workerId, status) => {
    let rejectionReason = undefined;
    if (status === 'REJECTED') {
      const reason = window.prompt('Enter rejection reason for this worker:');
      if (!reason || !reason.trim()) {
        return;
      }
      rejectionReason = reason.trim();
    }
    try {
      await verificationAPI.adminUpdate(workerId, { status, rejectionReason });
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update verification status.');
    }
  };

  const filtered = statusFilter
    ? verifications.filter(v => v.status === statusFilter)
    : verifications;

  const pendingCount = verifications.filter(v => v.status === 'SUBMITTED' || v.status === 'PROCESSING').length;

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">✅ Identity Verifications</h1>
          <p className="page-subtitle">Review and approve worker NIC / driver license documents</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
        <div className="stat-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0c4a6e' }}>{pendingCount}</div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Pending Reviews</div>
        </div>
        <div className="stat-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0c4a6e' }}>{verifications.length}</div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total Submissions</div>
        </div>
        <div className="stat-card" style={{ padding: '30px 20px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 10 }}>
          <label
            className="hm-label"
            style={{ marginBottom: 6, fontSize: 12, lineHeight: 1.2 }}
          >
            Filter by status
          </label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="hm-input"
            style={{ height: 38, fontSize: 12 }}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: '#0891b2' }}>
          <span className="spinner" /> Loading verifications...
        </div>
      ) : filtered.length === 0 ? (
        <div className="hm-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🪪</div>
          <p style={{ fontSize: 14, color: '#64748b' }}>No verification records found for the selected filter.</p>
        </div>
      ) : (
        <div className="hm-card" style={{ padding: 20 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  {['Worker', 'Document', 'Images', 'Status', 'Submitted', 'Reviewed', 'Reason', 'Actions'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 12px',
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
                {filtered.map(v => {
                  const submitted = v.submittedAt ? new Date(v.submittedAt).toLocaleString() : '-';
                  const reviewed = v.reviewedAt ? new Date(v.reviewedAt).toLocaleString() : '-';
                  return (
                    <tr key={v.id} style={{ borderTop: '1px solid #e2e8f0', background: '#fff' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{v.workerName || 'Unknown worker'}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{v.workerEmail || 'No email'}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>Worker ID: {v.workerId}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{(v.documentType || '').replace('_', ' ').toLowerCase()}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {v.frontImageUrl && (
                            <a
                              href={FILE_BASE_URL + v.frontImageUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="View front image"
                            >
                              <img
                                src={FILE_BASE_URL + v.frontImageUrl}
                                alt="Front document"
                                style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                              />
                            </a>
                          )}
                          {v.backImageUrl && (
                            <a
                              href={FILE_BASE_URL + v.backImageUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="View back image"
                            >
                              <img
                                src={FILE_BASE_URL + v.backImageUrl}
                                alt="Back document"
                                style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                              />
                            </a>
                          )}
                          {!v.frontImageUrl && !v.backImageUrl && (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>No images</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: 11,
                            background:
                              v.status === 'APPROVED' ? '#ecfdf3' :
                              v.status === 'REJECTED' ? '#fef2f2' :
                              v.status === 'PROCESSING' ? '#eff6ff' : '#fefce8',
                            color:
                              v.status === 'APPROVED' ? '#15803d' :
                              v.status === 'REJECTED' ? '#b91c1c' :
                              v.status === 'PROCESSING' ? '#1d4ed8' : '#92400e',
                            textTransform: 'capitalize',
                          }}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#475569' }}>{submitted}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#475569' }}>{reviewed}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#991b1b' }}>
                        {v.rejectionReason || '-'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {v.status === 'APPROVED' ? (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>Approved</span>
                        ) : v.status === 'REJECTED' ? (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>Rejected</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {v.status !== 'PROCESSING' && (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={() => handleUpdateStatus(v.workerId, 'PROCESSING')}
                              >
                                Mark Processing
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={() => handleUpdateStatus(v.workerId, 'APPROVED')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn-danger"
                              style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={() => handleUpdateStatus(v.workerId, 'REJECTED')}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
