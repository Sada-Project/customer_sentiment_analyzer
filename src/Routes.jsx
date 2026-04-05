import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import NotFound from "pages/NotFound";
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginScreen from './pages/login-screen';
import VoiceAnalysisHub from './pages/voice-analysis-hub';
import CustomerInsights from './pages/customer-insights';
import SentimentOverview from './pages/sentiment-overview';
import PerformanceAnalytics from './pages/performance-analytics';
import CallDetails from './pages/call-details';
import AgentPerformanceCards from './pages/agent-performance-cards';
import AdminUserManagement from './pages/admin-user-management';
import ProfilePage from './pages/profile';

// ── Redirect user to their default page based on role ────────────────────────
const RoleBasedRedirect = () => {
  const { profile } = useAuth();
  if (profile?.role === 'agent') return <Navigate to="/voice-analysis-hub" replace />;
  return <Navigate to="/sentiment-overview" replace />;
};

const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <ScrollToTop />
          <RouterRoutes>
            {/* Public route */}
            <Route path="/login-screen" element={<LoginScreen />} />

            {/* Root: redirect based on role */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RoleBasedRedirect />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sentiment-overview"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <SentimentOverview />
                </ProtectedRoute>
              }
            />

            <Route
              path="/voice-analysis-hub"
              element={
                <ProtectedRoute allowedRoles={['admin', 'agent']}>
                  <VoiceAnalysisHub />
                </ProtectedRoute>
              }
            />

            <Route
              path="/customer-insights"
              element={
                <ProtectedRoute allowedRoles={['admin', 'agent']}>
                  <CustomerInsights />
                </ProtectedRoute>
              }
            />

            <Route
              path="/performance-analytics"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PerformanceAnalytics />
                </ProtectedRoute>
              }
            />

            <Route
              path="/call-details/:callId"
              element={
                <ProtectedRoute allowedRoles={['admin', 'agent']}>
                  <CallDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="/agent-performance-cards"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AgentPerformanceCards />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin-user-management"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminUserManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </RouterRoutes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;