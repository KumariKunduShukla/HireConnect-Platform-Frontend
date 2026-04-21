import React, { useEffect, useMemo, useState } from 'react';
import { profileAPI, authAPI, getProfileResumeDownloadUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Profile.css';

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  location: '',
  headline: '',
  bio: '',
  companyName: '',
  website: '',
  skills: '',
};

const normalizeRole = (role) => String(role || '').replace(/^ROLE_/, '').toUpperCase();

const getProfileId = (profile) =>
  profile?.profileId || profile?.id || profile?.candidateId || profile?.recruiterId || null;

const mapProfileToForm = (profile) => ({
  fullName: profile?.fullName || profile?.name || '',
  phone: profile?.phone || profile?.phoneNumber || '',
  location: profile?.location || '',
  headline: profile?.headline || profile?.title || '',
  bio: profile?.bio || profile?.about || '',
  companyName: profile?.companyName || profile?.company || '',
  website: profile?.website || '',
  skills: Array.isArray(profile?.skills) ? profile.skills.join(', ') : profile?.skills || '',
});

const buildPayload = (form, email, role, userId) => {
  const payload = {
    email,
    fullName: form.fullName,
    phone: form.phone,
    location: form.location,
    headline: form.headline,
    bio: form.bio,
    skills: form.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };

  if (role === 'RECRUITER') {
    payload.companyName = form.companyName;
    payload.website = form.website;
  }

  if (userId) {
    payload.userId = userId;
  }

  return payload;
};

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);

  // Email change state
  const [emailStep, setEmailStep] = useState(0); // 0=none, 1=enter email, 2=enter otp
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const role = useMemo(() => normalizeRole(user?.role) || 'CANDIDATE', [user?.role]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await profileAPI.getProfileByEmail(user.email);
        const found = res?.data || null;
        setProfile(found);
        if (found) {
          setForm((prev) => ({ ...prev, ...mapProfileToForm(found) }));
          updateUser({ ...user, ...found, profileId: getProfileId(found) });
        } else {
          setForm((prev) => ({ ...prev, fullName: prev.fullName || user?.name || '' }));
        }
      } catch (_) {
        // A missing profile is expected for first-time users.
        setForm((prev) => ({ ...prev, fullName: prev.fullName || user?.name || '' }));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.email, user?.name]);

  const onChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user?.email) {
      toast.error('Please sign in again before updating profile.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(form, user.email, role, user?.userId || user?.id);
      const id = getProfileId(profile) || user?.profileId;

      if (!id && role === 'CANDIDATE') {
        if (!resumeFile) {
          toast.error('Please upload your resume before saving.');
          setSaving(false);
          return;
        }
        const formData = new FormData();
        formData.append('profile', JSON.stringify(payload));
        formData.append('resume', resumeFile);
        const res = await profileAPI.createCandidateProfile(formData);
        const saved = res?.data || payload;
        const savedId = getProfileId(saved) || id || null;
        setProfile({ ...saved, profileId: savedId });
        updateUser({ ...user, ...saved, profileId: savedId });
        toast.success('Profile updated successfully.');
        return;
      }

      if (!id && role === 'RECRUITER') {
        const res = await profileAPI.createRecruiterProfile(payload);
        const saved = res?.data || payload;
        const savedId = getProfileId(saved) || id || null;
        setProfile({ ...saved, profileId: savedId });
        updateUser({ ...user, ...saved, profileId: savedId });
        toast.success('Profile updated successfully.');
        return;
      }

      const res = await profileAPI.updateProfile(id, payload);

      const saved = res?.data || payload;
      const savedId = getProfileId(saved) || id || null;
      setProfile({ ...saved, profileId: savedId });
      updateUser({ ...user, ...saved, profileId: savedId });
      toast.success('Profile updated successfully.');
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        'Failed to save profile.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestEmailChange = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    try {
      await authAPI.requestEmailChange(user.email, newEmail);
      toast.success('OTP sent to new email!');
      setEmailStep(2);
    } catch (err) {
      toast.error(typeof err.response?.data === 'string' ? err.response.data : 'Failed to request email change.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailChange = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    try {
      await authAPI.verifyEmailChange(user.email, emailOtp);
      toast.success('Email successfully updated! Please sign in again.');
      logout();
    } catch (err) {
      toast.error(typeof err.response?.data === 'string' ? err.response.data : 'Failed to verify OTP.');
    } finally {
      setEmailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page page">
        <div className="container profile-container">
          <div className="profile-card card profile-loading">Loading your profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page page">
      <div className="container profile-container">
        <div className="profile-header">
          <h1 className="section-title">My Profile</h1>
          <p className="section-sub">Keep your details up to date for better opportunities.</p>
        </div>

        <form className="profile-card card" onSubmit={handleSave}>
          <div className="profile-grid">
            <label className="profile-field">
              <span>Full Name</span>
              <input value={form.fullName} onChange={onChange('fullName')} required />
            </label>

            <label className="profile-field">
              <span>Email</span>
              <input value={user?.email || ''} disabled />
            </label>

            <label className="profile-field">
              <span>Phone</span>
              <input value={form.phone} onChange={onChange('phone')} placeholder="+91 98765 43210" />
            </label>

            <label className="profile-field">
              <span>Location</span>
              <input value={form.location} onChange={onChange('location')} placeholder="City, Country" />
            </label>

            <label className="profile-field profile-field-full">
              <span>Headline</span>
              <input value={form.headline} onChange={onChange('headline')} placeholder="Frontend Engineer | React" />
            </label>

            <label className="profile-field profile-field-full">
              <span>Bio</span>
              <textarea
                value={form.bio}
                onChange={onChange('bio')}
                rows={4}
                placeholder="Tell recruiters about your background and goals."
              />
            </label>

            <label className="profile-field profile-field-full">
              <span>Skills (comma separated)</span>
              <input
                value={form.skills}
                onChange={onChange('skills')}
                placeholder="React, JavaScript, REST APIs"
              />
            </label>

            {role === 'CANDIDATE' && !getProfileId(profile) && (
              <label className="profile-field profile-field-full">
                <span>Resume (PDF or DOCX)</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  required
                />
              </label>
            )}

            {role === 'RECRUITER' && (
              <>
                <label className="profile-field">
                  <span>Company Name</span>
                  <input value={form.companyName} onChange={onChange('companyName')} />
                </label>

                <label className="profile-field">
                  <span>Company Website</span>
                  <input value={form.website} onChange={onChange('website')} placeholder="https://example.com" />
                </label>
              </>
            )}
          </div>

          <div className="profile-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        <div className="profile-card card" style={{ marginTop: 20 }}>
          <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 8 }}>
            Account Security
          </h2>
          
          {emailStep === 0 && (
            <div style={{ marginBottom: '16px' }}>
              <p className="section-sub" style={{ marginBottom: 12 }}>
                Current Email: <strong>{user?.email}</strong>
              </p>
              <button type="button" className="btn btn-ghost" onClick={() => setEmailStep(1)}>
                Change Email Address
              </button>
            </div>
          )}

          {emailStep === 1 && (
            <form onSubmit={handleRequestEmailChange} style={{ marginBottom: '16px', maxWidth: '400px' }}>
              <label className="profile-field">
                <span>New Email Address</span>
                <input 
                  type="email" 
                  value={newEmail} 
                  onChange={(e) => setNewEmail(e.target.value)} 
                  required 
                  placeholder="new@example.com"
                />
              </label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" disabled={emailLoading}>
                  {emailLoading ? 'Sending...' : 'Send OTP'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEmailStep(0)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {emailStep === 2 && (
            <form onSubmit={handleVerifyEmailChange} style={{ marginBottom: '16px', maxWidth: '400px' }}>
              <p className="section-sub" style={{ marginBottom: 12 }}>
                Enter the OTP sent to <strong>{newEmail}</strong>
              </p>
              <label className="profile-field">
                <span>Verification Code</span>
                <input 
                  type="text" 
                  value={emailOtp} 
                  onChange={(e) => setEmailOtp(e.target.value)} 
                  required 
                  maxLength={6}
                  style={{ letterSpacing: '0.2em' }}
                />
              </label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" disabled={emailLoading}>
                  {emailLoading ? 'Verifying...' : 'Verify & Update'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEmailStep(1)}>
                  Back
                </button>
              </div>
            </form>
          )}
        </div>

        {role === 'CANDIDATE' && getProfileId(profile) && (
          <div className="profile-card card" style={{ marginTop: 20 }}>
            <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 8 }}>
              Resume
            </h2>
            <p className="section-sub" style={{ marginBottom: 12 }}>
              View the file you uploaded when you created your candidate profile (opens on the API server,
              not example.com).
            </p>
            <a
              href={getProfileResumeDownloadUrl(getProfileId(profile))}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              View resume (PDF/DOC)
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
