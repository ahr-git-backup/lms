import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, requireAdmin = false, allowedRoles = [] }: ProtectedRouteProps) => {
  const { user, profile, isAdmin, isTeacher, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If user is not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // A Google sign-in creates a bare profile row (Google's metadata doesn't
  // map to our custom fields) -- send them to fill it in before anything
  // else, the same gate every normal Register.tsx signup already passes.
  const profileIncomplete = profile && (!profile.full_name || !profile.phone);
  if (profileIncomplete && location.pathname !== "/complete-profile") {
    return <Navigate to="/complete-profile" replace />;
  }

  // If user is logged in but requires admin rights and doesn't have them, redirect to dashboard
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check generic allowed roles (e.g. ['admin', 'teacher'])
  if (allowedRoles.length > 0) {
      const hasRole = (allowedRoles.includes('admin') && isAdmin) ||
                      (allowedRoles.includes('teacher') && isTeacher);

      if (!hasRole) {
          return <Navigate to="/dashboard" replace />;
      }
  }

  // If user is logged in (and has rights if needed), render children
  return <>{children}</>;
};

export default ProtectedRoute;
