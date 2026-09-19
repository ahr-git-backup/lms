import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";

interface Profile {
  id: string;
  registration_id: string;
  full_name: string | null;
  phone: string | null;
  school: string | null;
  batch_year: number | null;
  extra_time_multiplier: number;
  current_session_id?: string | null;
  status?: string | null;
  // new fields
  father_name?: string | null;
  mother_name?: string | null;
  hsc_batch?: string | null;
  college_name?: string | null;
  ssc_gpa?: number | null;
  hsc_gpa?: number | null;
  is_second_timer?: boolean;
  avatar_url?: string | null;
  name_changed_once?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isTeacher: boolean;
  loading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signIn: (identifier: string, password: string, captchaToken?: string) => Promise<{ error: any }>;
  signOut: (forced?: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      let { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // If profile is missing, attempt to create it from user metadata
      if (!data) {
        console.log("Profile not found, attempting to create...");
        const { data: userData } = await supabase.auth.getUser();

        if (userData.user && userData.user.id === userId) {
          const meta = userData.user.user_metadata;

          // Only attempt insert if we have the necessary metadata
          if (meta && meta.registration_id) {
            const { error: insertError } = await supabase
              .from("profiles")
              .insert({
                id: userId,
                registration_id: meta.registration_id,
                full_name: meta.full_name || "",
                extra_time_multiplier: 1,
              });

            if (!insertError) {
               console.log("Profile created successfully via lazy loading.");
               // Refetch
               const retry = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();
               data = retry.data;
               error = retry.error;
            } else {
              console.error("Failed to create profile lazy:", insertError);
              toast({
                title: "প্রোফাইল লোড করা যায়নি",
                description: "একটি সমস্যা হয়েছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।",
                variant: "destructive",
              });
            }
          }
        }
      }

      if (!error && data) {
        // Check for ban status
        if (data.status === 'banned') {
            console.warn("User is banned. Logging out.");
            toast({
                title: "Account Suspended",
                description: "Your account has been banned. Please contact support.",
                variant: "destructive",
                duration: 5000
            });
            await signOut(true);
            return;
        }

        setProfile(data);
        
        // Check roles
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        
        const roleList = roles?.map(r => r.role) || [];
        setIsAdmin(roleList.includes("admin"));
        setIsTeacher(roleList.includes("teacher"));
      }
    } catch (err) {
      console.error("fetchProfile failed:", err);
      toast({
        title: "প্রোফাইল লোড করা যায়নি",
        description: "নেটওয়ার্ক সমস্যা হতে পারে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Watchdog: if auth/profile loading gets stuck (stale/corrupted
    // session token, a hung network request, etc.) the app would
    // otherwise sit on a blank/loading screen forever — the only fix
    // being the user manually clearing site data, which isn't even
    // possible from inside an installed PWA. Instead, if loading is
    // still true after a few seconds, clear the (likely stale) Supabase
    // auth token from storage and reload once automatically.
    if (!loading) return;

    const RELOAD_GUARD_KEY = "auth_stuck_reload_attempted";
    const timeoutId = window.setTimeout(() => {
      const alreadyTriedThisLoad = sessionStorage.getItem(RELOAD_GUARD_KEY);
      if (alreadyTriedThisLoad) {
        // Already tried an automatic recovery this session and it's
        // still stuck — don't loop forever, let the user see the app
        // in whatever state it's in (or a manual "still stuck?" prompt
        // elsewhere can take over).
        return;
      }

      console.warn("Auth loading timed out — clearing stale session data and reloading.");
      try {
        Object.keys(localStorage)
          .filter((key) => key.startsWith("sb-"))
          .forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        console.error("Failed to clear stale auth storage:", e);
      }

      sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      window.location.reload();
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [loading]);

  useEffect(() => {
    // Loading finished normally (not stuck) — clear the guard so a
    // future stuck-loading episode can trigger the auto-recovery again.
    if (!loading) {
      sessionStorage.removeItem("auth_stuck_reload_attempted");
    }
  }, [loading]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (event === 'PASSWORD_RECOVERY') {
          // Force redirect to reset password page when they click the email link
          navigate('/reset-password', { replace: true });
      }

      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsTeacher(false);
        setLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (identifier: string, password: string, captchaToken?: string) => {
    try {
      let email = identifier;

      // If input has no @, it's a phone number or legacy registration ID.
      // We must resolve it to the actual auth email before attempting login,
      // since registration now uses the student's real email (not a synthetic one).
      if (!identifier.includes("@")) {
        // @ts-expect-error rpc not in generated types
        const { data: resolvedEmail } = await supabase.rpc('resolve_login_email', { p_identifier: identifier });
        if (resolvedEmail) {
          email = resolvedEmail;
        } else {
          // Fallback to legacy synthetic email pattern for old accounts
          email = `${identifier}@beshijoss.com`;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken }
      });

      if (error) {
        // Only mask genuine wrong-credential errors with the friendly message.
        // Anything else (network failure, service unavailable, rate limit)
        // should surface honestly — otherwise a real infrastructure problem
        // looks identical to "wrong password" and can't be diagnosed or
        // reported correctly by the user.
        const code = (error as { message?: string; status?: number }).message || "";
        const isCredentialError = /invalid login credentials|invalid.*credentials/i.test(code);
        if (isCredentialError) {
          // @ts-expect-error rpc not in generated types
          const { data: exists } = await supabase.rpc('check_identifier_exists', { p_identifier: identifier });
          if (!exists) {
            return { error: { message: "এই ফোন নম্বর/ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। ফোন নম্বর বা ইমেইল ঠিক আছে কিনা চেক করুন।" } };
          }
          return { error: { message: "পাসওয়ার্ড ভুল হয়েছে। আবার চেষ্টা করুন অথবা পাসওয়ার্ড রিসেট করুন।" } };
        }
        return { error: { message: `লগইন করা যায়নি: ${code || "অজানা সমস্যা"}। কিছুক্ষণ পর আবার চেষ্টা করুন।` } };
      }

      if (data.user) {
          // Check profile status immediately after login if possible, or wait for fetchProfile effect
          // It's safer to fetch here to prevent UI flash
          const { data: profileCheck } = await supabase.from('profiles').select('status').eq('id', data.user.id).single();
          if (profileCheck && profileCheck.status === 'banned') {
              await supabase.auth.signOut();
              return { error: { message: "Account is banned" } };
          }

          // Check role — admins/teachers are exempt from single-session
          // enforcement so they can stay logged into multiple browsers/devices
          // at once (e.g. managing from office + phone simultaneously).
          const { data: roles } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", data.user.id);
          const roleList = roles?.map(r => r.role) || [];
          const isPrivileged = roleList.includes("admin") || roleList.includes("teacher");

          if (!isPrivileged) {
            // Generate and set new session ID (this login becomes the only
            // valid session; any other open session for this account will be
            // force-logged-out by checkSessionValidity).
            const newSessionId = crypto.randomUUID();
            localStorage.setItem("app_session_id", newSessionId);

            let updateError = (await supabase
                .from("profiles")
                .update({ current_session_id: newSessionId })
                .eq("id", data.user.id)).error;

            // PWA on mobile can have a flaky connection right at login time
            // (app just came to foreground, network still settling) — one
            // quick retry avoids scaring the user with a sync-error toast
            // over what was really just a one-off transient network blip.
            if (updateError) {
              await new Promise((r) => setTimeout(r, 800));
              updateError = (await supabase
                  .from("profiles")
                  .update({ current_session_id: newSessionId })
                  .eq("id", data.user.id)).error;
            }

            if (updateError) {
              console.error("Failed to update session ID", updateError);
              toast({
                title: "সেশন সিঙ্ক সমস্যা",
                description: "লগইন হয়েছে, তবে একটি সমস্যার কারণে অন্য ডিভাইসে সমস্যা হতে পারে। কোনো সমস্যা মনে হলে পুনরায় লগইন করুন।",
                variant: "destructive",
              });
            }
          }
          // Privileged users: don't touch current_session_id at all, so no
          // other admin/teacher session anywhere gets invalidated by this login.
      }

      return { error: null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // bug fix: this used to show "Invalid registration ID or password" for
      // EVERY failure, including network errors or the auth service being
      // temporarily unreachable — which made a real infrastructure problem
      // indistinguishable from an actually wrong password, and impossible to
      // diagnose from a screenshot/report. Surface the real reason instead.
      return {
        error: {
          message: `লগইন করা যায়নি: ${error?.message || "নেটওয়ার্ক সমস্যা"}। কিছুক্ষণ পর আবার চেষ্টা করুন।`,
        },
      };
    }
  }, []); // Dependencies likely just supabase (imported)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signOut = useCallback(async (forced: any = false) => {
    // Ensure forced is boolean (prevent Event object passing issues)
    const isForced = typeof forced === 'boolean' ? forced : false;

    // Guard: if already on /login, don't re-trigger a hard redirect (prevents reload loop)
    if (isForced && window.location.pathname === "/login") {
      return;
    }

    // 1. Optimistic Update: Clear local state immediately for UX
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setIsTeacher(false);
    localStorage.removeItem("app_session_id");

    // 2. Perform actual sign out
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Sign out error:", error);
    }

    // 3. Navigation / Redirect
    if (isForced) {
        window.location.href = "/login?reason=session_mismatch";
    } else {
        navigate("/login");
    }
  }, [navigate]);

  // --- Session Enforcement Logic ---
  const checkSessionValidity = useCallback(async () => {
    if (!user || !session) return;
    if (window.location.pathname === "/login") return;

    // We check the DB profile's current_session_id against our local storage
    const localSessionId = localStorage.getItem("app_session_id");

    const { data: remoteProfile, error } = await supabase
        .from("profiles")
        .select("current_session_id, status")
        .eq("id", user.id)
        .single();

    if (error || !remoteProfile) return;

    // Check Ban Status dynamically — always, regardless of session tracking.
    if (remoteProfile.status === 'banned') {
        console.warn("User banned detected during session check.");
        await signOut(true);
        return;
    }

    // Privileged users never have a local session id (see signIn) and are
    // exempt from single-session enforcement entirely.
    if (isAdmin || isTeacher) return;
    if (!localSessionId) return; // Should be set on login

    if (remoteProfile.current_session_id && remoteProfile.current_session_id !== localSessionId) {
        // Mismatch!
        console.warn("Session mismatch detected. Logging out.");
        await signOut(true); // pass true to indicate forced logout
    }
  }, [user, session, signOut, isAdmin, isTeacher]);

  useEffect(() => {
      let initialTimer: ReturnType<typeof setTimeout> | undefined;
      if (user) {
          // Grace period on the very first check after user becomes
          // available. On PWA especially, the app can regain foreground and
          // fire this effect before the login flow's own localStorage write
          // /DB update has fully settled — checking too early was reading a
          // stale/missing local session id and forcing a logout right after
          // a successful login. A short delay lets that settle first.
          initialTimer = setTimeout(() => checkSessionValidity(), 1500);
      }

      const interval = setInterval(() => {
        if (user && !loading) {
            checkSessionValidity();
        }
    }, 300000); // Increased to 5 minutes

    return () => {
        if (initialTimer) clearTimeout(initialTimer);
        clearInterval(interval);
    };
  }, [user, loading, checkSessionValidity]);

  useEffect(() => {
      // PWA on mobile suspends the app in the background and the OS can
      // silently drop the network connection during that time. When the
      // user brings it back to foreground, do a fresh session check
      // (catches another device having logged in while this one was
      // backgrounded) instead of waiting for the next 5-minute interval
      // tick. Same short grace delay as the initial check, so a check
      // doesn't race a login flow that's still settling right as the app
      // resumes.
      const handleVisibility = () => {
          if (document.visibilityState === "visible" && user && !loading) {
              setTimeout(() => checkSessionValidity(), 1000);
          }
      };
      document.addEventListener("visibilitychange", handleVisibility);
      return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user, loading, checkSessionValidity]);
  useEffect(() => {
      // Check for messages/errors in URL fragment (Supabase redirect standard)
      const handleHashMessages = () => {
          const hash = window.location.hash;
          if (!hash || !hash.startsWith('#')) return;

          const params = new URLSearchParams(hash.substring(1));
          const message = params.get('message');
          const errorDesc = params.get('error_description');

          if (message) {
              const decoded = decodeURIComponent(message).replace(/\+/g, ' ');
              
              // Professional, context-aware success messages
              if (decoded.toLowerCase().includes('confirmation') || decoded.toLowerCase().includes('confirmed')) {
                  toast({
                      title: <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Welcome Aboard!</span>,
                      description: "Your account is now verified. Welcome to Atlas Courses.",
                      variant: "default",
                  });
              } else if (decoded.toLowerCase().includes('email')) {
                  toast({
                      title: <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Email Fully Updated!</span>,
                      description: "Your login address has been successfully changed to the new email.",
                      variant: "default",
                  });
              } else {
                  toast({
                      title: <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Action Successful</span>,
                      description: decoded,
                      variant: "default",
                  });
              }

              // Clear hash to prevent repeat Toast on refresh
              window.history.replaceState(null, "", window.location.pathname + window.location.search);
          } else if (errorDesc) {
              const decodedErr = decodeURIComponent(errorDesc).replace(/\+/g, ' ');
              toast({
                  title: <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Verification Issue</span>,
                  description: decodedErr,
                  variant: "destructive",
              });
              window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
      };

      handleHashMessages();
  }, [location.pathname, toast]);

  // ----------------------------------

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, isTeacher, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
