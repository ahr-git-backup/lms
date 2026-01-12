import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import PublicHeader from "@/components/PublicHeader";
import { ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff, Mail, Phone, ChevronRight, UserCheck } from "lucide-react";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<"method-select" | "email-sent" | "phone-verify" | "email-profile-verify" | "success">("method-select");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [hscBatch, setHscBatch] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [sscGpa, setSscGpa] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    document.title = "Recover Account – Atlas";
  }, []);

  const handleEmailReset = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
             redirectTo: window.location.origin + "/reset-password",
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

  const handleVerifyAndReset = async (e: React.FormEvent, method: 'phone' | 'email') => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
        toast({
            title: "Passwords do not match",
            variant: "destructive"
        });
        return;
    }

    if (newPassword.length < 6) {
        toast({
            title: "Password too short",
            description: "Password must be at least 6 characters",
            variant: "destructive"
        });
        return;
    }

    setLoading(true);

    try {
        const payload: any = {
            p_identifier: method === 'phone' ? phone.trim() : email.trim(),
            p_method: method,
            p_father_name: fatherName.trim(),
            p_mother_name: motherName.trim(),
            p_hsc_batch: hscBatch.trim(),
            p_new_password: newPassword
        };

        if (method === 'email') {
            payload.p_college_name = collegeName.trim();
            payload.p_ssc_gpa = parseFloat(sscGpa) || null;
        }

        const { data, error } = await supabase.rpc('verify_and_reset_password', payload);

        if (error) throw error;

        if (data === true) {
            setStep("success");
            toast({
                title: "Password Reset Successful",
                description: "You can now login with your new password.",
            });
        } else {
            toast({
                title: "Verification Failed",
                description: "The details provided do not match our records. Please check your spelling and try again.",
                variant: "destructive"
            });
        }
    } catch (error: any) {
        console.error("Reset error:", error);
        toast({
            title: "Error",
            description: error.message || "Something went wrong. Please try again.",
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

            {/* Header Common */}
            <CardHeader className="space-y-2 pb-4">
                <div className="flex items-center gap-2 mb-2">
                        <Button variant="ghost" size="icon" className="-ml-3 h-8 w-8" onClick={() => step === "method-select" ? navigate("/login") : setStep("method-select")} type="button">
                        <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Atlas</p>
                </div>
                <CardTitle className="text-xl font-semibold">
                    {step === "method-select" ? "Forgot Password?" :
                     step === "email-sent" ? "Check Your Email" :
                     step === "success" ? "Password Reset!" : "Recover Account"}
                </CardTitle>
                <CardDescription>
                    {step === "method-select" && "Choose how you want to reset your password."}
                    {step === "phone-verify" && "Enter your verification details exactly as registered."}
                </CardDescription>
            </CardHeader>

            {/* Step 1: Method Selection */}
            {step === "method-select" && (
                <CardContent className="space-y-4">
                    <Button
                        variant="outline"
                        className="w-full h-auto py-4 flex items-center justify-between group hover:border-primary"
                        onClick={() => setStep("phone-verify")}
                    >
                        <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-base">I used Phone Number</p>
                                <p className="text-xs text-muted-foreground">Recover using profile details</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                         <Label>I used Email Address</Label>
                         <div className="grid gap-3">
                             <form onSubmit={handleEmailReset} className="flex gap-2">
                                <Input
                                    id="reset-email"
                                    type="email"
                                    placeholder="Enter your email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Sending..." : "Send Link"}
                                </Button>
                             </form>
                             <Button
                                variant="outline"
                                className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-primary"
                                onClick={() => setStep("email-profile-verify")}
                             >
                                <UserCheck className="h-4 w-4" />
                                Or Verify Profile Details
                             </Button>
                         </div>
                    </div>
                </CardContent>
            )}

            {/* Step 2: Email Sent Confirmation */}
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

            {/* Step 3: Phone Verification Form */}
            {step === "phone-verify" && (
                <form onSubmit={(e) => handleVerifyAndReset(e, 'phone')}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Registered Phone Number</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="01XXXXXXXXX"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="fatherName">Father's Name</Label>
                                <Input
                                    id="fatherName"
                                    placeholder="Exact spelling"
                                    required
                                    value={fatherName}
                                    onChange={(e) => setFatherName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="motherName">Mother's Name</Label>
                                <Input
                                    id="motherName"
                                    placeholder="Exact spelling"
                                    required
                                    value={motherName}
                                    onChange={(e) => setMotherName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="hscBatch">HSC Batch</Label>
                            <Input
                                id="hscBatch"
                                placeholder="e.g. 2024"
                                required
                                value={hscBatch}
                                onChange={(e) => setHscBatch(e.target.value)}
                            />
                        </div>

                        <div className="pt-4 border-t border-dashed">
                             <Label className="text-base font-semibold">New Password</Label>
                             <div className="space-y-3 mt-2">
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="New Password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
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
                                    </Button>
                                </div>
                                <Input
                                    type="password"
                                    placeholder="Confirm New Password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                             </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md flex gap-3 text-xs text-blue-700 dark:text-blue-300">
                             <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                             <p>
                                 Verification is case-insensitive but must match the spelling used during registration.
                             </p>
                        </div>

                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Verifying & Resetting..." : "Reset Password"}
                        </Button>
                    </CardFooter>
                </form>
            )}

            {/* Step 3b: Email Profile Verification Form (New) */}
            {step === "email-profile-verify" && (
                <form onSubmit={(e) => handleVerifyAndReset(e, 'email')}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email-verify">Registered Email Address</Label>
                            <Input
                                id="email-verify"
                                type="email"
                                placeholder="user@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="fatherName">Father's Name</Label>
                                <Input
                                    id="fatherName"
                                    placeholder="Exact spelling"
                                    required
                                    value={fatherName}
                                    onChange={(e) => setFatherName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="motherName">Mother's Name</Label>
                                <Input
                                    id="motherName"
                                    placeholder="Exact spelling"
                                    required
                                    value={motherName}
                                    onChange={(e) => setMotherName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="hscBatch">HSC Batch</Label>
                                <Input
                                    id="hscBatch"
                                    placeholder="e.g. 2024"
                                    required
                                    value={hscBatch}
                                    onChange={(e) => setHscBatch(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sscGpa">SSC GPA</Label>
                                <Input
                                    id="sscGpa"
                                    placeholder="e.g. 5.00"
                                    required
                                    value={sscGpa}
                                    onChange={(e) => setSscGpa(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="collegeName">College Name (Exact Spelling)</Label>
                            <Input
                                id="collegeName"
                                placeholder="e.g. Dhaka College"
                                required
                                value={collegeName}
                                onChange={(e) => setCollegeName(e.target.value)}
                            />
                        </div>

                        <div className="pt-4 border-t border-dashed">
                             <Label className="text-base font-semibold">New Password</Label>
                             <div className="space-y-3 mt-2">
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="New Password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
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
                                    </Button>
                                </div>
                                <Input
                                    type="password"
                                    placeholder="Confirm New Password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                             </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md flex gap-3 text-xs text-blue-700 dark:text-blue-300">
                             <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                             <p>
                                 Verification is case-insensitive but must match the spelling used during registration.
                             </p>
                        </div>

                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Verifying & Resetting..." : "Reset Password"}
                        </Button>
                    </CardFooter>
                </form>
            )}

            {/* Step 4: Success */}
            {step === "success" && (
                 <div className="py-8 px-6 text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-muted-foreground mt-2">Your password has been successfully updated. You can now login with your new credentials.</p>
                    </div>
                    <Button className="w-full" onClick={() => navigate("/login")}>
                        Go to Login
                    </Button>
                 </div>
            )}
        </Card>
      </main>
    </div>
  );
};

export default ForgotPassword;
