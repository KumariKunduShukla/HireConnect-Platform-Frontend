import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { jobAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Jobs.css';

const JOB_TYPES = ['Full-time', 'Part-time', 'Remote', 'Contract', 'Internship'];
const CATEGORIES = ['Engineering', 'Design', 'Marketing', 'Finance', 'Sales', 'Product', 'Operations', 'Data Science'];

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoggedIn } = useAuth();

  const [filters, setFilters] = useState({
    title: searchParams.get('title') || '',
    category: searchParams.get('category') || '',
    location: searchParams.get('location') || '',
    minSalary: 0,
    maxSalary: 0,
  });

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await jobAPI.getAllJobs();
      setJobs(res.data);
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (filters.title || filters.category || filters.minSalary || filters.maxSalary) {
        const res = await jobAPI.searchJobs(filters.title, filters.category, filters.minSalary, filters.maxSalary);
        setJobs(res.data);
      } else if (filters.location) {
        const res = await jobAPI.getJobsByLocation(filters.location);
        setJobs(res.data);
      } else {
        fetchJobs();
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (s) => s === 'OPEN' ? 'green' : 'red';
  const typeColor = (t) => ({ 'Remote': 'blue', 'Full-time': 'purple', 'Part-time': 'yellow', 'Contract': 'gray', 'Internship': 'yellow' }[t] || 'gray');

  return (
    <div className="jobs-page page">
      {/* Header */}
      <div className="jobs-header">
        <div className="container">
          <div className="jobs-header-content">
            <div>
              <h1 className="section-title">Find Your Next Role</h1>
              <p className="section-sub">{jobs.length} opportunities waiting for you</p>
            </div>
            {isLoggedIn && (
              <Link to="/dashboard" className="btn btn-ghost">← My Applications</Link>
            )}
          </div>

          {/* Search / Filter Bar */}
          <form className="jobs-filter-bar" onSubmit={handleSearch}>
            <div className="filter-input-wrap">
              <svg className="filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Job title, keyword…"
                value={filters.title}
                onChange={(e) => setFilters({ ...filters, title: e.target.value })}
                className="filter-input"
              />
            </div>
            <div className="filter-input-wrap">
              <svg className="filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              <input
                type="text"
                placeholder="Location…"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="filter-input"
              />
            </div>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className="btn btn-primary">Search</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setFilters({ title: '', category: '', location: '', minSalary: 0, maxSalary: 0 }); fetchJobs(); }}>
              Reset
            </button>
          </form>
        </div>
      </div>

      {/* Job Grid */}
      <div className="container jobs-body">
        {loading ? (
          <div className="jobs-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="job-card-skeleton card">
                <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 20 }} />
                <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 20 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="skeleton" style={{ height: 22, width: 60, borderRadius: 100 }} />
                  <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 100 }} />
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="jobs-empty">
            <div className="jobs-empty-icon">🔍</div>
            <h3>No jobs found</h3>
            <p>Try adjusting your filters or check back later.</p>
            <button className="btn btn-primary" onClick={fetchJobs}>Refresh Jobs</button>
          </div>
        ) : (
          <div className="jobs-grid">
            {jobs.map(job => (
              <Link key={job.jobId} to={`/jobs/${job.jobId}`} className="job-card card">
                <div className="job-card-top">
                  <div className="job-company-icon">
                    {(job.title?.[0] || 'J').toUpperCase()}
                  </div>
                  <div className="job-status-wrap">
                    <span className={`badge badge-${statusColor(job.status)}`}>
                      <span className={`status-indicator status-${job.status?.toLowerCase()}`} style={{ marginRight: 4 }} />
                      {job.status}
                    </span>
                  </div>
                </div>

                <div className="job-card-body">
                  <h3 className="job-title">{job.title}</h3>
                  <div className="job-company" style={{ color: '#6366f1', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 500 }}>
                    🏢 {job.company || 'Unknown Company'}
                  </div>
                  <div className="job-location">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                      <circle cx="12" cy="9" r="2.5"/>
                    </svg>
                    {job.location || 'Not specified'}
                  </div>
                  <p className="job-desc">{job.description?.slice(0, 100)}…</p>
                </div>

                <div className="job-card-footer">
                  <div className="job-tags">
                    {job.type && <span className={`badge badge-${typeColor(job.type)}`}>{job.type}</span>}
                    {job.category && <span className="badge badge-gray">{job.category}</span>}
                  </div>
                  {(job.salaryMin || job.salaryMax) && (
                    <div className="job-salary">
                      ₹{(job.salaryMin / 1000).toFixed(0)}K – ₹{(job.salaryMax / 1000).toFixed(0)}K
                    </div>
                  )}
                </div>

                {job.skills?.length > 0 && (
                  <div className="job-skills">
                    {job.skills.slice(0, 3).map(s => (
                      <span key={s} className="skill-tag">{s}</span>
                    ))}
                    {job.skills.length > 3 && <span className="skill-more">+{job.skills.length - 3}</span>}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
