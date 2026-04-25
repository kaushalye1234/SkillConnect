import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { workerAPI, authAPI, verificationAPI, profileAPI } from '../api';
import DistrictSelect from '../components/DistrictSelect';

export default function ProfilePage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [editForm, setEditForm] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
    const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
    const [verification, setVerification] = useState(null);
    const [verificationLoading, setVerificationLoading] = useState(false);
    const [verificationMsg, setVerificationMsg] = useState({ type: '', text: '' });
    const [docType, setDocType] = useState('NIC');
    const [frontFile, setFrontFile] = useState(null);
    const [backFile, setBackFile] = useState(null);
    const [submittingVerification, setSubmittingVerification] = useState(false);
    const [supplierForm, setSupplierForm] = useState({ businessName: '', contactPersonName: '', city: '', district: '' });
    const [supplierMsg, setSupplierMsg] = useState({ type: '', text: '' });
    const [supplierSaving, setSupplierSaving] = useState(false);

    useEffect(() => {
        if (user?.role === 'worker') {
            workerAPI.getMe()
                .then(res => {
                    const p = res.data.data;
                    setEditForm({
                        firstName: p.firstName || '', lastName: p.lastName || '',
                        bio: p.bio || '', city: p.city || '', district: p.district || '',
                        skillCategory: p.skillCategory || '',
                        hourlyRateMin: p.hourlyRateMin || '', hourlyRateMax: p.hourlyRateMax || '',
                    });
                })
                .catch(() => { })
                .finally(() => setLoading(false));
            loadVerification();
        } else if (user?.role === 'supplier') {
            setLoading(true);
            profileAPI.getMe()
                .then(res => {
                    const p = res.data.data;
                    setSupplierForm({
                        businessName: p.businessName || '',
                        contactPersonName: p.contactPersonName || '',
                        city: p.city || '',
                        district: p.district || '',
                    });
                })
                .catch(() => { })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [user?.role]);

    const loadVerification = async () => {
        if (!user?.role || user.role !== 'worker') return;
        setVerificationLoading(true);
        setVerificationMsg({ type: '', text: '' });
        try {
            const res = await verificationAPI.getMine();
            setVerification(res.data?.data || null);
        } catch {
            // ignore errors; section will show as not submitted
        } finally {
            setVerificationLoading(false);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true); setMsg({ type: '', text: '' });
        try {
            await workerAPI.updateMe({
                ...editForm,
                hourlyRateMin: editForm.hourlyRateMin ? parseFloat(editForm.hourlyRateMin) : null,
                hourlyRateMax: editForm.hourlyRateMax ? parseFloat(editForm.hourlyRateMax) : null,
            });
            setMsg({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
        } finally { setSaving(false); }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwMsg({ type: '', text: '' });
        if (pwForm.newPw !== pwForm.confirm) {
            setPwMsg({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        const strongPwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
        if (!strongPwRegex.test(pwForm.newPw)) {
            setPwMsg({ type: 'error', text: 'Password must be at least 8 characters and include uppercase, lowercase and a symbol.' });
            return;
        }
        try {
            await authAPI.changePassword(pwForm.current, pwForm.newPw);
            setPwMsg({ type: 'success', text: 'Password changed successfully!' });
            setPwForm({ current: '', newPw: '', confirm: '' });
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to change password. Use forgot password if needed.';
            setPwMsg({ type: 'error', text: message });
        }
    };

    const handleDeleteAccount = async () => {
        if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return;
        try {
            await workerAPI.deleteMe();
            logout();
            navigate('/');
        } catch (err) {
            alert('Error: ' + (err.response?.data?.message || 'Failed to delete account.'));
        }
    };

    const handleSubmitVerification = async (e) => {
        e.preventDefault();
        setVerificationMsg({ type: '', text: '' });
        if (!frontFile || !backFile) {
            setVerificationMsg({ type: 'error', text: 'Please upload both front and back images.' });
            return;
        }
        const formData = new FormData();
        formData.append('documentType', docType || 'NIC');
        formData.append('frontImage', frontFile);
        formData.append('backImage', backFile);
        setSubmittingVerification(true);
        try {
            const res = await verificationAPI.submit(formData);
            setVerification(res.data?.data || null);
            setVerificationMsg({ type: 'success', text: 'Documents submitted for review.' });
            setFrontFile(null);
            setBackFile(null);
            // reset file inputs by forcing reload of verification state
            await loadVerification();
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to submit documents. Please check file size and type.';
            setVerificationMsg({ type: 'error', text: message });
        } finally {
            setSubmittingVerification(false);
        }
    };

    const handleSaveSupplierProfile = async (e) => {
        e.preventDefault();
        setSupplierSaving(true);
        setSupplierMsg({ type: '', text: '' });
        try {
            await profileAPI.updateMe({
                businessName: supplierForm.businessName || null,
                contactPersonName: supplierForm.contactPersonName || null,
                city: supplierForm.city || null,
                district: supplierForm.district || null,
            });
            setSupplierMsg({ type: 'success', text: 'Supplier profile updated successfully!' });
        } catch (err) {
            setSupplierMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update supplier profile.' });
        } finally {
            setSupplierSaving(false);
        }
    };

    const emailName = user?.email?.split('@')[0] || 'User';

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">👤 My Profile</h1>
                    <p className="page-subtitle">Manage your account and preferences</p>
                </div>
            </div>

            {/* Account Info */}
            <div className="hm-card" style={{ padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="avatar" style={{ width: 64, height: 64, fontSize: 22 }}>
                        {emailName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0c4a6e', marginBottom: 4 }}>{user?.email}</h2>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span className="badge badge-teal" style={{ textTransform: 'capitalize' }}>{user?.role}</span>
                            <span className="badge badge-gray">User ID: #{user?.userId}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Worker Profile Edit */}
            {user?.role === 'worker' && (
                <>
                    <div className="hm-card" style={{ padding: 24, marginBottom: 20 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0c4a6e', marginBottom: 16 }}>Worker Profile</h3>
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0891b2' }}><span className="spinner" /> Loading...</div>
                        ) : (
                            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label className="hm-label">First Name</label>
                                    <input className="hm-input" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="hm-label">Last Name</label>
                                    <input className="hm-input" value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="hm-label">Bio</label>
                                <textarea className="hm-input" rows={3} style={{ resize: 'vertical' }} value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} />
                            </div>
                            <div>
                                <label className="hm-label">Primary Skill Category</label>
                                <select
                                    className="hm-input"
                                    value={editForm.skillCategory}
                                    onChange={e => setEditForm({ ...editForm, skillCategory: e.target.value })}
                                >
                                    <option value="">Select a category...</option>
                                    <option value="Plumber">Plumber</option>
                                    <option value="Electrician">Electrician</option>
                                    <option value="Carpenter">Carpenter</option>
                                    <option value="Mason">Mason</option>
                                    <option value="Painter">Painter</option>
                                    <option value="Cleaner">Cleaner</option>
                                    <option value="Driver">Driver</option>
                                    <option value="Gardener">Gardener</option>
                                    <option value="Technician">Technician</option>
                                    <option value="Handyman">Handyman</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label className="hm-label">City</label>
                                    <input className="hm-input" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} />
                                </div>
                                <div>
                                    <label className="hm-label">District</label>
                                    <DistrictSelect
                                        value={editForm.district}
                                        onChange={(value) => setEditForm({ ...editForm, district: value })}
                                        required={false}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label className="hm-label">Hourly Rate Min (LKR)</label>
                                    <input className="hm-input" type="number" value={editForm.hourlyRateMin} onChange={e => setEditForm({ ...editForm, hourlyRateMin: e.target.value })} />
                                </div>
                                <div>
                                    <label className="hm-label">Hourly Rate Max (LKR)</label>
                                    <input className="hm-input" type="number" value={editForm.hourlyRateMax} onChange={e => setEditForm({ ...editForm, hourlyRateMax: e.target.value })} />
                                </div>
                            </div>
                            {msg.text && <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>{msg.text}</div>}
                            <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                        )}
                    </div>

                    {/* Identity Verification */}
                    <div className="hm-card" style={{ padding: 24, marginBottom: 20 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0c4a6e', marginBottom: 8 }}>Identity Verification</h3>
                        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                            Upload clear photos of your NIC or driver license (front and back). Your profile must be approved before customers can book you.
                        </p>

                        {verificationLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0891b2', marginBottom: 8 }}>
                                <span className="spinner" /> Checking verification status...
                            </div>
                        ) : (
                            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Current status:</span>
                                <span
                                    className="badge"
                                    style={{
                                        fontSize: 12,
                                        textTransform: 'capitalize',
                                        background:
                                            verification?.status === 'APPROVED' ? '#ecfdf3' :
                                            verification?.status === 'REJECTED' ? '#fef2f2' :
                                            verification?.status === 'PROCESSING' || verification?.status === 'SUBMITTED' ? '#eff6ff' : '#f1f5f9',
                                        color:
                                            verification?.status === 'APPROVED' ? '#15803d' :
                                            verification?.status === 'REJECTED' ? '#b91c1c' :
                                            verification?.status === 'PROCESSING' || verification?.status === 'SUBMITTED' ? '#1d4ed8' : '#475569',
                                    }}
                                >
                                    {verification?.status || 'NOT_SUBMITTED'}
                                </span>
                            </div>
                        )}

                        {verification?.status === 'REJECTED' && verification?.rejectionReason && (
                            <div className="alert-error" style={{ marginBottom: 12 }}>
                                <strong>Rejected: </strong>{verification.rejectionReason}
                            </div>
                        )}

                        {verification?.status === 'APPROVED' && (
                            <div className="alert-success" style={{ marginBottom: 12 }}>
                                Your identity documents have been approved. You are eligible to be booked by customers.
                            </div>
                        )}

                        {verification?.status !== 'APPROVED' && (
                            <form onSubmit={handleSubmitVerification} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                    <label className="hm-label">Document Type</label>
                                    <select
                                        className="hm-input"
                                        value={docType}
                                        onChange={e => setDocType(e.target.value)}
                                    >
                                        <option value="NIC">NIC</option>
                                        <option value="DRIVER_LICENSE">Driver License</option>
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label className="hm-label">Front Image</label>
                                        <input
                                            className="hm-input"
                                            type="file"
                                            accept="image/jpeg,image/png"
                                            onChange={e => setFrontFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                    <div>
                                        <label className="hm-label">Back Image</label>
                                        <input
                                            className="hm-input"
                                            type="file"
                                            accept="image/jpeg,image/png"
                                            onChange={e => setBackFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                </div>
                                <p style={{ fontSize: 12, color: '#94a3b8' }}>Accepted formats: JPEG or PNG. Maximum size: 5 MB per file.</p>
                                {verificationMsg.text && (
                                    <div className={verificationMsg.type === 'success' ? 'alert-success' : 'alert-error'}>
                                        {verificationMsg.text}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    className="btn-secondary"
                                    disabled={submittingVerification}
                                    style={{ alignSelf: 'flex-start' }}
                                >
                                    {submittingVerification ? 'Submitting...' : 'Submit Documents for Review'}
                                </button>
                            </form>
                        )}
                    </div>
                </>
            )}

            {/* Supplier Profile Edit */}
            {user?.role === 'supplier' && (
                <div className="hm-card" style={{ padding: 24, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0c4a6e', marginBottom: 16 }}>Supplier Profile</h3>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0891b2' }}><span className="spinner" /> Loading...</div>
                    ) : (
                        <form onSubmit={handleSaveSupplierProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label className="hm-label">Business Name</label>
                                <input
                                    className="hm-input"
                                    value={supplierForm.businessName}
                                    onChange={e => setSupplierForm({ ...supplierForm, businessName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="hm-label">Contact Person Name</label>
                                <input
                                    className="hm-input"
                                    value={supplierForm.contactPersonName}
                                    onChange={e => setSupplierForm({ ...supplierForm, contactPersonName: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label className="hm-label">City</label>
                                    <input
                                        className="hm-input"
                                        value={supplierForm.city}
                                        onChange={e => setSupplierForm({ ...supplierForm, city: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="hm-label">District</label>
                                    <DistrictSelect
                                        value={supplierForm.district}
                                        onChange={(value) => setSupplierForm({ ...supplierForm, district: value })}
                                        required={false}
                                    />
                                </div>
                            </div>
                            {supplierMsg.text && (
                                <div className={supplierMsg.type === 'success' ? 'alert-success' : 'alert-error'}>{supplierMsg.text}</div>
                            )}
                            <button type="submit" className="btn-primary" disabled={supplierSaving} style={{ alignSelf: 'flex-start' }}>
                                {supplierSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Change Password */}
            <div className="hm-card" style={{ padding: 24, marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0c4a6e', marginBottom: 16 }}>Change Password</h3>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
                    <div>
                        <label className="hm-label">Current Password</label>
                        <input className="hm-input" type="password" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} />
                    </div>
                    <div>
                        <label className="hm-label">New Password</label>
                        <input
                            className="hm-input"
                            type="password"
                            required
                            minLength={8}
                            placeholder="At least 8 characters, uppercase, lowercase & symbol"
                            value={pwForm.newPw}
                            onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="hm-label">Confirm New Password</label>
                        <input
                            className="hm-input"
                            type="password"
                            required
                            placeholder="Re-enter new password"
                            value={pwForm.confirm}
                            onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                        />
                    </div>
                    {pwMsg.text && <div className={pwMsg.type === 'success' ? 'alert-success' : 'alert-error'}>{pwMsg.text}</div>}
                    <button type="submit" className="btn-secondary" style={{ alignSelf: 'flex-start' }}>Update Password</button>
                </form>
            </div>

            {/* Danger Zone (currently only wired for workers) */}
            {user?.role === 'worker' && (
                <div className="hm-card" style={{ padding: 24, border: '1.5px solid #fecaca' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>Danger Zone</h3>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                        Permanently delete your account. This action cannot be undone.
                    </p>
                    <button className="btn-danger" onClick={handleDeleteAccount}>Delete My Account</button>
                </div>
            )}
        </div>
    );
}
