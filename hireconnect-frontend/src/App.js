import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Dashboard from './pages/Dashboard';
import RecruiterDashboard from './pages/RecruiterDashboard';
import RecruiterApply from './pages/RecruiterApply';
import Notifications from './pages/Notifications';
import Subscription from './pages/Subscription';
import Profile from './pages/Profile';

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const RecruiterRoute = ({ children }) => {
  const { isLoggedIn, user } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (user?.role !== 'RECRUITER') return <Navigate to="/dashboard" replace />;
  return children;
};

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/oauth/callback" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/recruiter-apply" element={<RecruiterApply />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/recruiter" element={<RecruiterRoute><RecruiterDashboard /></RecruiterRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a2030',
              color: '#e8ecf4',
              border: '1.5px solid #252e42',
              borderRadius: '12px',
              fontSize: '0.88rem',
              fontFamily: "'DM Sans', sans-serif",
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#0a0c10' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#0a0c10' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}