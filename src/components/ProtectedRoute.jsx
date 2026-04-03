import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Default pages per role when access is denied
const ROLE_DEFAULT_PATHS = {
  admin: '/sentiment-overview',
  agent: '/voice-analysis-hub',
};

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login-screen" state={{ from: location }} replace />;
  }

  if (allowedRoles?.length > 0 && !allowedRoles?.includes(profile?.role)) {
    // Redirect to the user's default page based on their role
    const fallback = ROLE_DEFAULT_PATHS[profile?.role] ?? '/voice-analysis-hub';
    return <Navigate to={fallback} replace />;
  }

  return children;
};

export default ProtectedRoute;