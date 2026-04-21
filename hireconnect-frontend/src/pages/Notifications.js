import React, { useState, useEffect } from 'react';
import { notificationAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Notifications.css';

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = user?.userId || user?.profileId || 1;

  useEffect(() => {
    notificationAPI.getByUser(userId)
      .then(r => setNotifications(r.data))
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  }, [userId]);

  const markRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications(prev => prev.map(n => (n.id === id || n.notificationId === id) ? { ...n, read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead(userId);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All marked as read');
    } catch {}
  };

  const deleteNotif = async (id) => {
    try {
      await notificationAPI.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id && n.notificationId !== id));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="notifs-page page">
      <div className="container notifs-container">
        <div className="notifs-header fade-in">
          <div>
            <h1 className="section-title">Notifications</h1>
            <p className="section-sub">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button className="btn btn-ghost" onClick={markAllRead}>Mark all read</button>
          )}
        </div>

        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 10 }} />
          ))
        ) : notifications.length === 0 ? (
          <div className="notifs-empty card fade-in">
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔔</div>
            <h3>No notifications yet</h3>
            <p>You'll see job alerts, application updates, and interview invites here.</p>
          </div>
        ) : (
          <div className="notifs-list fade-in">
            {notifications.map(n => {
              const id = n.id || n.notificationId;
              return (
                <div key={id} className={`notif-card card ${!n.read ? 'unread' : ''}`}>
                  <div className="nc-left">
                    <div className="nc-icon">{getIcon(n.type)}</div>
                  </div>
                  <div className="nc-body" onClick={() => !n.read && markRead(id)}>
                    <div className="nc-top">
                      <span className="badge badge-blue nc-type">{n.type}</span>
                      {!n.read && <span className="nc-dot" />}
                    </div>
                    <p className="nc-message">{n.message}</p>
                  </div>
                  <button className="nc-delete" onClick={() => deleteNotif(id)}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getIcon(type) {
  const icons = {
    'Job Alert': '🔔',
    'Application Update': '📋',
    'Interview': '🗓️',
    'Offer': '🎉',
    'Message': '💬',
  };
  return icons[type] || '📩';
}
