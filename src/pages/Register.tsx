import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import PublicHeader from "@/components/PublicHeader";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSecondTimer, setIsSecondTimer] = useState(false);
  const [hscBatch, setHscBatch] = useState("2025");
  const [hscGpa, setHscGpa] = useState("");

  useEffect(() => {
    if (hscBatch === "2026" || hscBatch === "2027") {
        setHscGpa("5.00");
    }
  }, [hscBatch]);

  useEffect(() => {
    document.title = "Register – Atlas";
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const fullName = formData.get("fullName") as string;
    const fatherName = formData.get("fatherName") as string;
    const motherName = formData.get("motherName") as string;
    // const registrationId = formData.get("registrationId") as string; // Optional or generated
    const phone = formData.get("phone") as string;
    const emailInput = formData.get("email") as string;
    const hscBatch = formData.get("hscBatch") as string;
    const collegeName = formData.get("collegeName") as string;
    const sscGpa = formData.get("sscGpa") as string;
    const hscGpaForm = formData.get("hscGpa") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (collegeName.trim().length < 10) {
      toast({
        title: "Registration failed",
        description: "Please provide your Full college name",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Registration failed",
        description: "Passwords do not match",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      // 1. Determine Auth Email Strategy
      // If user provided a real email, use it. Otherwise, fallback to phone logic?
      // Requirement: "Real Email" preferred. We make email mandatory in UI now.

      const email = emailInput;

      // Check if email is valid format roughly
      if (!email || !email.includes('@')) {
          throw new Error("Please provide a valid email address.");
      }

      // 2. Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            father_name: fatherName,
            mother_name: motherName,
            hsc_batch: hscBatch,
            college_name: collegeName,
            ssc_gpa: sscGpa,
            hsc_gpa: hscGpaForm,
            phone: phone,
            is_second_timer: isSecondTimer,
          }
        }
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error("No user returned from sign up. Please check your email for verification.");
      }

      // 3. Attempt to insert into profiles if we have a session.
      // Note: If email confirmation is on, we won't have a session yet.
      // But usually `profiles` is inserted via Trigger on server side for security.
      // The existing code was doing client-side insert. Let's keep it for now if session exists.

      if (authData.session) {
        const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authData.user.id,
          registration_id: phone, // Still using phone as the "ID" for admin/legacy purposes
          full_name: fullName,
          father_name: fatherName,
          mother_name: motherName,
          phone: phone,
          hsc_batch: hscBatch,
          college_name: collegeName,
          ssc_gpa: parseFloat(sscGpa) || 0,
          hsc_gpa: parseFloat(hscGpaForm) || 0,
          is_second_timer: isSecondTimer,
          extra_time_multiplier: 1,
        });

        if (profileError) {
          console.error("Profile creation during register failed:", profileError);
          toast({
            title: "Registration Warning",
            description: "Account created but profile setup failed. Please contact support.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Registration successful",
        description: "Account created! Redirecting...",
      });

      if (authData.session) {
          navigate(location.state?.from || "/dashboard", { replace: true });
      } else {
          // If no session (email verification required)
           toast({
            title: "Check your email",
            description: "We sent you a verification link. Please verify your email to login.",
          });
          setTimeout(() => {
            navigate("/login", { state: { from: location.state?.from } });
          }, 3000);
      }

    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: "Registration failed",
        description: error.message || "An error occurred during registration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl border-[3px] border-foreground">
          <CardHeader className="space-y-2 pb-4">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Atlas</p>
            <CardTitle className="text-xl font-semibold">Create an Account</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Register a new student account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Own Full Name</Label>
                  <Input id="fullName" name="fullName" required placeholder="Your full name" />
                  <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide your full name.</p>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" name="phone" required placeholder="01XXXXXXXXX" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                  <Input id="email" name="email" type="email" required placeholder="user@example.com" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fatherName">Father's Full Name</Label>
                  <Input id="fatherName" name="fatherName" required placeholder="Father's full name" />
                  <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide father's full name.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="motherName">Mother's Full Name</Label>
                  <Input id="motherName" name="motherName" required placeholder="Mother's full name" />
                  <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide mother's full name.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collegeName">Full College Name</Label>
                  <Input id="collegeName" name="collegeName" required placeholder="Your full college name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hscBatch">HSC Batch</Label>
                  <select 
                    id="hscBatch" 
                    name="hscBatch" 
                    value={hscBatch}
                    onChange={(e) => setHscBatch(e.target.value)}
                    required 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sscGpa">SSC GPA (Out of 5)</Label>
                  <Input id="sscGpa" name="sscGpa" type="number" step="0.01" max="5.00" min="1.00" required placeholder="5.00" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hscGpa">HSC GPA (Optional)</Label>
                  <Input 
                    id="hscGpa" 
                    name="hscGpa" 
                    type="number" 
                    step="0.01" 
                    max="5.00" 
                    min="0.00" 
                    placeholder="5.00" 
                    value={hscGpa}
                    onChange={(e) => setHscGpa(e.target.value)}
                  />
                  <p className="text-[11px] text-orange-600/90 dark:text-orange-400">If you have not given HSC exam yet, please fill 5.00</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 py-2">
                  <Checkbox
                    id="isSecondTimer"
                    checked={isSecondTimer}
                    onCheckedChange={(checked) => setIsSecondTimer(checked as boolean)}
                  />
                  <Label htmlFor="isSecondTimer" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I am a Second Timer Student
                  </Label>
              </div>

              <div className="flex items-start space-x-2 py-2">
                  <Checkbox
                    id="acknowledgement"
                    required
                  />
                  <Label htmlFor="acknowledgement" className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    আমি স্বীকার করছি যে উপরে দেওয়া সকল তথ্য সঠিক এবং আমি সকল নিয়মাবলী ও নির্দেশনা মেনে চলব। (I acknowledge that all the information provided above is accurate and I will follow all rules and instructions.)
                  </Label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-900/20">
                  <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                      <div className="text-sm text-yellow-800 dark:text-yellow-400">
                          <p className="font-bold mb-1">সতর্কবার্তা!</p>
                          <p>আপনার ফোন নম্বর এবং পাসওয়ার্ড মনে রাখুন এবং কোথাও লিখে রাখুন।</p>
                      </div>
                  </div>
              </div>

              <Button type="submit" className="mt-4 w-full" disabled={loading}>
                {loading ? "Creating Account..." : "Register"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Register;
