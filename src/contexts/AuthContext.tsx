import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

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
  };

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
        setTimeout(() => {
          fetchProfile(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsTeacher(false);
      }
      
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (identifier: string, password: string, captchaToken?: string) => {
    try {
      let email = identifier;
      // If it looks like a registration ID (no @ symbol), format it as an internal email
      if (!identifier.includes("@")) {
        email = `${identifier}@beshijoss.com`;
      }
 
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken }
      });

      if (error) {
        return { error: { message: "Invalid registration ID or password" } };
      }

      if (data.user) {
          // Check profile status immediately after login if possible, or wait for fetchProfile effect
          // It's safer to fetch here to prevent UI flash
          const { data: profileCheck } = await supabase.from('profiles').select('status').eq('id', data.user.id).single();
          if (profileCheck && profileCheck.status === 'banned') {
              await supabase.auth.signOut();
              return { error: { message: "Account is banned" } };
          }

          // Generate and set new session ID
          const newSessionId = crypto.randomUUID();
          localStorage.setItem("app_session_id", newSessionId);

          const { error: updateError } = await supabase
              .from("profiles")
              .update({ current_session_id: newSessionId })
              .eq("id", data.user.id);

          if (updateError) console.error("Failed to update session ID", updateError);
      }

      return { error: null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return { error: { message: "Invalid registration ID or password" } };
    }
  }, []); // Dependencies likely just supabase (imported)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signOut = useCallback(async (forced: any = false) => {
    // Ensure forced is boolean (prevent Event object passing issues)
    const isForced = typeof forced === 'boolean' ? forced : false;

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

    // If we don't have a local session ID but are logged in, effectively we are an "old" session or undefined state.
    // However, if we just logged in, we set it.
    // This check runs on location change.

    if (!localSessionId) return; // Should be set on login

    const { data: remoteProfile, error } = await supabase
        .from("profiles")
        .select("current_session_id, status")
        .eq("id", user.id)
        .single();

    if (error || !remoteProfile) return;

    // Check Ban Status dynamically
    if (remoteProfile.status === 'banned') {
        console.warn("User banned detected during session check.");
        await signOut(true);
        return;
    }

    if (remoteProfile.current_session_id && remoteProfile.current_session_id !== localSessionId) {
        // Mismatch!
        console.warn("Session mismatch detected. Logging out.");
        await signOut(true); // pass true to indicate forced logout
    }
  }, [user, session, signOut]);

  useEffect(() => {
      if (user) {
          checkSessionValidity();
      }

      const interval = setInterval(() => {
        if (user && !loading) {
            checkSessionValidity();
        }
    }, 300000); // Increased to 5 minutes

    return () => clearInterval(interval);
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
                      title: "Welcome Aboard! ✨",
                      description: "Your account is now verified. Welcome to Atlas Courses.",
                      variant: "default",
                  });
              } else if (decoded.toLowerCase().includes('email')) {
                  toast({
                      title: "Email Fully Updated! 🛡️",
                      description: "Your login address has been successfully changed to the new email.",
                      variant: "default",
                  });
              } else {
                  toast({
                      title: "Action Successful ✅",
                      description: decoded,
                      variant: "default",
                  });
              }

              // Clear hash to prevent repeat Toast on refresh
              window.history.replaceState(null, "", window.location.pathname + window.location.search);
          } else if (errorDesc) {
              const decodedErr = decodeURIComponent(errorDesc).replace(/\+/g, ' ');
              toast({
                  title: "Verification Issue ⚠️",
                  description: decodedErr,
                  variant: "destructive",
              });
              window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
      };

      handleHashMessages();
  }, [location.pathname, toast]);

  // ----------------------------------

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, isTeacher, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
