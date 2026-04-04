// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500 dark:text-slate-400">
        <span className="text-3xl">⏳</span>
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

  // ── Not logged in — redirect to login ──────────────────────────────────
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // ── Logged in but wrong role — redirect to home with 403-style message ─
  if (roles && roles.length > 0 && !roles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;