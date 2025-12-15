import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AuthPage from './components/AuthPage';
import UpdatePassword from './components/UpdatePassword';

// Guard for Protected Routes
const RequireAuth = ({ children }: { children?: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F2F2F2]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDA47]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Guard for Public Routes (redirect to app if already logged in)
const PublicRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F2F2F2]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDA47]" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page is Public (redirects to app if logged in) */}
        <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />

        {/* Login is Public (but redirects if logged in) */}
        <Route path="/login" element={<PublicRoute><AuthPage /></PublicRoute>} />

        {/* App is Protected */}
        <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />

        {/* Password Update (Protected - user is logged in via link) */}
        <Route path="/update-password" element={<UpdatePassword />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}