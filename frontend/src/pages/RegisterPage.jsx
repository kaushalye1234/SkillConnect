import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const ROLES = [
  { value: 'customer', label: '🏠 Customer', desc: 'Hire skilled workers for your projects' },
  { value: 'worker', label: '👷 Worker', desc: 'Offer your skills and get hired' },
  { value: 'supplier', label: '🔧 Supplier', desc: 'Rent out tools & equipment' },
];

const WORKER_CATEGORIES = [
  'Plumber',
  'Electrician',
  'Carpenter',
  'Mason',
  'Painter',
  'Cleaner',
  'Driver',
  'Gardener',
  'Technician',
  'Handyman',
  'Other',
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const googleSource = location.state?.source === 'google';
  const googleEmail = location.state?.email || '';
  const [form, setForm] = useState({
    email: googleEmail,
    password: '',
    confirmPassword: '',
    role: 'customer',
    firstName: '',
    lastName: '',
    phone: '',
    workerCategory: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const normalizedPhone = form.phone.trim();

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (form.role === 'worker' && !form.workerCategory) {
      setError('Please select your primary skill category.');
      return;
    }

    // Password: at least 8 chars, upper, lower, symbol
    const strongPwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPwRegex.test(form.password)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase and a symbol.');
      return;
    }

    if (normalizedPhone && !/^\d{10}$/.test(normalizedPhone)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    setLoading(true);
    try {
      await register({ ...form, phone: normalizedPhone });
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (!err.response || err.message === 'Network Error') {
        setError('Network error: Cannot connect to the server. Please ensure the backend is running.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      {/* Left panel — branding */}
      <div className="auth-panel-left">
        <div style={{
          width: 68, height: 68,
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 32, fontWeight: 900,
          marginBottom: 20, backdropFilter: 'blur(4px)'
        }}>S</div>
        <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.5px' }}>SkillConnect</h1>
        <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 36, textAlign: 'center', maxWidth: 280 }}>
          Join thousand of professionals and customers on Sri Lanka's #1 On-Demand Skilled Worker Platform
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 280, textAlign: 'left' }}>
          {ROLES.map(r => (
            <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{r.label.split(' ')[0]}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{r.label.split(' ').slice(1).join(' ')}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-panel-right">
        <div style={{ width: '100%', maxWidth: 420 }} className="fade-in">
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0c4a6e', marginBottom: 4 }}>Create Account</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28 }}>Get started with SkillConnect today.</p>

          {error && <div className="alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          {/* Role selection pills */}
          <div style={{ marginBottom: 20 }}>
            <label className="hm-label">I am a</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ROLES.map(r => (
                <button key={r.value} type="button"
                  onClick={() => setForm({ ...form, role: r.value })}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    border: form.role === r.value ? '2px solid #0891b2' : '1.5px solid #e0f2fe',
                    background: form.role === r.value ? '#f0f9ff' : '#fff',
                    color: form.role === r.value ? '#0891b2' : '#64748b',
                    fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="hm-label">First Name</label>
                <input className="hm-input" type="text" required placeholder="John"
                  value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label className="hm-label">Last Name</label>
                <input className="hm-input" type="text" required placeholder="Doe"
                  value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="hm-label">Email Address</label>
              <input
                className="hm-input"
                type="email"
                required
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                readOnly={googleSource}
              />
            </div>

            <div>
              <label className="hm-label">Phone (optional)</label>
              <input className="hm-input" type="tel" placeholder="07XXXXXXXX" inputMode="numeric" pattern="\d{10}" title="Enter a 10-digit mobile number"
                value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>

            {form.role === 'worker' && (
              <div>
                <label className="hm-label">Primary Skill Category</label>
                <select
                  className="hm-input"
                  value={form.workerCategory}
                  onChange={e => setForm({ ...form, workerCategory: e.target.value })}
                  required
                >
                  <option value="">Select a category...</option>
                  {WORKER_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="hm-label">Password</label>
              <input
                className="hm-input"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters, uppercase, lowercase & symbol"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>

            <div>
              <label className="hm-label">Confirm Password</label>
              <input
                className="hm-input"
                type="password"
                required
                minLength={8}
                placeholder="Re-enter password"
                value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '13px', marginTop: 10 }}>
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating account...</>
                : 'Create Account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', marginTop: 24 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#0891b2', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
