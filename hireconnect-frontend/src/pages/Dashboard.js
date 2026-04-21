import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI, applicationAPI, jobAPI, notificationAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/errorMessage';
import './Dashboard.css';

const STATUS_COLORS = {
  Applied: 'blue', Shortlisted: 'yellow',
  'Interview Scheduled': 'purple', Offered: 'green', Rejected: 'red',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [pendingRecruiters, setPendingRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [jobsById, setJobsById] = useState({});
  const [userName, setUserName] = useState('');

  const authUserId = user?.userId != null ? Number(user.userId) : null;
  const profilePk =
    user?.profileId != null
      ? Number(user.profileId)
      : user?.id != null
        ? Number(user.id)
        : user?.candidateId != null
          ? Number(user.candidateId)
          : null;
  const notifUserId = user?.userId ?? user?.profileId ?? user?.id ?? null;
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';

  const [allCandidates, setAllCandidates] = useState([]);
  const [allRecruiters, setAllRecruiters] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [adminTab, setAdminTab] = useState('approvals');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (isAdmin) {
          const [
            pendingRes,
            candidatesRes,
            recruitersRes,
            subsRes,
            jobsRes,
            appsRes
          ] = await Promise.all([
            adminAPI.getPendingRecruiters().catch(() => ({ data: [] })),
            adminAPI.getAllUsers('CANDIDATE').catch(() => ({ data: [] })),
            adminAPI.getAllUsers('RECRUITER').catch(() => ({ data: [] })),
            import('../api').then(m => m.subscriptionAPI.getAll()).catch(() => ({ data: [] })),
            jobAPI.getAllJobs().catch(() => ({ data: [] })),
            applicationAPI.getAll().catch(() => ({ data: [] }))
          ]);

          setPendingRecruiters(Array.isArray(pendingRes.data) ? pendingRes.data : []);
          setAllCandidates(Array.isArray(candidatesRes.data) ? candidatesRes.data : []);
          setAllRecruiters((Array.isArray(recruitersRes.data) ? recruitersRes.data : []).filter(r => r.status !== 'PENDING_APPROVAL'));
          setAllSubscriptions(Array.isArray(subsRes.data) ? subsRes.data : []);
          setAllJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
          setAllApps(Array.isArray(appsRes.data) ? appsRes.data : []);
          return;
        }

        const candidateIds = [
          ...new Set(
            [authUserId, profilePk].filter((x) => x != null && !Number.isNaN(x))
          ),
        ];

        const appsPromise =
          candidateIds.length === 0
            ? Promise.resolve([])
            : Promise.all(
                candidateIds.map((cid) =>
                  applicationAPI.getByCandidate(cid).catch(() => ({ data: [] }))
                )
              ).then((responses) => {
                const merged = new Map();
                responses.forEach((r) => {
                  const list = Array.isArray(r.data) ? r.data : [];
                  list.forEach((a) => {
                    const key = a.applicationId ?? `${a.candidateId}-${a.jobId}`;
                    merged.set(key, a);
                  });
                });
                const arr = [...merged.values()];
                arr.sort((a, b) => {
                  const da = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
                  const db = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
                  return db - da;
                });
                return arr;
              });

        const jobsPromise = jobAPI.getAllJobs().catch(() => ({ data: [] }));

        const notifsPromise =
          notifUserId == null
            ? Promise.resolve({ data: [] })
            : notificationAPI.getByUser(notifUserId).catch(() => ({ data: [] }));

        const [appsList, jobsRes, notifsRes] = await Promise.all([
          appsPromise,
          jobsPromise,
          notifsPromise,
        ]);

        setApplications(Array.isArray(appsList) ? appsList : []);
        const jobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
        const lookup = {};
        jobs.forEach((j) => {
          lookup[j.jobId] = j;
        });
        setJobsById(lookup);
        setNotifications(Array.isArray(notifsRes.data) ? notifsRes.data : []);
        
        // Fetch profile to get the full name
        try {
          const profileRes = await import('../api').then(m => m.profileAPI.getMyProfile());
          if (profileRes?.data?.fullName) {
             setUserName(profileRes.data.fullName);
          } else if (profileRes?.data?.name) {
             setUserName(profileRes.data.name);
          }
        } catch (e) {
          console.warn('Failed to fetch profile name');
        }
        
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isAdmin, authUserId, profilePk, notifUserId]);

  const markRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const withdrawApp = async (id) => {
    try {
      await applicationAPI.withdrawApplication(id);
      setApplications(prev => prev.filter(a => a.applicationId !== id));
      toast.success('Application withdrawn');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to withdraw'));
    }
  };

  const getRecruiterId = (recruiter) => recruiter.profileId || recruiter.recruiterId || recruiter.id || recruiter.userId;

  const decideRecruiter = async (recruiter, decision) => {
    const recruiterId = getRecruiterId(recruiter);
    if (!recruiterId) {
      toast.error('Recruiter id missing from server response');
      return;
    }

    setActionId(`${decision}-${recruiterId}`);
    try {
      if (decision === 'approve') {
        await adminAPI.approveRecruiter(recruiterId);
        toast.success('Recruiter approved. OTP email sent.');
      } else {
        await adminAPI.rejectRecruiter(recruiterId);
        toast.success('Recruiter rejected.');
      }
      setPendingRecruiters(prev => prev.filter(item => getRecruiterId(item) !== recruiterId));
    } catch (err) {
      const data = err.response?.data;
      toast.error(typeof data === 'string' ? data : data?.message || `Failed to ${decision} recruiter`);
    } finally {
      setActionId(null);
    }
  };

  const stats = [
    { label: 'Total Applied', value: applications.length, icon: '📋' },
    { label: 'Shortlisted', value: applications.filter(a => a.status === 'Shortlisted').length, icon: '⭐' },
    { label: 'Interviews', value: applications.filter(a => a.status === 'Interview Scheduled').length, icon: '🗓️' },
    { label: 'Offers', value: applications.filter(a => a.status === 'Offered').length, icon: '🎉' },
  ];

  if (loading) return (
    <div className="dashboard-page page">
      <div className="container dash-container">
        <div className="dash-loading">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
          ))}
        </div>
      </div>
    </div>
  );

  if (isAdmin) return (
    <div className="dashboard-page page admin-dashboard">
      <div className="container dash-container">
        <div className="dash-header fade-in" style={{ marginBottom: '24px' }}>
          <div>
            <h1 className="section-title">Admin Command Center</h1>
            <p className="section-sub">System-wide overview and management</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setLoading(true);
              Promise.all([
                adminAPI.getPendingRecruiters().catch(() => ({ data: [] })),
                adminAPI.getAllUsers('CANDIDATE').catch(() => ({ data: [] })),
                adminAPI.getAllUsers('RECRUITER').catch(() => ({ data: [] })),
                import('../api').then(m => m.subscriptionAPI.getAll()).catch(() => ({ data: [] })),
                jobAPI.getAllJobs().catch(() => ({ data: [] })),
                applicationAPI.getAll().catch(() => ({ data: [] }))
              ]).then(([p, c, r, s, j, a]) => {
                setPendingRecruiters(Array.isArray(p.data) ? p.data : []);
                setAllCandidates(Array.isArray(c.data) ? c.data : []);
                setAllRecruiters((Array.isArray(r.data) ? r.data : []).filter(x => x.status !== 'PENDING_APPROVAL'));
                setAllSubscriptions(Array.isArray(s.data) ? s.data : []);
                setAllJobs(Array.isArray(j.data) ? j.data : []);
                setAllApps(Array.isArray(a.data) ? a.data : []);
              }).finally(() => setLoading(false));
            }}
          >
            Refresh Data
          </button>
        </div>

        {/* Global Quick Stats */}
        <div className="dash-stats fade-in" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '32px' }}>
          <div className="stat-card card">
            <div className="stat-icon" style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308' }}>⌛</div>
            <div className="stat-value">{pendingRecruiters.length}</div>
            <div className="stat-label">Pending Approvals</div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>👥</div>
            <div className="stat-value">{allCandidates.length}</div>
            <div className="stat-label">Total Candidates</div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>🏢</div>
            <div className="stat-value">{allRecruiters.length}</div>
            <div className="stat-label">Total Recruiters</div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>💼</div>
            <div className="stat-value">{allJobs.length}</div>
            <div className="stat-label">Jobs Posted</div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon" style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}>📝</div>
            <div className="stat-value">{allApps.length}</div>
            <div className="stat-label">Applications</div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>💳</div>
            <div className="stat-value">{allSubscriptions.length}</div>
            <div className="stat-label">Subscriptions</div>
          </div>
        </div>

        {/* Admin Tabs Navigation */}
        <div className="admin-tabs" style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
          {[
            { id: 'approvals', label: `Pending Approvals (${pendingRecruiters.length})` },
            { id: 'recruiters', label: `Recruiters (${allRecruiters.length})` },
            { id: 'candidates', label: `Candidates (${allCandidates.length})` },
            { id: 'jobs', label: `Jobs (${allJobs.length})` },
            { id: 'subscriptions', label: `Subscriptions (${allSubscriptions.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              className={`btn ${adminTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAdminTab(tab.id)}
              style={{ borderRadius: '20px', padding: '8px 16px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="admin-tab-content">
          
          {adminTab === 'approvals' && (
            <div className="fade-in">
              {pendingRecruiters.length === 0 ? (
                <div className="dash-empty card">
                  <div className="dash-empty-icon">✅</div>
                  <p>No recruiter applications are waiting for review.</p>
                </div>
              ) : (
                <div className="approval-list">
                  {pendingRecruiters.map((recruiter) => {
                    const recruiterId = getRecruiterId(recruiter);
                    return (
                      <div key={recruiterId || recruiter.email} className="approval-item card">
                        <div className="approval-main">
                          <div>
                            <h3>{recruiter.fullName || recruiter.name || recruiter.email}</h3>
                            <p>{recruiter.email}</p>
                          </div>
                          <span className="badge badge-yellow">{recruiter.status || 'PENDING_APPROVAL'}</span>
                        </div>
                        <div className="approval-actions" style={{ marginTop: '16px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={!!actionId}
                            onClick={() => decideRecruiter(recruiter, 'approve')}
                          >
                            {actionId === `approve-${recruiterId}` ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={!!actionId}
                            onClick={() => decideRecruiter(recruiter, 'reject')}
                          >
                            {actionId === `reject-${recruiterId}` ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {adminTab === 'recruiters' && (
            <div className="fade-in card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>ID</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Email</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Status</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {allRecruiters.map(r => (
                    <tr key={r.userId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', color: 'var(--text3)' }}>#{r.userId}</td>
                      <td style={{ padding: '12px', color: 'var(--text)', fontWeight: 500 }}>{r.email}</td>
                      <td style={{ padding: '12px' }}><span className={`badge badge-${r.status === 'ACTIVE' ? 'green' : 'gray'}`}>{r.status}</span></td>
                      <td style={{ padding: '12px', color: 'var(--text2)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {allRecruiters.length === 0 && <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>No recruiters found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {adminTab === 'candidates' && (
            <div className="fade-in card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>ID</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Email</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Status</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {allCandidates.map(c => (
                    <tr key={c.userId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', color: 'var(--text3)' }}>#{c.userId}</td>
                      <td style={{ padding: '12px', color: 'var(--text)', fontWeight: 500 }}>{c.email}</td>
                      <td style={{ padding: '12px' }}><span className={`badge badge-${c.status === 'ACTIVE' ? 'green' : 'gray'}`}>{c.status}</span></td>
                      <td style={{ padding: '12px', color: 'var(--text2)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {allCandidates.length === 0 && <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>No candidates found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {adminTab === 'jobs' && (
            <div className="fade-in card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Job ID</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Title</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Company</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Recruiter ID</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Apps Count</th>
                  </tr>
                </thead>
                <tbody>
                  {allJobs.map(j => {
                    const jobApps = allApps.filter(a => a.jobId === j.jobId).length;
                    return (
                    <tr key={j.jobId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', color: 'var(--text3)' }}>#{j.jobId}</td>
                      <td style={{ padding: '12px', color: 'var(--text)', fontWeight: 500 }}>{j.title}</td>
                      <td style={{ padding: '12px', color: 'var(--text2)' }}>{j.company}</td>
                      <td style={{ padding: '12px', color: 'var(--text3)' }}>{j.postedBy || 'N/A'}</td>
                      <td style={{ padding: '12px' }}><span className="badge badge-blue">{jobApps}</span></td>
                    </tr>
                  )})}
                  {allJobs.length === 0 && <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center' }}>No jobs found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {adminTab === 'subscriptions' && (
            <div className="fade-in card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Sub ID</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Recruiter ID</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Plan Code</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Status</th>
                    <th style={{ padding: '12px', color: 'var(--text)' }}>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {allSubscriptions.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', color: 'var(--text3)' }}>#{s.id}</td>
                      <td style={{ padding: '12px', color: 'var(--text2)' }}>#{s.recruiterId}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: s.planCode === 'ENTERPRISE' ? '#a855f7' : '#3b82f6' }}>{s.planCode}</td>
                      <td style={{ padding: '12px' }}><span className={`badge badge-${s.status === 'ACTIVE' ? 'green' : 'gray'}`}>{s.status}</span></td>
                      <td style={{ padding: '12px', color: 'var(--text3)' }}>{s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {allSubscriptions.length === 0 && <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center' }}>No subscriptions found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );

  let displayGreeting = userName || user?.fullName || user?.name || user?.email || '';
  if (displayGreeting && displayGreeting.includes('@')) {
    displayGreeting = displayGreeting.split('@')[0];
  }

  return (
    <div className="dashboard-page page">
      <div className="container dash-container">
        {/* Header */}
        <div className="dash-header fade-in">
          <div>
            <h1 className="section-title">
              Welcome back{displayGreeting ? `, ${displayGreeting}` : ''} 👋
            </h1>
            <p className="section-sub">Here's your job search activity at a glance</p>
          </div>
          <Link to="/jobs" className="btn btn-primary">Browse Jobs</Link>
        </div>

        {/* Stats */}
        <div className="dash-stats fade-in">
          {stats.map(s => (
            <div key={s.label} className="stat-card card">
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="dash-grid">
          {/* Applications */}
          <div className="dash-col">
            <div className="dash-section-header">
              <h2 className="dash-section-title">My Applications</h2>
              <span className="badge badge-gray">{applications.length} total</span>
            </div>

            {applications.length === 0 ? (
              <div className="dash-empty card">
                <div className="dash-empty-icon">📝</div>
                <p>No applications yet.</p>
                <Link to="/jobs" className="btn btn-primary">Find Jobs</Link>
              </div>
            ) : (
              <div className="app-list">
                {applications.map((app) => {
                  const job = jobsById[app.jobId];
                  const title = job?.title || `Job #${app.jobId}`;
                  const meta = [job?.location, job?.type, job?.category].filter(Boolean).join(' · ');
                  return (
                  <div key={app.applicationId} className="app-item card">
                    <div className="app-item-top">
                      <div className="app-job-info">
                        <div className="app-job-title">{title} <span style={{fontSize: '0.85em', color: '#94a3b8', fontWeight: 'normal'}}>at {job?.company || 'Unknown Company'}</span></div>
                        {meta && <div className="app-job-meta">{meta}</div>}
                        <div className="app-date">Applied: {app.appliedAt || '—'}</div>
                      </div>
                    </div>
                    
                    {/* Visual Progress Timeline */}
                    <div className="app-timeline-container">
                      {app.status === 'Rejected' || app.status === 'Withdrawn' ? (
                        <div className={`app-timeline-divergent badge-${app.status === 'Rejected' ? 'red' : 'gray'}`}>
                          Application {app.status}
                        </div>
                      ) : (
                        <div className="app-timeline">
                          {['Applied', 'Shortlisted', 'Interview Scheduled', 'Offered'].map((step, idx, arr) => {
                             const currentIdx = arr.indexOf(app.status) >= 0 ? arr.indexOf(app.status) : 0;
                             const isCompleted = idx <= currentIdx;
                             const isActive = idx === currentIdx;
                             return (
                               <div key={step} className={`timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                                 <div className="timeline-circle"></div>
                                 <div className="timeline-label">{step}</div>
                                 {idx < arr.length - 1 && <div className="timeline-line"></div>}
                               </div>
                             );
                          })}
                        </div>
                      )}
                    </div>

                    {app.coverLetter && (
                      <p className="app-cover">{app.coverLetter.slice(0, 80)}{app.coverLetter.length > 80 ? '…' : ''}</p>
                    )}
                    <div className="app-actions">
                      <Link to={`/jobs/${app.jobId}`} className="btn btn-ghost btn-sm">View Job</Link>
                      {app.status === 'Applied' && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => withdrawApp(app.applicationId)}
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="dash-col">
            <div className="dash-section-header">
              <h2 className="dash-section-title">Notifications</h2>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="badge badge-red">
                  {notifications.filter(n => !n.read).length} unread
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="dash-empty card">
                <div className="dash-empty-icon">🔔</div>
                <p>No notifications yet.</p>
              </div>
            ) : (
              <div className="notif-list">
                {notifications.slice(0, 10).map(n => (
                  <div
                    key={n.id || n.notificationId}
                    className={`notif-item card ${!n.read ? 'unread' : ''}`}
                    onClick={() => !n.read && markRead(n.id || n.notificationId)}
                  >
                    <div className="notif-top">
                      <span className="notif-type badge badge-blue">{n.type}</span>
                      {!n.read && <span className="notif-dot" />}
                    </div>
                    {(() => {
                      if (!n.message) return null;
                      const parts = n.message.split('|');
                      if (parts.length > 1) {
                        const header = parts[0];
                        const details = parts.slice(1);
                        return (
                          <div className="notif-structured-message">
                            <p className="notif-header" style={{ fontWeight: 600, marginBottom: '8px', color: '#fff' }}>{header}</p>
                            <div className="notif-details-grid" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              {details.map((detail, idx) => {
                                const colonIdx = detail.indexOf(':');
                                if (colonIdx > 0) {
                                  const key = detail.substring(0, colonIdx).trim();
                                  let value = detail.substring(colonIdx + 1).trim();
                                  if (value.startsWith('http')) {
                                    value = <a href={value} target="_blank" rel="noreferrer" style={{ color: '#4facfe', textDecoration: 'underline' }}>{value}</a>;
                                  }
                                  return (
                                    <React.Fragment key={idx}>
                                      <span style={{ color: '#8892b0', fontWeight: 500 }}>{key}:</span>
                                      <span style={{ color: '#ccd6f6' }}>{value}</span>
                                    </React.Fragment>
                                  );
                                }
                                return <span key={idx} style={{ gridColumn: '1 / -1', color: '#ccd6f6' }}>{detail}</span>;
                              })}
                            </div>
                          </div>
                        );
                      }
                      return <p className="notif-message" style={{ whiteSpace: 'pre-line', color: '#ccd6f6' }}>{n.message}</p>;
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
