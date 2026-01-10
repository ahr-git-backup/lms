import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import PublicHeader from "@/components/PublicHeader";
import { ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<"verify" | "reset" | "success">("verify");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [phone, setPhone] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [hscBatch, setHscBatch] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    document.title = "Recover Account – Atlas";
  }, []);

  const handleVerifyAndReset = async (e: React.FormEvent) => {
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
        const { data, error } = await supabase.rpc('verify_and_reset_password', {
            p_phone: phone,
            p_father_name: fatherName,
            p_mother_name: motherName,
            p_hsc_batch: hscBatch,
            p_new_password: newPassword
        });

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
            {step === "verify" && (
                <form onSubmit={handleVerifyAndReset}>
                    <CardHeader className="space-y-2 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                             <Button variant="ghost" size="icon" className="-ml-3 h-8 w-8" onClick={() => navigate("/login")} type="button">
                                <ArrowLeft className="h-4 w-4" />
                             </Button>
                             <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Atlas</p>
                        </div>
                        <CardTitle className="text-xl font-semibold">Recover Account</CardTitle>
                        <CardDescription>
                            Enter your verification details exactly as registered to reset your password.
                        </CardDescription>
                    </CardHeader>
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

            {step === "success" && (
                 <div className="py-8 px-6 text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Password Reset!</h2>
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
