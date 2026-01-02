import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import PublicHeader from "@/components/PublicHeader";
import { Eye, EyeOff, LayoutDashboard, LogOut } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user, signOut, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.title = "Login – Beshi Joss LMS";

    const params = new URLSearchParams(location.search);
    const reason = params.get("reason");

    if (reason === "session_mismatch" && user) {
      signOut();
      return;
    }
  }, [user, navigate, location.search, signOut]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    
    const formData = new FormData(event.currentTarget);
    const registrationId = formData.get("registrationId") as string;
    const password = formData.get("password") as string;
    
    const { error } = await signIn(registrationId, password);
    
    if (error) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid registration ID or password",
        variant: "destructive",
      });
      setLoading(false);
    } else {
        navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-10">
        {user ? (
            <Card className="w-full max-w-md border-[3px] border-foreground animate-in zoom-in-95 duration-200">
                <CardHeader className="space-y-2 pb-4 text-center">
                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Beshi Joss LMS</p>
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
            <Card className="w-full max-w-md border-[3px] border-foreground">
            <CardHeader className="space-y-2 pb-4">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Beshi Joss LMS</p>
                <CardTitle className="text-xl font-semibold">Student &amp; Admin Login</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                Enter your Registration ID (or Email) and password to login.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                    <Label htmlFor="registrationId">Registration ID or Email</Label>
                    <Input id="registrationId" name="registrationId" required autoComplete="off" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                    <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        className="pr-10"
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
                <Button type="submit" className="mt-2 w-full" disabled={loading}>
                    {loading ? "Logging in..." : "Login"}
                </Button>
                </form>
            </CardContent>
            </Card>
        )}
      </main>
    </div>
  );
};

export default Login;
