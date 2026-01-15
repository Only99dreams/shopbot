import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(requireAdmin);

  // Wait a bit for admin check to complete when requireAdmin is true
  useEffect(() => {
    if (requireAdmin && user && !loading) {
      // Give time for the admin role check to complete
      const timer = setTimeout(() => {
        setIsCheckingAdmin(false);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!requireAdmin) {
      setIsCheckingAdmin(false);
    }
  }, [requireAdmin, user, loading, isAdmin]);

  if (loading || (requireAdmin && isCheckingAdmin && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
