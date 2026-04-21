import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { jobAPI, applicationAPI, interviewAPI, normalizeResumeLink } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/errorMessage';
import './Recruiter.css';

const STATUS_OPTIONS = ['Applied', 'Shortlisted', 'Interview Scheduled', 'Offered', 'Rejected'];

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [candidateNames, setCandidateNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showScheduleFor, setShowScheduleFor] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [interviewsByApp, setInterviewsByApp] = useState({});
  const [loadingInterviews, setLoadingInterviews] = useState({});
  const [expandedInterviews, setExpandedInterviews] = useState({});
  const [rescheduleTimes, setRescheduleTimes] = useState({});
  const [scheduleForm, setScheduleForm] = useState({
    scheduledAt: '',
    mode: 'ONLINE',
    meetLink: '',
    location: '',
    notes: '',
  });
  const [jobForm, setJobForm] = useState({
    title: '', company: '', category: '', type: '', location: '', description: '',
    salaryMin: '', salaryMax: '', experienceRequired: '', skills: '',
    postedBy: user?.profileId || user?.userId || 1,
  });
  const [saving, setSaving] = useState(false);

  const recruiterId = user?.profileId || user?.userId || 1;

  useEffect(() => {
    jobAPI.getAllJobs()
      .then(r => {
        const mine = (r.data || []).filter(j => Number(j.postedBy) === Number(recruiterId));
        setJobs(mine);
        if (mine.length > 0) {
          loadApplications(mine[0].jobId);
        }
      })
      .catch(() => toast.error('Failed to load jobs'))
      .finally(() => setLoading(false));
  }, [recruiterId]);

  const loadApplications = async (jobId) => {
    setSelectedJob(jobId);
    try {
      const res = await applicationAPI.getByJob(jobId);
      const apps = res.data || [];
      setApplications(apps);
      
      const uniqueCids = [...new Set(apps.map(a => Number(a.candidateId || a.candidate_id)))].filter(id => !Number.isNaN(id) && id > 0);
      uniqueCids.forEach(cid => {
         import('../api').then(m => m.profileAPI.getProfileById(cid))
           .then(pRes => {
              const name = pRes.data?.fullName || pRes.data?.name || pRes.data?.email;
              if (name) {
                 setCandidateNames(prev => ({ ...prev, [cid]: name }));
              }
           })
           .catch(() => {});
      });
    } catch {
      toast.error('Failed to load applications');
    }
  };

  const handlePostJob = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...jobForm,
        salaryMin: parseFloat(jobForm.salaryMin) || 0,
        salaryMax: parseFloat(jobForm.salaryMax) || 0,
        experienceRequired: parseInt(jobForm.experienceRequired) || 0,
        skills: jobForm.skills.split(',').map(s => s.trim()).filter(Boolean),
        postedBy: recruiterId,
      };
      const res = await jobAPI.addJob(payload);
      setJobs(prev => [res.data, ...prev]);
      toast.success('Job posted successfully! 🎉');
      setShowJobModal(false);
      setJobForm({ title: '', company: '', category: '', type: '', location: '', description: '', salaryMin: '', salaryMax: '', experienceRequired: '', skills: '', postedBy: recruiterId });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to post job'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJob = async (id) => {
    if (!window.confirm('Delete this job?')) return;
    try {
      await jobAPI.deleteJob(id);
      setJobs(prev => prev.filter(j => j.jobId !== id));
      if (selectedJob === id) { setSelectedJob(null); setApplications([]); }
      toast.success('Job deleted');
    } catch {
      toast.error('Failed to delete job');
    }
  };

  const handleStatusChange = async (appId, status) => {
    try {
      await applicationAPI.updateStatus(appId, status);
      setApplications(prev => prev.map(a => a.applicationId === appId ? { ...a, status } : a));
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleScheduleInterview = async (app) => {
    if (!scheduleForm.scheduledAt) {
      toast.error('Please select date and time for interview');
      return;
    }

    setScheduling(true);
    try {
      await interviewAPI.schedule({
        applicationId: app.applicationId,
        scheduledAt: scheduleForm.scheduledAt,
        mode: scheduleForm.mode,
        meetLink: scheduleForm.mode === 'ONLINE' ? scheduleForm.meetLink : '',
        location: scheduleForm.mode === 'OFFLINE' ? scheduleForm.location : '',
        notes: scheduleForm.notes,
      });

      await applicationAPI.updateStatus(app.applicationId, 'Interview Scheduled');
      setApplications(prev => prev.map(a => a.applicationId === app.applicationId ? { ...a, status: 'Interview Scheduled' } : a));
      toast.success('Interview scheduled successfully');
      setShowScheduleFor(null);
      setScheduleForm({ scheduledAt: '', mode: 'ONLINE', meetLink: '', location: '', notes: '' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to schedule interview'));
    } finally {
      setScheduling(false);
    }
  };

  const loadInterviews = async (appId) => {
    setLoadingInterviews(prev => ({ ...prev, [appId]: true }));
    try {
      const res = await interviewAPI.getByApplication(appId);
      setInterviewsByApp(prev => ({ ...prev, [appId]: res.data || [] }));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load interviews'));
    } finally {
      setLoadingInterviews(prev => ({ ...prev, [appId]: false }));
    }
  };

  const toggleInterviews = (appId) => {
    setExpandedInterviews(prev => {
      const next = !prev[appId];
      if (next && !interviewsByApp[appId]) {
        loadInterviews(appId);
      }
      return { ...prev, [appId]: next };
    });
  };

  const handleConfirmInterview = async (interviewId) => {
    try {
      await interviewAPI.confirm(interviewId);
      toast.success('Interview confirmed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to confirm interview'));
    }
  };

  const handleRescheduleInterview = async (interviewId) => {
    const newTime = rescheduleTimes[interviewId];
    if (!newTime) {
      toast.error('Please select a new time');
      return;
    }
    try {
      await interviewAPI.reschedule(interviewId, newTime);
      toast.success('Interview rescheduled');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reschedule interview'));
    }
  };

  const handleCancelInterview = async (interviewId) => {
    try {
      await interviewAPI.cancel(interviewId);
      toast.success('Interview cancelled');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel interview'));
    }
  };

  return (
    <div className="recruiter-page page">
      <div className="container">
        <div className="recruiter-header fade-in">
          <div>
            <h1 className="section-title">Recruiter Dashboard</h1>
            <p className="section-sub">Manage your job postings and review applications</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/subscription" className="btn btn-ghost">💎 Subscription</Link>
            <button className="btn btn-primary" onClick={() => setShowJobModal(true)}>
              + Post New Job
            </button>
          </div>
        </div>

        <div className="recruiter-layout">
          {/* Jobs List */}
          <div className="recruiter-jobs">
            <div className="dash-section-header">
              <h2 className="dash-section-title">My Postings</h2>
              <span className="badge badge-gray">{jobs.length} jobs</span>
            </div>

            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 10 }} />
              ))
            ) : jobs.length === 0 ? (
              <div className="dash-empty card">
                <div className="dash-empty-icon">💼</div>
                <p>No jobs posted yet.</p>
                <button className="btn btn-primary" onClick={() => setShowJobModal(true)}>Post Your First Job</button>
              </div>
            ) : (
              jobs.map(job => (
                <div
                  key={job.jobId}
                  className={`recruiter-job-item card ${selectedJob === job.jobId ? 'selected' : ''}`}
                  onClick={() => loadApplications(job.jobId)}
                >
                  <div className="rji-top">
                    <span className="rji-title">{job.title} <span style={{fontSize: '0.8em', color: '#888'}}>at {job.company || 'Unknown Company'}</span></span>
                    <span className={`badge badge-${job.status === 'OPEN' ? 'green' : 'red'}`}>{job.status}</span>
                  </div>
                  <div className="rji-meta">
                    {job.location && <span>{job.location}</span>}
                    {job.type && <span>{job.type}</span>}
                    <span>{job.category}</span>
                  </div>
                  <div className="rji-actions" onClick={e => e.stopPropagation()}>
                    <Link to={`/jobs/${job.jobId}`} className="btn btn-ghost btn-sm">View</Link>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteJob(job.jobId)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Applications Panel */}
          <div className="recruiter-apps">
            {!selectedJob ? (
              <div className="no-job-selected card">
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👈</div>
                <p>Select a job to see its applications</p>
              </div>
            ) : (
              <>
                <div className="dash-section-header">
                  <h2 className="dash-section-title">Applications</h2>
                  <span className="badge badge-blue">{applications.length} total</span>
                </div>

                {applications.length === 0 ? (
                  <div className="dash-empty card">
                    <div className="dash-empty-icon">📭</div>
                    <p>No applications for this job yet.</p>
                  </div>
                ) : (
                  applications.map(app => (
                    <div key={app.applicationId} className="app-review-card card">
                      <div className="arc-top">
                        <div>
                          <div className="arc-candidate">
                            {candidateNames[app.candidateId] 
                              ? (candidateNames[app.candidateId].includes('@') ? candidateNames[app.candidateId].split('@')[0] : candidateNames[app.candidateId]) 
                              : `Candidate #${app.candidateId}`}
                          </div>
                          <div className="arc-date">Applied: {app.appliedAt}</div>
                        </div>
                        <select
                          value={app.status}
                          onChange={e => handleStatusChange(app.applicationId, e.target.value)}
                          className="status-select"
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      {app.coverLetter && (
                        <p className="arc-cover">{app.coverLetter}</p>
                      )}
                      {app.resumeUrl && (
                        <a
                          href={normalizeResumeLink(app.resumeUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ marginTop: 8 }}
                        >
                          📎 View Resume
                        </a>
                      )}

                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {app.status !== 'Interview Scheduled' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setShowScheduleFor(showScheduleFor === app.applicationId ? null : app.applicationId)}
                          >
                            Schedule Interview
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleInterviews(app.applicationId)}
                        >
                          {expandedInterviews[app.applicationId] ? 'Hide Interviews' : 'View Interviews'}
                        </button>
                      </div>

                      {showScheduleFor === app.applicationId && (
                        <div className="card" style={{ marginTop: 10, padding: 12 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div className="form-group">
                              <label>Date & Time</label>
                              <input
                                type="datetime-local"
                                value={scheduleForm.scheduledAt}
                                onChange={e => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Mode</label>
                              <select
                                value={scheduleForm.mode}
                                onChange={e => setScheduleForm({ ...scheduleForm, mode: e.target.value })}
                              >
                                <option value="ONLINE">ONLINE</option>
                                <option value="OFFLINE">OFFLINE</option>
                              </select>
                            </div>
                          </div>

                          {scheduleForm.mode === 'ONLINE' ? (
                            <div className="form-group" style={{ marginTop: 8 }}>
                              <label>Meeting Link</label>
                              <input
                                type="url"
                                placeholder="https://meet.google.com/..."
                                value={scheduleForm.meetLink}
                                onChange={e => setScheduleForm({ ...scheduleForm, meetLink: e.target.value })}
                              />
                            </div>
                          ) : (
                            <div className="form-group" style={{ marginTop: 8 }}>
                              <label>Location</label>
                              <input
                                type="text"
                                placeholder="Office address"
                                value={scheduleForm.location}
                                onChange={e => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                              />
                            </div>
                          )}

                          <div className="form-group" style={{ marginTop: 8 }}>
                            <label>Notes</label>
                            <textarea
                              rows={3}
                              value={scheduleForm.notes}
                              onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                              placeholder="Optional notes"
                            />
                          </div>

                          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowScheduleFor(null)}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={() => handleScheduleInterview(app)} disabled={scheduling}>
                              {scheduling ? 'Scheduling...' : 'Confirm Schedule'}
                            </button>
                          </div>
                        </div>
                      )}

                      {expandedInterviews[app.applicationId] && (
                        <div className="card" style={{ marginTop: 10, padding: 12 }}>
                          {loadingInterviews[app.applicationId] ? (
                            <div>Loading interviews...</div>
                          ) : (interviewsByApp[app.applicationId] || []).length === 0 ? (
                            <div>No interviews scheduled for this application.</div>
                          ) : (
                            (interviewsByApp[app.applicationId] || []).map(interview => (
                              <div key={interview.interviewId} style={{ borderBottom: '1px solid #252e42', paddingBottom: 10, marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                  <div>
                                    <div><strong>Interview #{interview.interviewId}</strong></div>
                                    <div>{interview.scheduledAt || 'Not scheduled'}</div>
                                    <div>{interview.mode || 'ONLINE'}</div>
                                  </div>
                                  <span className="badge badge-blue">{interview.status || 'SCHEDULED'}</span>
                                </div>

                                {interview.meetLink && (
                                  <a href={interview.meetLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }}>
                                    Join Meeting
                                  </a>
                                )}

                                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <input
                                    type="datetime-local"
                                    value={rescheduleTimes[interview.interviewId] || ''}
                                    onChange={e => setRescheduleTimes(prev => ({ ...prev, [interview.interviewId]: e.target.value }))}
                                  />
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleConfirmInterview(interview.interviewId)}>Confirm</button>
                                    <button className="btn btn-primary btn-sm" onClick={() => handleRescheduleInterview(interview.interviewId)}>Reschedule</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleCancelInterview(interview.interviewId)}>Cancel</button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Post Job Modal */}
      {showJobModal && (
        <div className="modal-overlay" onClick={() => setShowJobModal(false)}>
          <div className="modal modal-lg fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Post a New Job</h2>
              <button className="modal-close" onClick={() => setShowJobModal(false)}>✕</button>
            </div>
            <form onSubmit={handlePostJob} className="job-post-form">
              <div className="grid-2">
                <div className="form-group">
                  <label>Job Title *</label>
                  <input value={jobForm.title} onChange={e => setJobForm({ ...jobForm, title: e.target.value })} placeholder="e.g. Senior React Developer" required />
                </div>
                <div className="form-group">
                  <label>Company Name *</label>
                  <input value={jobForm.company} onChange={e => setJobForm({ ...jobForm, company: e.target.value })} placeholder="e.g. Google, Startup Inc." required />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={jobForm.category} onChange={e => setJobForm({ ...jobForm, category: e.target.value })}>
                    <option value="">Select category</option>
                    {['Engineering', 'Design', 'Marketing', 'Finance', 'Sales', 'Product', 'Operations', 'Data Science'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Job Type</label>
                  <select value={jobForm.type} onChange={e => setJobForm({ ...jobForm, type: e.target.value })}>
                    <option value="">Select type</option>
                    {['Full-time', 'Part-time', 'Remote', 'Contract', 'Internship'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input value={jobForm.location} onChange={e => setJobForm({ ...jobForm, location: e.target.value })} placeholder="e.g. Mumbai, Remote" />
                </div>
                <div className="form-group">
                  <label>Min Salary (₹)</label>
                  <input type="number" value={jobForm.salaryMin} onChange={e => setJobForm({ ...jobForm, salaryMin: e.target.value })} placeholder="500000" />
                </div>
                <div className="form-group">
                  <label>Max Salary (₹)</label>
                  <input type="number" value={jobForm.salaryMax} onChange={e => setJobForm({ ...jobForm, salaryMax: e.target.value })} placeholder="1200000" />
                </div>
                <div className="form-group">
                  <label>Experience Required (yrs)</label>
                  <input type="number" value={jobForm.experienceRequired} onChange={e => setJobForm({ ...jobForm, experienceRequired: e.target.value })} placeholder="2" />
                </div>
                <div className="form-group">
                  <label>Skills (comma-separated)</label>
                  <input value={jobForm.skills} onChange={e => setJobForm({ ...jobForm, skills: e.target.value })} placeholder="React, Node.js, TypeScript" />
                </div>
              </div>
              <div className="form-group">
                <label>Job Description *</label>
                <textarea rows={5} value={jobForm.description} onChange={e => setJobForm({ ...jobForm, description: e.target.value })} placeholder="Describe the role, responsibilities, and what you're looking for…" required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowJobModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : null}
                  {saving ? 'Posting…' : 'Post Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
