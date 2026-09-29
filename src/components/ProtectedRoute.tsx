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

  // Not logged in: any dashboard/protected experience redirects to the
  // landing page instead of silently rendering children in a logged-out
  // state. This is also what happens if the browser's cookies/site data
  // get cleared while sitting on a dashboard page — the next render sees
  // user=null and bounces to "/", so the person has to log in again
  // rather than seeing a broken/empty dashboard.
  if (!user) {
    return <Navigate to="/" replace />;
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
