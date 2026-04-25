import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const FEATURES = [
    { icon: '👷', text: 'Hire verified skilled workers' },
    { icon: '📅', text: 'Easy online booking & scheduling' },
    { icon: '⭐', text: 'Trusted reviews & ratings' },
    { icon: '🔧', text: 'Rent tools & equipment' },
];

export default function LoginPage() {
    const navigate = useNavigate();
    const { login, googleLogin } = useAuth();
    const googleBtnRef = useRef(null);
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotMsg, setForgotMsg] = useState('');

    const handleGoogleResponse = useCallback(async (response) => {
        setError(''); setLoading(true);
        try {
            const result = await googleLogin(response.credential);

            // If this Google account is not yet registered in our system,
            // redirect to the registration page with the email pre-filled.
            if (result?.needRegistration) {
                navigate('/register', { state: { source: 'google', email: result.email } });
                return;
            }

            // Existing user: simply go to dashboard
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Google login failed.');
        } finally {
            setLoading(false);
        }
    }, [googleLogin, navigate]);

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || !window.google?.accounts) return;
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse });
        if (googleBtnRef.current) {
            window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'outline', size: 'large', shape: 'pill', width: '100%' });
        }
    }, [handleGoogleResponse]);

    const handleLogin = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        try { await login(form.email, form.password); }
        catch (err) {
            if (err.response?.data?.message) {
                setError(err.response.data.message);
            } else if (!err.response || err.message === 'Network Error') {
                setError('Network error: Cannot connect to the server. Please ensure the backend is running.');
            } else {
                setError('Login failed. Check your credentials.');
            }
        }
        finally { setLoading(false); }
    };

    const handleForgot = async (e) => {
        e.preventDefault();
        try {
            const { authAPI } = await import('../api');
            const res = await authAPI.forgotPassword(forgotEmail);
            setForgotMsg(res.data.data || res.data.message);
        } catch (err) { setForgotMsg('Error: ' + (err.response?.data?.message || 'Something went wrong')); }
    };

    /* ── Forgot password overlay ── */
    if (forgotMode) return (
        <div className="auth-shell">
            {/* Left panel */}
            <div className="auth-panel-left">
                <div style={{ fontSize: 56, marginBottom: 16 }}>🔑</div>
                <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Forgot Password?</h2>
                <p style={{ opacity: 0.85, fontSize: 14, textAlign: 'center', maxWidth: 280 }}>
                    No worries! We'll send you a reset link to your email address.
                </p>
            </div>
            {/* Right panel */}
            <div className="auth-panel-right">
                <div style={{ width: '100%', maxWidth: 400 }}>
                    <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0c4a6e', marginBottom: 6 }}>Reset Password</h3>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Enter your email to receive a reset link.</p>
                    <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label className="hm-label">Email Address</label>
                            <input className="hm-input" type="email" placeholder="you@example.com"
                                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                            Send Reset Link
                        </button>
                        {forgotMsg && <div className="alert-info">{forgotMsg}</div>}
                        <button type="button" onClick={() => setForgotMode(false)}
                            style={{ background: 'none', border: 'none', color: '#0891b2', fontSize: 13, fontWeight: 600, cursor: 'pointer', paddingTop: 4 }}>
                            ← Back to Login
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );

    /* ── Main login ── */
    return (
        <div className="auth-shell">
            {/* Left panel — matches HireMe-style hero */}
            <div className="auth-panel-left">
                <div
                    style={{
                        position: 'relative',
                        zIndex: 1,
                        maxWidth: 360,
                        textAlign: 'left',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            marginBottom: 40,
                        }}
                    >
                        <div
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 999,
                                background: 'rgba(15,118,110,0.18)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#a5f3fc',
                                fontWeight: 800,
                                fontSize: 16,
                            }}
                        >
                            SC
                        </div>
                        <span
                            style={{
                                fontSize: 11,
                                letterSpacing: '0.22em',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                color: 'rgba(226, 232, 240, 0.9)',
                            }}
                        >
                            SkillConnect
                        </span>
                    </div>

                    <h1
                        style={{
                            fontSize: 34,
                            fontWeight: 800,
                            lineHeight: 1.1,
                            marginBottom: 18,
                            letterSpacing: '-0.04em',
                        }}
                    >
                        Connecting
                        <span style={{ color: '#5eead4' }}> Talent </span>
                        with
                        <span style={{ color: '#22d3ee' }}> Opportunity.</span>
                    </h1>

                    <p
                        style={{
                            fontSize: 14,
                            opacity: 0.9,
                            maxWidth: 320,
                        }}
                    >
                        Join skilled workers and clients across Sri Lanka building the
                        future of work. Find trusted experts or list your services in
                        minutes.
                    </p>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            marginTop: 32,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            {[
                                { bg: '#ecfeff', initial: 'A' },
                                { bg: '#e0f2fe', initial: 'K' },
                                { bg: '#fee2e2', initial: 'M' },
                            ].map((a, idx) => (
                                <div
                                    key={a.initial}
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 999,
                                        background: a.bg,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#0f172a',
                                        fontWeight: 700,
                                        fontSize: 15,
                                        border: '2px solid rgba(15,23,42,0.4)',
                                        marginLeft: idx === 0 ? 0 : -10,
                                    }}
                                >
                                    {a.initial}
                                </div>
                            ))}
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 999,
                                    background: '#06b6d4',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 800,
                                    fontSize: 13,
                                    border: '2px solid rgba(15,23,42,0.5)',
                                    marginLeft: -10,
                                }}
                            >
                                +2k
                            </div>
                        </div>

                        <div>
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    marginBottom: 2,
                                    opacity: 0.95,
                                }}
                            >
                                Trusted by professionals
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    opacity: 0.85,
                                }}
                            >
                                ★★★★★
                                <span style={{ marginLeft: 4 }}>4.9</span>
                                <span style={{ opacity: 0.8 }}> · 2k+ jobs booked</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right panel — card-style form */}
            <div className="auth-panel-right">
                <div style={{ width: '100%', maxWidth: 420 }} className="fade-in">
                    <div
                        style={{
                            background: '#ffffff',
                            borderRadius: 24,
                            padding: '30px 30px 24px',
                            boxShadow: '0 24px 80px rgba(15,23,42,0.18)',
                            border: '1px solid #e2e8f0',
                        }}
                    >
                        <h2
                            style={{
                                fontSize: 24,
                                fontWeight: 800,
                                color: '#0f172a',
                                marginBottom: 4,
                                textAlign: 'center',
                            }}
                        >
                            Welcome Back
                        </h2>
                        <p
                            style={{
                                fontSize: 13,
                                color: '#64748b',
                                marginBottom: 24,
                                textAlign: 'center',
                            }}
                        >
                            Please enter your details to sign in.
                        </p>

                        {error && (
                            <div className="alert-error" style={{ marginBottom: 16 }}>
                                {error}
                            </div>
                        )}

                        <form
                            onSubmit={handleLogin}
                            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                        >
                            <div>
                                <label className="hm-label">Email Address</label>
                                <div style={{ position: 'relative' }}>
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: 13,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            fontSize: 15,
                                            color: '#9ca3af',
                                        }}
                                    >
                                        ✉️
                                    </span>
                                    <input
                                        className="hm-input"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={form.email}
                                        onChange={(e) =>
                                            setForm({ ...form, email: e.target.value })
                                        }
                                        required
                                        style={{ paddingLeft: 40 }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 4,
                                    }}
                                >
                                    <label
                                        className="hm-label"
                                        style={{ marginBottom: 0 }}
                                    >
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setForgotMode(true)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#0ea5e9',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: 13,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            fontSize: 15,
                                            color: '#9ca3af',
                                        }}
                                    >
                                        🔒
                                    </span>
                                    <input
                                        className="hm-input"
                                        type="password"
                                        placeholder="••••••••"
                                        value={form.password}
                                        onChange={(e) =>
                                            setForm({ ...form, password: e.target.value })
                                        }
                                        required
                                        style={{ paddingLeft: 40 }}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary"
                                style={{
                                    width: '100%',
                                    justifyContent: 'center',
                                    padding: '11px',
                                    marginTop: 4,
                                }}
                            >
                                {loading ? (
                                    <>
                                        <span
                                            className="spinner"
                                            style={{
                                                width: 16,
                                                height: 16,
                                                borderWidth: 2,
                                            }}
                                        />{' '}
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>

                            {/* Divider */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginTop: 6,
                                }}
                            >
                                <div
                                    style={{
                                        flex: 1,
                                        height: 1,
                                        background: '#e5e7eb',
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: '#9ca3af',
                                        textTransform: 'uppercase',
                                        fontWeight: 600,
                                    }}
                                >
                                    or continue with
                                </span>
                                <div
                                    style={{
                                        flex: 1,
                                        height: 1,
                                        background: '#e5e7eb',
                                    }}
                                />
                            </div>

                            <div
                                style={{
                                    marginTop: 2,
                                }}
                            >
                                {GOOGLE_CLIENT_ID ? (
                                    <div
                                        ref={googleBtnRef}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                        }}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            alert(
                                                'Set VITE_GOOGLE_CLIENT_ID in .env to enable Google login.',
                                            )
                                        }
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: 999,
                                            border: '1px solid #e5e7eb',
                                            background: '#ffffff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 8,
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: '#0f172a',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: 4,
                                                background:
                                                    'conic-gradient(from 45deg,#ea4335,#fbbc05,#34a853,#4285f4,#ea4335)',
                                            }}
                                        />
                                        Google
                                    </button>
                                )}
                            </div>

                            <p
                                style={{
                                    textAlign: 'center',
                                    fontSize: 13,
                                    color: '#6b7280',
                                    marginTop: 20,
                                }}
                            >
                                Don't have an account?{' '}
                                <Link
                                    to="/register"
                                    style={{
                                        color: '#0ea5e9',
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                    }}
                                >
                                    Join SkillConnect
                                </Link>
                            </p>
                        </form>
                    </div>

                    <div
                        style={{
                            marginTop: 16,
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 18,
                            fontSize: 11,
                            color: '#9ca3af',
                        }}
                    >
                        <Link
                            to="/privacy"
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            Privacy Policy
                        </Link>
                        <Link
                            to="/terms"
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            Terms of Service
                        </Link>
                        <Link
                            to="/contact"
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            Help Center
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
