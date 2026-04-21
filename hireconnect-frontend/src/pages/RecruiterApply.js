import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI, profileAPI } from '../api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/errorMessage';
import './Auth.css';
import './RecruiterApply.css';

export default function RecruiterApply() {
  const [step, setStep] = useState(1); // 1=apply, 2=set-password, 3=success
  const [form, setForm] = useState({ email: '', name: '', company: '' });
  const [pwForm, setPwForm] = useState({ otp: '', newPassword: '', confirm: '' });
  const [appliedEmail, setAppliedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const getErrorMessage = (result) => {
    const data = result?.reason?.response?.data;
    if (typeof data === 'string') return data;
    if (data?.message) return data.message;
    return result?.reason?.message || 'Application failed. Email may already be registered.';
  };

  // Step 1: Submit recruiter application
  const handleApply = async (e) => {
    e.preventDefault();
    
    if (form.name && !/^[a-zA-Z\s]+$/.test(form.name)) {
      toast.error('Name should contain only letters and spaces');
      return;
    }

    setLoading(true);
    try {
      const profilePayload = {
        email: form.email,
        fullName: form.name || form.email.split('@')[0],
        companyName: form.company || 'Not provided',
        status: 'PENDING_APPROVAL',
      };
      const results = await Promise.allSettled([
        authAPI.recruiterApply({ email: form.email }),
        profileAPI.createRecruiterProfile(profilePayload),
      ]);

      if (results.every((result) => result.status === 'rejected')) {
        throw new Error(getErrorMessage(results[0]));
      }

      setAppliedEmail(form.email);
      toast.success('Application submitted! Await admin approval.');
      setStep(2);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Application failed. Email may already be registered.'));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Set password after approval OTP received via email
  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await authAPI.recruiterSetPassword(
        pwForm.email || appliedEmail,
        pwForm.otp,
        pwForm.newPassword
      );
      toast.success('Account activated! You can now sign in.');
      setStep(3);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to set password. OTP may have expired.'));
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
          <div className="recruiter-perks">
            <h3 className="perks-title">Why post on HireConnect?</h3>
            {[
              { icon: '🎯', text: 'Access to 98K+ verified candidates' },
              { icon: '⚡', text: 'Post jobs in under 2 minutes' },
              { icon: '📊', text: 'Track applicant pipeline visually' },
              { icon: '🔔', text: 'Auto-notify shortlisted candidates' },
              { icon: '💬', text: 'Schedule interviews in-platform' },
            ].map(p => (
              <div key={p.text} className="perk-item">
                <span className="perk-icon">{p.icon}</span>
                <span className="perk-text">{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-box fade-in">

          {/* ── STEP 1: Application form ── */}
          {step === 1 && (
            <>
              <h1 className="auth-title">Recruiter Application</h1>
              <p className="auth-sub">Apply to post jobs on HireConnect. Admin approval required.</p>

              <form onSubmit={handleApply} className="auth-form">
                <div className="form-group">
                  <label>Work Email *</label>
                  <input
                    type="email"
                    placeholder="recruiter@company.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Your Name</label>
                  <input
                    type="text"
                    placeholder="John Smith"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    placeholder="Acme Corp"
                    value={form.company}
                    onChange={e => setForm({ ...form, company: e.target.value })}
                  />
                </div>

                <div className="info-box">
                  <div className="info-box-icon">ℹ️</div>
                  <div>
                    <div className="info-box-title">What happens next?</div>
                    <div className="info-box-text">
                      Your application will be reviewed by our admin team (1–2 business days).
                      Once approved, you'll receive an OTP via email to set your password and activate your account.
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'Submitting…' : 'Submit Application'}
                </button>
              </form>

              <p className="auth-footer-text">
                Already approved?{' '}
                <button className="link-btn" onClick={() => setStep(2)}>Set your password →</button>
              </p>
              <p className="auth-footer-text">
                Have an account? <Link to="/login">Sign In</Link>
              </p>
            </>
          )}

          {/* ── STEP 2: Set password ── */}
          {step === 2 && (
            <>
              <div className="otp-header">
                <div className="otp-icon">📬</div>
                <h1 className="auth-title">Activate Your Account</h1>
                <p className="auth-sub">
                  Enter the OTP sent to your email after admin approves your application.
                </p>
              </div>

              <form onSubmit={handleSetPassword} className="auth-form">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="recruiter@company.com"
                    value={pwForm.email !== undefined ? pwForm.email : appliedEmail}
                    onChange={e => setPwForm({ ...pwForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>OTP from Approval Email</label>
                  <input
                    type="text"
                    placeholder="6-digit OTP"
                    value={pwForm.otp}
                    onChange={e => setPwForm({ ...pwForm, otp: e.target.value })}
                    required
                    maxLength={6}
                    style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '1.2rem' }}
                  />
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    placeholder="Min. 8 characters"
                    value={pwForm.newPassword}
                    onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>

                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Repeat password"
                    value={pwForm.confirm}
                    onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'Activating…' : 'Activate Account'}
                </button>
              </form>

              <button
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => setStep(1)}
              >
                ← Back to Application
              </button>
            </>
          )}

          {/* ── STEP 3: Success ── */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <h1 className="auth-title">You're all set!</h1>
              <p className="auth-sub">
                Your recruiter account is now active. Sign in to start posting jobs.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
                Sign In Now →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
