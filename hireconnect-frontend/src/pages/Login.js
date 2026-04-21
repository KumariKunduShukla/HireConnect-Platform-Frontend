import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authAPI, profileAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import jwtDecode from 'jwt-decode';
import './Auth.css';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null); // { type: 'pending'|'rejected', message }
  const { login, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const tokenParam = params.get('token');
    const errorParam = params.get('error');

    if (errorParam) {
      toast.error(`GitHub Login Failed: ${errorParam}`);
      navigate('/login', { replace: true });
    } else if (tokenParam) {
      handleOAuthToken(tokenParam);
    } else if (code) {
      handleGithubCode(code);
    }
  }, [location.search, navigate]);

  const handleOAuthToken = async (token) => {
    try {
      setLoading(true);
      const { token: parsedToken, userData } = parseLoginResponse(token, '');
      if (!parsedToken || !userData) {
         throw new Error("Invalid token received from OAuth");
      }
      login(userData, parsedToken);
      
      try {
        const profileRes = await profileAPI.getProfileByEmail(userData.email);
        if (profileRes.data) updateUser({ ...userData, ...profileRes.data });
      } catch (_) {}

      toast.success('Welcome back via GitHub! 👋');
      navigate(userData.role === 'ADMIN' ? '/dashboard' : (userData.role === 'RECRUITER' ? '/recruiter' : '/dashboard'));
    } catch (err) {
      toast.error(getErrorMessage(err));
      navigate('/login', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleGithubCode = async (code) => {
    try {
      setLoading(true);
      const res = await authAPI.githubLogin(code);
      const { token, userData } = parseLoginResponse(res.data, '');
      if (!token || !userData) {
         throw new Error("Invalid token received from OAuth");
      }
      login(userData, token);

      try {
        const profileRes = await profileAPI.getProfileByEmail(userData.email);
        if (profileRes.data) updateUser({ ...userData, ...profileRes.data });
      } catch (_) {}

      toast.success('Welcome back via GitHub! 👋');
      navigate(userData.role === 'ADMIN' ? '/dashboard' : (userData.role === 'RECRUITER' ? '/recruiter' : '/dashboard'));
    } catch (err) {
      toast.error(getErrorMessage(err));
      navigate('/login', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const normalizeRole = (role) => {
    if (Array.isArray(role)) return role[0];
    if (typeof role === 'string') return role.replace(/^ROLE_/, '');
    return role;
  };

  const buildUserFromToken = (token, email) => {
    try {
      const decoded = jwtDecode(token);
      const decodedEmail = decoded.email || decoded.sub || email;
      return {
        userId: decoded.userId || decoded.id,
        name: decoded.name || decoded.fullName || decodedEmail,
        email: decodedEmail,
        role: normalizeRole(decoded.role || decoded.authority || decoded.authorities) || 'CANDIDATE',
      };
    } catch (_) {
      return {
        email,
        name: email,
        role: 'CANDIDATE',
      };
    }
  };

  const parseLoginResponse = (data, email) => {
    if (typeof data === 'string') {
      return {
        token: data,
        userData: buildUserFromToken(data, email),
      };
    }

    const token = data?.token || data?.jwt || data?.accessToken || data?.access_token;
    let userData = data?.user || data?.userData || data?.profile || null;

    if (!userData && token) {
      const rest = { ...(data || {}) };
      delete rest.token;
      delete rest.jwt;
      delete rest.accessToken;
      delete rest.access_token;
      userData = Object.keys(rest).length ? rest : buildUserFromToken(token, email);
    }

    if (userData?.role) {
      userData = { ...userData, role: normalizeRole(userData.role) };
    }

    return { token, userData };
  };

  const getErrorMessage = (err) => {
    const data = err.response?.data;
    if (typeof data === 'string') return data;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    return err.message || 'Login failed. Please check your credentials.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusBanner(null);

    try {
      const res = await authAPI.login(form.email, form.password);
      const { token, userData } = parseLoginResponse(res.data, form.email);
      if (!token || !userData) {
        throw new Error('Invalid login response from server');
      }

      login(userData, token);

      // Enrich with profile data if available
      try {
        const profileRes = await profileAPI.getProfileByEmail(form.email);
        if (profileRes.data) updateUser({ ...userData, ...profileRes.data });
      } catch (_) {
        // Profile may not exist yet — not an error
      }

      toast.success('Welcome back! 👋');

      if (userData.role === 'RECRUITER') {
        navigate('/recruiter');
      } else if (userData.role === 'ADMIN') {
        navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      const normalizedMessage = message.toLowerCase();

      // Detect specific backend status messages and show inline banners
      if (message.startsWith('PENDING:') || normalizedMessage.includes('pending approval')) {
        setStatusBanner({
          type: 'pending',
          message: 'Your recruiter application is awaiting admin approval. You will receive an email once approved.',
        });
      } else if (message.startsWith('REJECTED:') || normalizedMessage.includes('rejected')) {
        setStatusBanner({
          type: 'rejected',
          message: 'Your recruiter application was rejected by admin. Please contact support for more information.',
        });
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="auth-page">
        <div className="auth-left">
          <div className="auth-brand">
            <Link to="/" className="auth-logo">
              <span className="logo-icon">HC</span>
              <span className="logo-text">HireConnect</span>
            </Link>
          </div>
          <div className="auth-illustration">
            <div className="auth-card-mock">
              <div className="auth-mock-badge badge badge-green">● OPEN ROLE</div>
              <div className="auth-mock-title">Senior Frontend Engineer</div>
              <div className="auth-mock-company">TechCorp Inc. · Remote</div>
              <div className="auth-mock-tags">
                <span className="badge badge-blue">React</span>
                <span className="badge badge-purple">TypeScript</span>
                <span className="badge badge-gray">Node.js</span>
              </div>
              <div className="auth-mock-salary">$90K – $130K / year</div>
            </div>
            <p className="auth-left-quote">"Find your perfect role in minutes,<br/>not months."</p>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-box fade-in">
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-sub">Sign in to your HireConnect account</p>

            {/* Inline status banners — shown instead of toast for approval-related messages */}
            {statusBanner?.type === 'pending' && (
                <div className="status-banner status-banner--pending">
                  <span className="status-banner__icon">⏳</span>
                  <div>
                    <strong>Approval Pending</strong>
                    <p>{statusBanner.message}</p>
                  </div>
                </div>
            )}
            {statusBanner?.type === 'rejected' && (
                <div className="status-banner status-banner--rejected">
                  <span className="status-banner__icon">❌</span>
                  <div>
                    <strong>Application Rejected</strong>
                    <p>{statusBanner.message}</p>
                  </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label>Email Address</label>
                <input
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                    type="password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                />
              </div>

              <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: '-8px', marginBottom: '16px' }}>
                <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'underline' }}>
                  Forgot Password?
                </Link>
              </div>

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="auth-divider"><span>or</span></div>

            <a
                href={`https://github.com/login/oauth/authorize?client_id=Iv23liQdp7vbZ1tJSjmw&scope=user:email`}
                className="btn btn-ghost auth-github"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Continue with GitHub
            </a>

            <p className="auth-footer-text">
              Don't have an account? <Link to="/register">Create one</Link>
            </p>
            <p className="auth-footer-text">
              Are you a recruiter? <Link to="/recruiter-apply">Apply here</Link>
            </p>
          </div>
        </div>
      </div>
  );
}
