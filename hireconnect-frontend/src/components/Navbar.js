import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationAPI } from '../api';
import './Navbar.css';

export default function Navbar() {
  const { user, logout, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (user?.userId) {
      notificationAPI.getUnreadCount(user.userId)
        .then(r => setUnread(r.data))
        .catch(() => {});
    }
  }, [user, location]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname.startsWith(path) ? 'active' : '';

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-inner">
        <Link to="/" className="nav-logo">
          <span className="logo-icon">HC</span>
          <span className="logo-text">HireConnect</span>
        </Link>

        <div className="nav-links">
          <Link to="/jobs" className={`nav-link ${isActive('/jobs')}`}>Jobs</Link>
          {isLoggedIn && (
            <>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>Dashboard</Link>
              {user?.role === 'RECRUITER' && (
                <Link to="/recruiter" className={`nav-link ${isActive('/recruiter')}`}>Recruiter</Link>
              )}
            </>
          )}
        </div>

        <div className="nav-actions">
          {isLoggedIn ? (
            <>
              <Link to="/notifications" className="nav-icon-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unread > 0 && <span className="badge-count">{unread}</span>}
              </Link>
              <div className="nav-avatar" onClick={() => setMenuOpen(!menuOpen)}>
                <span>{user?.email?.[0]?.toUpperCase() || 'U'}</span>
                {menuOpen && (
                  <div className="dropdown">
                    <div className="dropdown-header">
                      <div className="dropdown-email">{user?.email}</div>
                      <span className={`badge badge-${user?.role === 'RECRUITER' ? 'purple' : 'blue'}`}>
                        {user?.role}
                      </span>
                    </div>
                    <Link to="/profile" className="dropdown-item" onClick={() => setMenuOpen(false)}>Profile</Link>
                    {user?.role === 'RECRUITER' && (
                      <Link to="/subscription" className="dropdown-item" onClick={() => setMenuOpen(false)}>Subscription</Link>
                    )}
                    <button className="dropdown-item danger" onClick={handleLogout}>Sign Out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">Sign In</Link>
              <Link to="/register" className="btn btn-primary">Get Started</Link>
            </>
          )}

          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span /><span />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-menu">
          <Link to="/jobs" onClick={() => setMenuOpen(false)}>Jobs</Link>
          {isLoggedIn ? (
            <>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
              <Link to="/notifications" onClick={() => setMenuOpen(false)}>Notifications {unread > 0 && `(${unread})`}</Link>
              {user?.role === 'RECRUITER' && (
                <Link to="/subscription" onClick={() => setMenuOpen(false)}>Subscription</Link>
              )}
              <button onClick={handleLogout}>Sign Out</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)}>Sign In</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)}>Get Started</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}