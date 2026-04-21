import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { jobAPI, applicationAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/errorMessage';
import './JobDetail.css';

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [appCount, setAppCount] = useState(0);
  const [appForm, setAppForm] = useState({ coverLetter: '', resumeUrl: '' });
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [myApplication, setMyApplication] = useState(null);
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const role = String(user?.role || '').replace(/^ROLE_/, '').toUpperCase();
  const isCandidate = role === 'CANDIDATE';

  const candidateId =
    user?.profileId ?? user?.id ?? user?.candidateId ?? user?.userId ?? null;
  const authUserId = user?.userId != null ? Number(user.userId) : null;
  const profilePk =
    user?.profileId != null
      ? Number(user.profileId)
      : user?.id != null
        ? Number(user.id)
        : user?.candidateId != null
          ? Number(user.candidateId)
          : null;

  useEffect(() => {
    jobAPI.getJobById(id)
      .then(r => setJob(r.data))
      .catch(() => toast.error('Job not found'))
      .finally(() => setLoading(false));

    applicationAPI.getApplicationCount(id)
      .then(r => setAppCount(r.data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!isLoggedIn || !isCandidate || !id) {
      setAlreadyApplied(false);
      return;
    }
    if (
      (authUserId == null || Number.isNaN(authUserId)) &&
      (profilePk == null || Number.isNaN(profilePk))
    ) {
      setAlreadyApplied(false);
      return;
    }
    let cancelled = false;
    applicationAPI
      .getByJob(Number(id))
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        const myApp = list.find((a) => {
          const cid = Number(a.candidateId ?? a.candidate_id);
          if (Number.isNaN(cid)) return false;
          const mine =
            (profilePk != null && !Number.isNaN(profilePk) && cid === profilePk) ||
            (authUserId != null && !Number.isNaN(authUserId) && cid === authUserId);
          return mine && String(a.status || '').toLowerCase() !== 'withdrawn';
        });
        if (!cancelled) {
          setAlreadyApplied(!!myApp);
          setMyApplication(myApp || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAlreadyApplied(false);
          setMyApplication(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, isLoggedIn, isCandidate, authUserId, profilePk]);

  const handleApply = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) { navigate('/login'); return; }
    if (!isCandidate) {
      toast.error('Only candidates can apply for jobs.');
      return;
    }

    if (!candidateId) {
      toast.error('Candidate profile is missing. Please complete your profile first.');
      return;
    }

    setApplying(true);
    try {
      await applicationAPI.submitApplication({
        jobId: parseInt(id),
        candidateId,
        coverLetter: appForm.coverLetter,
        resumeUrl: appForm.resumeUrl,
      });
      toast.success('Application submitted successfully! 🎉');
      setShowApplyModal(false);
      setAlreadyApplied(true);
      setMyApplication({ status: 'Applied' });
      setAppCount((c) => c + 1);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to submit application'));
    } finally {
      setApplying(false);
    }
  };

  if (loading) return (
    <div className="job-detail-page page">
      <div className="container" style={{ paddingTop: 100 }}>
        <div className="skeleton" style={{ height: 40, width: '50%', marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 20, width: '30%', marginBottom: 40 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    </div>
  );

  if (!job) return (
    <div className="job-detail-page page">
      <div className="container" style={{ paddingTop: 120, textAlign: 'center' }}>
        <h2>Job not found</h2>
        <Link to="/jobs" className="btn btn-primary" style={{ marginTop: 20 }}>Back to Jobs</Link>
      </div>
    </div>
  );

  return (
    <div className="job-detail-page page">
      <div className="container">
        <div className="jd-layout">
          {/* Main */}
          <div className="jd-main fade-in">
            <Link to="/jobs" className="jd-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Back to Jobs
            </Link>

            <div className="jd-header card">
              <div className="jd-header-top">
                <div className="jd-company-icon">
                  {(job.title?.[0] || 'J').toUpperCase()}
                </div>
                <div className="jd-title-block">
                  <h1 className="jd-title">{job.title}</h1>
                  <div className="jd-company" style={{ fontSize: '1.2rem', color: '#6366f1', marginBottom: '12px', fontWeight: 500 }}>
                    🏢 {job.company || 'Unknown Company'}
                  </div>
                  <div className="jd-meta-row">
                    {job.location && (
                      <span className="jd-meta-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                          <circle cx="12" cy="9" r="2.5"/>
                        </svg>
                        {job.location}
                      </span>
                    )}
                    {job.postedAt && (
                      <span className="jd-meta-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        Posted {job.postedAt}
                      </span>
                    )}
                    <span className="jd-meta-item">
                      👥 {appCount} applicants
                    </span>
                  </div>
                </div>
                <span className={`badge badge-${job.status === 'OPEN' ? 'green' : 'red'}`} style={{ marginLeft: 'auto' }}>
                  {job.status}
                </span>
              </div>

              <div className="jd-tags-row">
                {job.type && <span className="badge badge-blue">{job.type}</span>}
                {job.category && <span className="badge badge-purple">{job.category}</span>}
                {job.experienceRequired > 0 && (
                  <span className="badge badge-gray">{job.experienceRequired}+ yrs exp</span>
                )}
              </div>
            </div>

            {/* Description */}
            {job.description && (
              <div className="jd-section card">
                <h2 className="jd-section-title">About this Role</h2>
                <p className="jd-description">{job.description}</p>
              </div>
            )}

            {/* Skills */}
            {job.skills?.length > 0 && (
              <div className="jd-section card">
                <h2 className="jd-section-title">Required Skills</h2>
                <div className="jd-skills">
                  {job.skills.map(s => (
                    <span key={s} className="jd-skill-tag">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="jd-sidebar">
            <div className="jd-apply-card card">
              {job.salaryMin && job.salaryMax && (
                <div className="jd-salary">
                  <div className="jd-salary-label">Salary Range</div>
                  <div className="jd-salary-value">
                    ₹{(job.salaryMin / 1000).toFixed(0)}K – ₹{(job.salaryMax / 1000).toFixed(0)}K/yr
                  </div>
                </div>
              )}

              <div className="jd-info-list">
                {job.type && (
                  <div className="jd-info-item">
                    <span className="jd-info-label">Job Type</span>
                    <span className="jd-info-value">{job.type}</span>
                  </div>
                )}
                {job.category && (
                  <div className="jd-info-item">
                    <span className="jd-info-label">Category</span>
                    <span className="jd-info-value">{job.category}</span>
                  </div>
                )}
                {job.experienceRequired > 0 && (
                  <div className="jd-info-item">
                    <span className="jd-info-label">Experience</span>
                    <span className="jd-info-value">{job.experienceRequired}+ years</span>
                  </div>
                )}
              </div>

              {job.status === 'OPEN' && isCandidate && alreadyApplied ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      padding: '13px',
                      cursor: 'default',
                      border: '1px solid var(--border)',
                      color: 'var(--text2)',
                    }}
                    disabled
                  >
                    You have applied for this job
                  </button>
                  {myApplication && (
                    <div className="jd-app-timeline-container" style={{ marginTop: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 12, backgroundColor: '#f8fafc' }}>
                      <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text1)', textAlign: 'center' }}>Application Status Tracker</h4>
                      {myApplication.status === 'Rejected' || myApplication.status === 'Withdrawn' ? (
                        <div style={{ textAlign: 'center', fontWeight: 'bold', color: myApplication.status === 'Rejected' ? '#ef4444' : '#64748b' }}>
                          Status: {myApplication.status}
                        </div>
                      ) : (
                        <div className="app-timeline" style={{ flexDirection: 'column', gap: '20px' }}>
                          {['Applied', 'Shortlisted', 'Interview Scheduled', 'Offered'].map((step, idx, arr) => {
                             const currentIdx = arr.indexOf(myApplication.status) >= 0 ? arr.indexOf(myApplication.status) : 0;
                             const isCompleted = idx <= currentIdx;
                             const isActive = idx === currentIdx;
                             return (
                               <div key={step} className={`timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`} style={{ flexDirection: 'row', alignItems: 'center', minHeight: '30px' }}>
                                 <div className="timeline-circle" style={{ flexShrink: 0 }}></div>
                                 <div className="timeline-label" style={{ marginLeft: '12px', fontSize: '13px', textAlign: 'left', fontWeight: isActive ? '600' : '500', color: isCompleted ? 'var(--accent)' : 'var(--text3)', marginTop: 0 }}>{step}</div>
                                 {idx < arr.length - 1 && <div className="timeline-line" style={{ height: '20px', width: '2px', top: '100%', left: '10px', right: 'auto', bottom: 'auto', zIndex: 0 }}></div>}
                               </div>
                             );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : job.status === 'OPEN' && isCandidate ? (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
                  onClick={() => (isLoggedIn ? setShowApplyModal(true) : navigate('/login'))}
                >
                  Apply Now
                </button>
              ) : job.status === 'OPEN' && isLoggedIn && !isCandidate ? (
                <div className="jd-closed-notice">Recruiter/Admin accounts cannot apply for jobs.</div>
              ) : (
                <div className="jd-closed-notice">This position is no longer accepting applications.</div>
              )}

              {!isLoggedIn && (
                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text3)', marginTop: 10 }}>
                  <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link> to apply
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="modal fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Apply for {job.title}</h2>
              <button className="modal-close" onClick={() => setShowApplyModal(false)}>✕</button>
            </div>
            <form onSubmit={handleApply}>
              <div className="form-group">
                <label>Resume URL</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/your-resume"
                  value={appForm.resumeUrl}
                  onChange={e => setAppForm({ ...appForm, resumeUrl: e.target.value })}
                />
                {!appForm.resumeUrl && user?.resumeUrl && (
                  <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text3)' }}>
                    Using profile resume: {user.resumeUrl}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Cover Letter</label>
                <textarea
                  rows={5}
                  placeholder="Tell the recruiter why you're a great fit for this role…"
                  value={appForm.coverLetter}
                  onChange={e => setAppForm({ ...appForm, coverLetter: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowApplyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={applying}>
                  {applying ? <span className="spinner" /> : null}
                  {applying ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
