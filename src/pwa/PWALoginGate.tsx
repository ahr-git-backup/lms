import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isStandaloneDisplay } from "./usePWADisplayMode";

// Routes that must stay reachable without a session even inside the
// installed app (login/register/password-recovery + guest exam links
// people may open directly from a shared URL).
const ALLOWED_WITHOUT_LOGIN = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

function isAllowedPath(pathname: string): boolean {
  if (ALLOWED_WITHOUT_LOGIN.includes(pathname)) return true;
  if (pathname.startsWith("/take-exam/")) return true;
  if (pathname.startsWith("/exam-review/")) return true;
  if (pathname.startsWith("/open-exam/")) return true;
  return false;
}

/**
 * PWA-only login gate. In the installed app (standalone/TWA), an
 * unauthenticated user is redirected straight to /login instead of seeing
 * the public website homepage. Has no effect in the regular browser
 * website — that keeps its normal public pages. Self-contained and
 * defensive: any internal error is a no-op, never blocks navigation.
 */
export function PWALoginGate() {
  // Disabled: PWA now allows browsing all pages without login, same as the
  // website. Login is only prompted at the point an actual action needs it.
  return null;
}
