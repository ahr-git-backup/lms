import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import PublicHeader from "@/components/PublicHeader";
import { ArrowLeft, Mail } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<"email-input" | "email-sent">("email-input");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();

  useEffect(() => {
    document.title = "Recover Account – Atlas";
  }, []);

  const handleEmailReset = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
             redirectTo: window.location.origin + "/reset-password",
             captchaToken,
        });
        if (error) throw error;
        setStep("email-sent");
      } catch (error: any) {
         toast({
            title: "Error",
            description: error.message || "Failed to send reset email.",
            variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md border-[3px] border-foreground">
            <CardHeader className="space-y-2 pb-4">
                <div className="flex items-center gap-2 mb-2">
                        <Button variant="ghost" size="icon" className="-ml-3 h-8 w-8" onClick={() => step === "email-input" ? navigate("/login") : setStep("email-input")} type="button">
                        <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Atlas</p>
                </div>
                <CardTitle className="text-xl font-semibold">
                    {step === "email-input" ? "Forgot Password?" : "Check Your Email"}
                </CardTitle>
                <CardDescription>
                    {step === "email-input" && "Enter your registered email address to receive a password reset link."}
                </CardDescription>
            </CardHeader>

            {step === "email-input" && (
                <CardContent>
                     <form onSubmit={handleEmailReset} className="space-y-4">
                        <div className="space-y-2">
                             <Label>Email Address</Label>
                             <Input
                                id="reset-email"
                                type="email"
                                placeholder="Enter your email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-center py-2">
                             <Turnstile
                                siteKey="0x4AAAAAACpBHrpNCl36IKek"
                                onSuccess={(token) => setCaptchaToken(token)}
                             />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading || !captchaToken}>
                            {loading ? "Sending Link..." : "Send Reset Link"}
                        </Button>
                     </form>
                </CardContent>
            )}

            {step === "email-sent" && (
                <CardContent className="space-y-6 text-center py-6">
                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500 rounded-full flex items-center justify-center">
                        <Mail className="h-8 w-8" />
                    </div>
                    <p className="text-muted-foreground">
                        We have sent a password reset link to <strong>{email}</strong>. Please check your inbox (and spam folder) and follow the instructions.
                    </p>
                    <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
                        Back to Login
                    </Button>
                </CardContent>
            )}
        </Card>
      </main>
    </div>
  );
};

export default ForgotPassword;
