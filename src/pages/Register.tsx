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
import { Eye, EyeOff, AlertTriangle, PhoneCall, MessageCircle, Send } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

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
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [duplicatePhone, setDuplicatePhone] = useState<string | null>(null);

  useEffect(() => {
    if (hscBatch === "2026" || hscBatch === "2027") {
      setHscGpa("5.00");
    }
  }, [hscBatch]);

  useEffect(() => {
    document.title = "Register – Atlas";
  }, []);

  const convertToEnglishDigits = (str: string) => {
    const bengaliToEnglish: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    return str.split('').map(char => bengaliToEnglish[char] || char).join('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const fullName = formData.get("fullName") as string;
    const fatherName = formData.get("fatherName") as string;
    const motherName = formData.get("motherName") as string;
    // const registrationId = formData.get("registrationId") as string; // Optional or generated
    const rawPhone = formData.get("phone") as string;
    const phone = convertToEnglishDigits(rawPhone).trim();
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

    const validPrefixes = ['013', '014', '015', '016', '017', '018', '019'];
    if (phone.length !== 11 || !validPrefixes.some(prefix => phone.startsWith(prefix))) {
      toast({
        title: "Registration failed",
        description: "Please enter a valid 11-digit phone number starting with a recognized prefix.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      // 0. Check if phone already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (existingProfile) {
        setDuplicatePhone(phone);
        setLoading(false);
        return;
      }
      // 1. Determine Auth Email Strategy
      // If user provided a real email, use it. Otherwise, fallback to phone logic?
      // Requirement: "Real Email" preferred. We make email mandatory in UI now.

      const email = emailInput.trim().toLowerCase();

      // Check if email is valid format roughly
      if (!email || !email.includes('@')) {
        throw new Error("Please provide a valid email address.");
      }

      const emailDomain = email.split('@')[1];
      const allowedDomains = ['atlascourses.com', 'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
      if (!allowedDomains.includes(emailDomain)) {
        throw new Error("Only Gmail, Yahoo, Outlook, or Hotmail accounts are allowed.");
      }

      // 2. Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          captchaToken,
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

      // Note: The public.profiles insertion is now handled safely by a database trigger (handle_new_user)
      // which automatically runs when the user is created in Supabase Auth. This prevents issues when email verification is required.


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
            {/* Duplicate Phone Alert */}
            {duplicatePhone && (
              <div className="mb-4 rounded-lg border-2 border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-700 p-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-start gap-3">
                  <PhoneCall className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div className="space-y-2">
                    <p className="font-bold text-red-700 dark:text-red-400">এই ফোন নম্বরটি আগেই রেজিস্ট্রেশন করা হয়েছে!</p>
                    <p className="text-sm text-red-600 dark:text-red-300">
                      <span className="font-mono font-bold">{duplicatePhone}</span> নম্বর দিয়ে আগেই একটি অ্যাকাউন্ট আছে।
                      যদি সাহায্য দরকার হয়, আমাদের সাথে যোগাযোগ করুন:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href="https://wa.me/8801999681290"
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90 transition-opacity"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                      <a
                        href="https://t.me/rafi_somc"
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0088cc] text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90 transition-opacity"
                      >
                        <Send className="h-3.5 w-3.5" /> Telegram
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                  <p className="text-[11px] text-orange-600/90 dark:text-orange-400">Please provide your full college name.</p>
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
                  আমি স্বীকার করছি যে উপরে দেওয়া সকল তথ্য সঠিক। ভুয়া বা ভুল নম্বর ও তথ্য দিলে জরিমানা বা একাউন্ট বাতিল হতে পারে। (I acknowledge that providing fake information may result in fine or account suspension.)
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
                  <div className="text-sm text-yellow-800 dark:text-yellow-400 space-y-1">
                    <p className="font-bold mb-1 text-base">সতর্কবার্তা!</p>
                    <p>আপনার ফোন নম্বর এবং পাসওয়ার্ড মনে রাখুন এবং কোথাও লিখে রাখুন।</p>
                    <p className="font-semibold text-red-600 dark:text-red-400">অবশ্যই নিজের সচল ইমেইল দিবেন।</p>
                    <p>আপনার ইমেইলে একটি ভেরিফিকেশন লিংক যাবে, যা দিয়ে একাউন্ট ভেরিফাই করতে হবে। ইনবক্সে না পেলে Spam ফোল্ডার চেক করুন। ইমেইল ভেরিফাই না করলে লগইন করা যাবে না। লিংকটি ২৪ ঘণ্টার মধ্যে এক্সপায়ার হয়ে যাবে।</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center py-2">
                <Turnstile
                  siteKey="1x00000000000000000000AA"
                  onSuccess={(token) => setCaptchaToken(token)}
                />
              </div>

              <div className="flex items-start space-x-2 py-2 mt-2 mb-1">
                <Checkbox
                  id="emailVerificationConfirm"
                  required
                />
                <Label htmlFor="emailVerificationConfirm" className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I confirm that I understand an email verification link will be sent to the email address I provided, and I must verify it to login. (আমি বুঝতে পেরেছি যে আমার ইমেইলে একটি ভেরিফিকেশন লিংক যাবে এবং লগইন করার জন্য আমাকে সেটি ভেরিফাই করতে হবে।)
                </Label>
              </div>

              <Button type="submit" className="mt-4 w-full" disabled={loading || !captchaToken}>
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
