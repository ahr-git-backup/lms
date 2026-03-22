import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import PublicHeader from "@/components/PublicHeader";
import { Eye, EyeOff, Loader2, AlertTriangle, LogOut, LayoutDashboard } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

const PublicExamEntry = () => {
    const { examId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user, profile, signOut } = useAuth();

    const [exam, setExam] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSecondTimer, setIsSecondTimer] = useState(false);
    const [activeTab, setActiveTab] = useState("login");
    const [hscBatch, setHscBatch] = useState("2025");
    const [hscGpa, setHscGpa] = useState("");
    const [captchaToken, setCaptchaToken] = useState<string | undefined>();

    useEffect(() => {
        if (hscBatch === "2026" || hscBatch === "2027") {
            setHscGpa("5.00");
        }
    }, [hscBatch]);

    // Fetch Exam Details
    useEffect(() => {
        const fetchExam = async () => {
            const { data, error } = await supabase
                .from("exams")
                .select("title, course_id")
                .eq("id", examId)
                .single();

            if (error || !data) {
                console.warn("Exam fetch failed (likely RLS). Using fallback.", error);
                setExam({ title: "Public Exam Entry", course_id: null });
                return;
            }
            setExam(data);
        };
        fetchExam();
    }, [examId]);

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const identifier = formData.get("identifier") as string;
        const password = formData.get("password") as string;

        let email = identifier;
        const isPhone = /^\d+$/.test(identifier) || (identifier.startsWith('+') && /^\+?\d+$/.test(identifier));
        if (isPhone && !identifier.includes('@')) {
            email = `${identifier}@beshijoss.com`;
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
                options: { captchaToken }
            });
            if (error) throw error;

            toast({ title: "Welcome back!", description: "Starting exam..." });
            navigate(`/dashboard/take-exam/${examId}`);
        } catch (err: any) {
            toast({ title: "Login Failed", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const fullName = formData.get("fullName") as string;
        const fatherName = formData.get("fatherName") as string;
        const motherName = formData.get("motherName") as string;
        const phone = formData.get("phone") as string;
        const emailInput = formData.get("email") as string;
        const hscBatch = formData.get("hscBatch") as string;
        const collegeName = formData.get("collegeName") as string;
        const sscGpa = formData.get("sscGpa") as string;
        const hscGpa = formData.get("hscGpa") as string;
        const password = formData.get("password") as string;
        const confirmPassword = formData.get("confirmPassword") as string;

        if (collegeName.trim().length < 10) {
            toast({ title: "Registration failed", description: "Please provide your Full college name", variant: "destructive" });
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            toast({ title: "Registration failed", description: "Passwords do not match", variant: "destructive" });
            setLoading(false);
            return;
        }

        try {
            const email = emailInput || `${phone}@beshijoss.com`; // Fallback to phone-email if email empty (though we made it required)

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    captchaToken,
                    data: {
                        full_name: fullName,
                        father_name: fatherName,
                        mother_name: motherName,
                        hsc_batch: hscBatch,
                        college_name: collegeName,
                        ssc_gpa: sscGpa,
                        hsc_gpa: hscGpa,
                        phone: phone,
                        is_second_timer: isSecondTimer,
                    }
                }
            });

            if (authError) throw authError;

            if (authData.session) {
                const { error: profileError } = await supabase.from("profiles").insert({
                    id: authData.user?.id,
                    registration_id: phone,
                    full_name: fullName,
                    father_name: fatherName,
                    mother_name: motherName,
                    phone: phone,
                    hsc_batch: hscBatch,
                    college_name: collegeName,
                    ssc_gpa: parseFloat(sscGpa) || 0,
                    hsc_gpa: parseFloat(hscGpa) || 0,
                    is_second_timer: isSecondTimer,
                    extra_time_multiplier: 1,
                });

                if (profileError) {
                    console.error("Profile creation failed:", profileError);
                    toast({ title: "Warning", description: "Account created but profile setup incomplete.", variant: "destructive" });
                }

                toast({ title: "Registered!", description: "Starting exam..." });
                navigate(`/dashboard/take-exam/${examId}`);
            } else {
                toast({ title: "Check your email", description: "Verification link sent." });
            }

        } catch (err: any) {
            toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    if (!exam) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-background font-sans text-foreground">
            <PublicHeader />
            <div className="flex items-center justify-center p-4 py-10 min-h-[calc(100vh-64px)]">

                {user ? (
                    <Card className="w-full max-w-md border-2 border-primary/20 shadow-lg animate-in zoom-in-95 duration-200">
                        <CardHeader className="text-center">
                            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Atlas</p>
                            <CardTitle className="text-2xl font-bold text-primary">{exam.title}</CardTitle>
                            <CardDescription>
                                You are logged in as <span className="font-semibold text-foreground">{profile?.full_name || "User"}</span>.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button onClick={() => { navigate(`/dashboard/take-exam/${examId}`); }} className="w-full h-12 text-lg" size="lg">
                                Start Exam
                            </Button>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={() => signOut()} variant="outline" className="w-full text-muted-foreground hover:text-destructive">
                                <LogOut className="mr-2 h-4 w-4" /> Logout from this account
                            </Button>
                        </CardFooter>
                    </Card>
                ) : (
                    <Card className="w-full max-w-xl border-2 border-primary/20 shadow-lg">
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-2xl font-bold text-primary">{exam.title}</CardTitle>
                            <CardDescription>
                                Please login or register to take this exam.
                                <br />
                                <span className="text-red-500 font-medium">If wrong info given then the gift will be void.</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="login">Login</TabsTrigger>
                                    <TabsTrigger value="register">Register</TabsTrigger>
                                </TabsList>

                                <TabsContent value="login">
                                    <form onSubmit={handleLogin} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="identifier">Email or Phone Number</Label>
                                            <Input id="identifier" name="identifier" required placeholder="user@example.com or 01XXXXXXXXX" />
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
                                                    className="absolute right-0 top-0 h-full px-3"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex justify-center py-2">
                                            <Turnstile
                                                siteKey="0x4AAAAAACpBHrpNCl36IKek"
                                                onSuccess={(token) => setCaptchaToken(token)}
                                            />
                                        </div>
                                        <Button type="submit" className="w-full" size="lg" disabled={loading || !captchaToken}>
                                            {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Login & Start Exam"}
                                        </Button>
                                    </form>
                                </TabsContent>

                                <TabsContent value="register">
                                    <form onSubmit={handleRegister} className="space-y-4">
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
                                                <Label htmlFor="sscGpa">SSC GPA</Label>
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
                                                <Label htmlFor="reg-password">Password</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="reg-password"
                                                        name="password"
                                                        type={showPassword ? "text" : "password"}
                                                        required
                                                        className="pr-10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-0 top-0 h-full px-3"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                    >
                                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                                                        className="absolute right-0 top-0 h-full px-3"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    >
                                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

                                        <div className="flex justify-center py-2">
                                            <Turnstile
                                                siteKey="0x4AAAAAACpBHrpNCl36IKek"
                                                onSuccess={(token) => setCaptchaToken(token)}
                                            />
                                        </div>
                                        <Button type="submit" className="w-full" size="lg" disabled={loading || !captchaToken}>
                                            {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Register & Start Exam"}
                                        </Button>
                                    </form>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default PublicExamEntry;
