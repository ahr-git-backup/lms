import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PublicHeader from "@/components/PublicHeader";
import { Eye, EyeOff, LayoutDashboard, LogOut, AlertTriangle, Send, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const TELEGRAM_SUPPORT_BOT = "https://t.me/AtlasWeb_Robot";
const WHATSAPP_HELPLINE = "https://wa.me/8801999681290";

function buildTelegramSupportLink(errorMessage: string, identifier: string) {
  const text = `আসসালামু আলাইকুম, আমি লগইন করতে সমস্যায় পড়েছি।\nEmail/ID: ${identifier || "(দেওয়া হয়নি)"}\nError: ${errorMessage}\nদয়া করে সাহায্য করুন।`;
  return `${TELEGRAM_SUPPORT_BOT}?text=${encodeURIComponent(text)}`;
}

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user, signOut, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [loginError, setLoginError] = useState<{ message: string; identifier: string } | null>(null);

  useEffect(() => {
    document.title = "Login – Atlas";

    const params = new URLSearchParams(location.search);
    const reason = params.get("reason");

    if (reason === "session_mismatch" && user) {
      signOut();
      return;
    }
  }, [user, navigate, location.search, signOut]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      setLoginError({ message: error.message || "Google দিয়ে লগইন করা যায়নি", identifier: "" });
      setLoading(false);
    }
    // On success, Supabase redirects to Google then back to redirectTo — no
    // further client-side navigation needed here.
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const identifier = formData.get("identifier") as string; // Changed from registrationId to identifier
    const password = formData.get("password") as string;

    const { error } = await signIn(identifier, password, captchaToken);

    if (error) {
      setLoginError({ message: error.message || "Invalid credentials", identifier });
      setLoading(false);
    } else {
      // Fetch user roles quickly to decide redirect
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profileData && (profileData.role === 'admin' || profileData.role === 'teacher')) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-10">
        {user ? (
          <Card className="w-full max-w-md border-[3px] border-foreground animate-in zoom-in-95 duration-200">
            <CardHeader className="space-y-2 pb-4 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Atlas</p>
              <CardTitle className="text-xl font-semibold">Welcome Back!</CardTitle>
              <CardDescription>
                You are already logged in as <span className="font-semibold text-foreground">{profile?.full_name || profile?.registration_id || "User"}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button onClick={() => navigate("/dashboard")} className="w-full h-12 text-lg" size="lg">
                <LayoutDashboard className="mr-2 h-5 w-5" /> Go to Dashboard
              </Button>
            </CardContent>
            <CardFooter>
              <Button onClick={() => signOut()} variant="outline" className="w-full text-muted-foreground hover:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Logout from this account
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="w-full max-w-md overflow-hidden rounded-[26px] border-[3px] border-foreground shadow-lg">
                        <CardHeader className="space-y-2 pb-4 pt-7 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Atlas</p>
              <CardTitle className="text-xl font-semibold text-foreground">Student &amp; Admin Login</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter your Email to login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 gap-2 mb-4"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29A11.96 11.96 0 000 12c0 1.93.46 3.76 1.29 5.38l3.98-3.09z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
                </svg>
                Google দিয়ে লগইন করো
              </Button>

              <div className="flex items-center gap-2 mb-4">
                <div className="h-px bg-border flex-1" />
                <span className="text-xs text-muted-foreground">অথবা</span>
                <div className="h-px bg-border flex-1" />
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="identifier" className="text-xs font-semibold text-muted-foreground">ইমেইল / ফোন নম্বর</Label>
                  <Input
                    id="identifier"
                    name="identifier"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="Email অথবা Phone Number"
                    className="h-12 rounded-xl border-input pl-4 pr-4 text-[15px] shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground">Password</Label>
                    <Link to="/forgot-password" tabIndex={-1} className="text-xs text-primary font-medium hover:underline">
                      Forgot Password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      className="h-12 rounded-xl border-input pl-4 pr-10 text-[15px] tracking-wide shadow-sm transition-all focus-visible:border-primary focus-visible:ring-primary/20 dark:border-white/10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                </div>
                <div className="flex justify-center py-2">
                  <Turnstile
                    siteKey="1x00000000000000000000AA"
                    onSuccess={(token) => setCaptchaToken(token)}
                  />
                </div>

                <Button
                  type="submit"
                  className="mt-1 h-12 w-full rounded-xl bg-primary text-primary-foreground text-[15px] font-bold shadow-sm transition-transform hover:scale-[1.01]"
                  disabled={loading || !captchaToken}
                >
                  {loading ? "Logging in..." : "Login"}
                </Button>

                <div className="mt-4 text-center text-sm">
                  Don&apos;t have an account?{" "}
                  <Link to="/register" state={{ from: location.state?.from }} className="font-semibold text-primary hover:underline">
                    Create new account
                  </Link>
                </div>
              </form>

              <div className="mt-6 overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50/60 to-white shadow-[0_8px_25px_rgba(245,158,11,0.1)] dark:border-amber-500/20 dark:from-amber-950/30 dark:via-amber-900/10 dark:to-transparent">
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_6px_16px_rgba(245,158,11,0.3)]">
                    <AlertTriangle className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div className="text-sm text-amber-900 dark:text-amber-200 w-full">
                    <p className="mb-1 text-sm font-black tracking-tight">সতর্কবার্তা!</p>
                    <p className="leading-relaxed text-amber-800/90 dark:text-amber-200/80">আপনার ফোন নম্বর এবং পাসওয়ার্ড মনে রাখুন এবং কোথাও লিখে রাখুন।</p>
                    <p className="mt-2 leading-relaxed text-amber-800/90 dark:text-amber-200/80">লগইন সংক্রান্ত সমস্যা হলে নিচে মেসেজ করুন:</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        asChild
                        size="sm"
                        className="w-full gap-1.5 bg-[#229ED9] hover:bg-[#1b87bd] text-white"
                      >
                        <a href={TELEGRAM_SUPPORT_BOT} target="_blank" rel="noopener noreferrer">
                          <Send className="h-3.5 w-3.5" />
                          Telegram
                        </a>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="w-full gap-1.5 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]"
                      >
                        <a href={WHATSAPP_HELPLINE} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={!!loginError} onOpenChange={(open) => !open && setLoginError(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Login failed
            </DialogTitle>
            <DialogDescription className="text-sm text-foreground pt-1">
              {loginError?.message}
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            সমস্যা সমাধান না হলে আমাদের সাপোর্টে যোগাযোগ করো:
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              asChild
              className="w-full gap-2 bg-[#229ED9] hover:bg-[#1b87bd] text-white"
            >
              <a
                href={buildTelegramSupportLink(loginError?.message || "", loginError?.identifier || "")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Send className="h-4 w-4" />
                Telegram-এ মেসেজ করো
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full gap-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]"
            >
              <a href={WHATSAPP_HELPLINE} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                WhatsApp হেল্পলাইন
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
