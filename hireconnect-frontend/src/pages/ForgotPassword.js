import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import toast from 'react-hot-toast';
import './Auth.css';

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1 = email, 2 = otp + new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      toast.success('OTP sent to your email!');
      setStep(2);
    } catch (err) {
      let msg = 'Failed to send OTP.';
      if (err.response?.data) {
        msg = typeof err.response.data === 'string' ? err.response.data : (err.response.data.error || JSON.stringify(err.response.data));
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword(email, otp, newPassword);
      toast.success('Password successfully reset! Please sign in.');
      navigate('/login');
    } catch (err) {
      let msg = 'Failed to reset password.';
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
                <div className="step-title">Enter Email</div>
                <div className="step-sub">We'll send you a code</div>
              </div>
            </div>
            <div className="step-line" />
            <div className={`auth-step-item ${step >= 2 ? 'done' : ''}`}>
              <div className="step-circle">2</div>
              <div>
                <div className="step-title">Reset Password</div>
                <div className="step-sub">Choose a new password</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-box fade-in">
          {step === 1 ? (
            <>
              <h1 className="auth-title">Forgot Password</h1>
              <p className="auth-sub">Enter your email to receive a password reset code</p>

              <form onSubmit={handleSendOtp} className="auth-form">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'Sending OTP…' : 'Send Reset Code'}
                </button>
              </form>

              <p className="auth-footer-text">
                Remembered your password? <Link to="/login">Sign In</Link>
              </p>
            </>
          ) : (
            <>
              <div className="otp-header">
                <div className="otp-icon">📬</div>
                <h1 className="auth-title">Reset Password</h1>
                <p className="auth-sub">Enter the code sent to <strong>{email}</strong></p>
              </div>

              <form onSubmit={handleResetPassword} className="auth-form">
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

                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'Resetting…' : 'Reset Password'}
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
