import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const stats = [
  { value: '12K+', label: 'Active Jobs' },
  { value: '4.8K+', label: 'Companies' },
  { value: '98K+', label: 'Candidates' },
  { value: '89%', label: 'Hire Rate' },
];

const categories = [
  { name: 'Engineering', icon: '⚙️', count: '2.4K' },
  { name: 'Design', icon: '🎨', count: '890' },
  { name: 'Marketing', icon: '📈', count: '1.1K' },
  { name: 'Finance', icon: '💹', count: '760' },
  { name: 'Sales', icon: '🤝', count: '1.5K' },
  { name: 'Product', icon: '🧩', count: '430' },
  { name: 'Operations', icon: '🏗️', count: '680' },
  { name: 'Data Science', icon: '🔬', count: '920' },
];

const features = [
  {
    icon: '⚡',
    title: 'Smart Matching',
    desc: 'AI-powered job recommendations based on your skills and experience.',
  },
  {
    icon: '🔔',
    title: 'Real-time Alerts',
    desc: 'Instant notifications for new jobs, application updates, and interviews.',
  },
  {
    icon: '📊',
    title: 'Analytics',
    desc: 'Track your application pipeline and optimize your job search strategy.',
  },
  {
    icon: '🔒',
    title: 'Verified Companies',
    desc: 'All recruiters are manually vetted and approved for your safety.',
  },
];

export default function Home() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.search.includes('code=') || location.search.includes('token=')) {
      navigate(`/login${location.search}`, { replace: true });
    }
  }, [location.search, navigate]);

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb orb-1" />
          <div className="hero-orb orb-2" />
          <div className="hero-grid" />
        </div>
        <div className="container">
          <div className="hero-content fade-in">
            <div className="hero-badge">
              <span className="badge badge-blue">✦ Now Hiring</span>
              <span className="hero-badge-text">12,000+ jobs updated today</span>
            </div>
            <h1 className="hero-title">
              Find Your Dream<br />
              <span className="hero-gradient">Career Path</span>
            </h1>
            <p className="hero-sub">
              HireConnect bridges exceptional talent with world-class companies.<br />
              Discover roles that match your ambition, not just your résumé.
            </p>
            <div className="hero-cta">
              {isLoggedIn ? (
                <>
                  <Link to="/jobs" className="btn btn-primary btn-lg">Browse Jobs</Link>
                  <Link to="/dashboard" className="btn btn-ghost btn-lg">My Dashboard</Link>
                </>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg">Get Started Free</Link>
                  <Link to="/jobs" className="btn btn-ghost btn-lg">Explore Jobs</Link>
                </>
              )}
            </div>
            <div className="hero-stats">
              {stats.map((s) => (
                <div className="hero-stat" key={s.label}>
                  <span className="hero-stat-value">{s.value}</span>
                  <span className="hero-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Browse by Category</h2>
            <p className="section-sub">Find roles in your area of expertise</p>
          </div>
          <div className="categories-grid">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                to={`/jobs?category=${encodeURIComponent(cat.name)}`}
                className="cat-card"
              >
                <span className="cat-icon">{cat.icon}</span>
                <div>
                  <div className="cat-name">{cat.name}</div>
                  <div className="cat-count">{cat.count} open roles</div>
                </div>
                <svg className="cat-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section section-dark">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why HireConnect?</h2>
            <p className="section-sub">Everything you need to land your next role</p>
          </div>
          <div className="features-grid">
            {features.map((f) => (
              <div className="feature-card card" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="cta-banner">
        <div className="container">
          <div className="cta-inner">
            <div>
              <h2 className="cta-title">Ready to make your move?</h2>
              <p className="cta-sub">Join thousands of professionals already growing their careers.</p>
            </div>
            {!isLoggedIn && (
              <div className="cta-btns">
                <Link to="/register" className="btn btn-primary btn-lg">Create Free Account</Link>
                <Link to="/recruiter-apply" className="btn btn-ghost btn-lg">Post a Job</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-top">
            <div>
              <div className="nav-logo">
                <span className="logo-icon">HC</span>
                <span className="logo-text">HireConnect</span>
              </div>
              <p className="footer-desc">Connecting talent with opportunity, powered by technology.</p>
            </div>
            <div className="footer-links">
              <div>
                <div className="footer-col-title">Platform</div>
                <Link to="/jobs">Browse Jobs</Link>
                <Link to="/register">Sign Up</Link>
                <Link to="/login">Sign In</Link>
              </div>
              <div>
                <div className="footer-col-title">For Recruiters</div>
                <Link to="/recruiter-apply">Apply as Recruiter</Link>
                <Link to="/subscription">Pricing</Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 HireConnect. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
