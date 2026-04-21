import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import toast from 'react-hot-toast';
import './Auth.css';

export default function Register() {
  const [step, setStep] = useState(1); // 1=form, 2=otp
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'CANDIDATE' });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!/^[a-zA-Z\s]+$/.test(form.name)) {
      toast.error('Name should contain only letters and spaces');
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      // Store name in localStorage for later profile creation
      localStorage.setItem('hc_fullName', form.name);
      // Send only email and password to auth service (backend UserCredential doesn't have name)
      await authAPI.register({ email: form.email, password: form.password });
      toast.success('OTP sent to your email!');
      setStep(2);
    } catch (err) {
      let msg = 'Registration failed.';
      if (err.response?.data) {
        msg = typeof err.response.data === 'string' ? err.response.data : (err.response.data.error || JSON.stringify(err.response.data));
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Send only email and password to backend
      await authAPI.verifyOtp(form.email, otp, { email: form.email, password: form.password });
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err) {
      let msg = 'OTP verification failed.';
      if (err.response?.data) {
        msg = typeof err.response.data === 'string' ? err.response.data : (err.response.data.error || JSON.stringify(err.response.data));
      }
      toast.error(msg);
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
          <div className="auth-steps-display">
            <div className={`auth-step-item ${step >= 1 ? 'done' : ''}`}>
              <div className="step-circle">1</div>
              <div>
                <div className="step-title">Create Account</div>
                <div className="step-sub">Fill in your details</div>
              </div>
            </div>
            <div className="step-line" />
            <div className={`auth-step-item ${step >= 2 ? 'done' : ''}`}>
              <div className="step-circle">2</div>
              <div>
                <div className="step-title">Verify Email</div>
                <div className="step-sub">Enter the OTP sent to you</div>
              </div>
            </div>
            <div className="step-line" />
            <div className="auth-step-item">
              <div className="step-circle">3</div>
              <div>
                <div className="step-title">Start Hiring</div>
                <div className="step-sub">Browse and apply to jobs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-box fade-in">
          {step === 1 ? (
            <>
              <h1 className="auth-title">Create account</h1>
              <p className="auth-sub">Join thousands of professionals on HireConnect</p>

              <form onSubmit={handleRegister} className="auth-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

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
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>

                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>

                {/* FIX: Removed ADMIN role option — backend forces CANDIDATE anyway.
                    Admins are created via createInitialAdmin() endpoint.
                    Recruiters use the separate /recruiter-apply flow. */}
                <div className="form-group">
                  <label>Account Type</label>
                  <div className="role-toggle">
                    <button
                      type="button"
                      className="role-btn active"
                      disabled
                    >
                      👤 Job Seeker
                    </button>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 6 }}>
                    Are you a recruiter? <Link to="/recruiter-apply">Apply as Recruiter →</Link>
                  </p>
                </div>

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'Sending OTP…' : 'Continue'}
                </button>
              </form>

              <p className="auth-footer-text">
                Already have an account? <Link to="/login">Sign In</Link>
              </p>
            </>
          ) : (
            <>
              <div className="otp-header">
                <div className="otp-icon">📬</div>
                <h1 className="auth-title">Check your inbox</h1>
                <p className="auth-sub">We sent a 6-digit code to <strong>{form.email}</strong></p>
              </div>

              <form onSubmit={handleVerifyOtp} className="auth-form">
                <div className="form-group">
                  <label>Verification Code</label>
                  <input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    maxLength={6}
                    style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.3rem' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'Verifying…' : 'Verify & Create Account'}
                </button>
              </form>

              <button
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => setStep(1)}
              >
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}