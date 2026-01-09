import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import PublicHeader from "@/components/PublicHeader";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const PublicExamEntry = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        // Fallback for public exams if RLS hides them from anon users
        setExam({ title: "Public Exam Entry", course_id: null });
        return;
      }
      setExam(data);
    };
    fetchExam();
  }, [examId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("fullName") as string;
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string;

    // Synthetic email logic
    const email = `${phone}@beshijoss.com`;

    try {
        // 1. Try Signing In
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInData.session) {
            // User exists and logged in. Update profile if needed?
            // Just redirect to exam.
            toast({ title: "Welcome back!", description: "Starting exam..." });
            navigate(`/dashboard/take-exam/${examId}`);
            return;
        }

        // 2. If Sign In failed, try Sign Up (assuming incorrect password or user doesn't exist)
        // If the error explicitly says "Invalid login credentials", we can try registering.
        // But if user exists, register will fail.

        // Let's try registering.
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    phone: phone,
                    is_second_timer: false // Default for quick entry
                }
            }
        });

        if (signUpData.session) {
             // 3. Upsert Profile to ensure it exists for FK
             const { error: profileError } = await supabase.from("profiles").upsert({
                 id: signUpData.user?.id,
                 registration_id: phone,
                 full_name: fullName,
                 phone: phone,
                 // Defaults for required fields if any (check constraints)
                 // Based on schema, others are nullable except maybe some?
                 // Let's provide safe defaults.
                 is_second_timer: false
             }, { onConflict: 'id' });

             if (profileError) {
                 console.error("Profile upsert error:", profileError);
             }

             toast({ title: "Registered!", description: "Starting exam..." });
             navigate(`/dashboard/take-exam/${examId}`);
             return;
        }

        // If we are here, both failed.
        // Likely: User exists but password wrong.
        if (signUpError?.message.includes("already registered") || signInError) {
             toast({
                 title: "Authentication Failed",
                 description: "If you have an account, please enter the correct password. If not, try a different phone number.",
                 variant: "destructive"
             });
        } else {
             throw signUpError || signInError;
        }

    } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  if (!exam) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background font-sans">
      <PublicHeader />
      <div className="flex items-center justify-center p-4 py-10">
        <Card className="w-full max-w-md border-2 border-primary/20 shadow-lg">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-primary">{exam.title}</CardTitle>
                <CardDescription>Enter your details to take this exam.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input name="fullName" required placeholder="Enter your name" />
                    </div>
                    <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input name="phone" required placeholder="01XXXXXXXXX" />
                    </div>
                    <div className="space-y-2">
                        <Label>Password</Label>
                        <div className="relative">
                            <Input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                required
                                placeholder="Create or enter password"
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
                        <p className="text-[10px] text-muted-foreground">
                            Used to view results later or resume.
                        </p>
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Start Exam"}
                    </Button>
                </form>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicExamEntry;
