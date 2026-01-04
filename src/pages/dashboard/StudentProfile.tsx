import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Clock, BookOpen, PenTool, CheckCircle, Flame, Target, Calculator, PlusCircle, ArrowRight } from "lucide-react";
import { startOfWeek, startOfMonth } from "date-fns";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Link } from "react-router-dom";

const profileSchema = z.object({
  full_name: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  school: z.string().trim().max(160).optional().or(z.literal("")),
  batch_year: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((val) => val === "" || (/^\d{4}$/.test(val) && Number(val) >= 2000 && Number(val) <= 2100), {
      message: "Enter a valid year between 2000 and 2100",
    }),
  is_second_timer: z.enum(["yes", "no"]).optional(),
  father_name: z.string().optional(),
  mother_name: z.string().optional(),
  college_name: z.string().optional(),
  hsc_batch: z.string().optional(),
  ssc_gpa: z.coerce.number().min(1).max(5).optional(),
  hsc_gpa: z.coerce.number().min(1).max(5).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const StudentProfile = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: enrollments } = useEnrollments();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<any>(null);
  const [timeRange, setTimeRange] = useState("daily");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    document.title = "Student Profile – Beshi Joss LMS";
    const fetchStats = async () => {
      if (!profile) return;

      let newStats = {
            total_study_time: 0,
            total_class_time: 0,
            total_exam_time: 0,
            flashcards_reviewed: 0,
            todos_completed: 0,
            pomodoros_completed: 0
      };

      if (timeRange === 'all') {
          const { data } = await supabase.from('user_study_data').select('stats').eq('user_id', profile.id).single();
          if (data?.stats) newStats = data.stats;
      } else {
          // Fetch from logs for specific range
          let startDate = new Date();
          const now = new Date();

          if (timeRange === 'daily') {
              startDate = new Date(now.setHours(0,0,0,0));
          } else if (timeRange === 'weekly') {
              startDate = startOfWeek(now, { weekStartsOn: 6 }); // Saturday start
          } else if (timeRange === 'monthly') {
              startDate = startOfMonth(now);
          }

          const { data: logs } = await supabase
            .from('study_activity_logs')
            .select('activity_type, duration_seconds, metadata')
            .eq('user_id', profile.id)
            .gte('created_at', startDate.toISOString());

          if (logs) {
              logs.forEach(log => {
                  const durationMins = log.duration_seconds ? Math.floor(log.duration_seconds / 60) : 0;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const count = (log.metadata as any)?.count || 0;

                  if (log.activity_type === 'study') newStats.total_study_time += durationMins;
                  else if (log.activity_type === 'class') newStats.total_class_time += durationMins;
                  else if (log.activity_type === 'exam') newStats.total_exam_time += durationMins;
                  else if (log.activity_type === 'flashcard') newStats.flashcards_reviewed += count;
                  else if (log.activity_type === 'pomodoro') newStats.pomodoros_completed += count;
              });
          }
      }
      setStats(newStats);
    };
    fetchStats();
  }, [profile, timeRange]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      school: profile?.school ?? "",
      batch_year: profile?.batch_year ? String(profile.batch_year) : "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      is_second_timer: (profile as any)?.is_second_timer ? "yes" : "no",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      father_name: (profile as any)?.father_name ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mother_name: (profile as any)?.mother_name ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      college_name: (profile as any)?.college_name ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hsc_batch: (profile as any)?.hsc_batch ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ssc_gpa: (profile as any)?.ssc_gpa ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hsc_gpa: (profile as any)?.hsc_gpa ?? 0,
    },
    // Using values to update form when profile loads
    values: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      school: profile?.school ?? "",
      batch_year: profile?.batch_year ? String(profile.batch_year) : "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      is_second_timer: (profile as any)?.is_second_timer ? "yes" : "no",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      father_name: (profile as any)?.father_name ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mother_name: (profile as any)?.mother_name ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      college_name: (profile as any)?.college_name ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hsc_batch: (profile as any)?.hsc_batch ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ssc_gpa: (profile as any)?.ssc_gpa ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hsc_gpa: (profile as any)?.hsc_gpa ?? 0,
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    if (!profile) return;

    const batchYearNumber = values.batch_year ? Number(values.batch_year) : null;
    const isSecondTimer = values.is_second_timer === "yes";

    const { error } = await supabase
      .from("profiles")
      .update({
        phone: values.phone || null,
        school: values.school || null,
        batch_year: batchYearNumber,
        is_second_timer: isSecondTimer,
        father_name: values.father_name,
        mother_name: values.mother_name,
        college_name: values.college_name,
        hsc_batch: values.hsc_batch,
        ssc_gpa: values.ssc_gpa,
        hsc_gpa: values.hsc_gpa,
      })
      .eq("id", profile.id);

    if (error) {
      toast({
        title: "Could not update profile",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Profile updated",
      description: "Your profile information has been saved.",
    });
  };

  const formatDuration = (minutes: number) => {
      if (!minutes) return "0m";
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const sscGpa = form.watch("ssc_gpa") || 0;
  const hscGpa = form.watch("hsc_gpa") || 0;
  const gpaScore = (sscGpa * 8) + (hscGpa * 12);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Student Profile</h1>
        <p className="text-sm text-muted-foreground">
          Track your progress and manage your account details.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card (Compact vs Edit) */}
        <Card className="md:col-span-2 border border-foreground/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-base">Personal Details</CardTitle>
                    <CardDescription>
                        {isEditing ? "Update your contact and academic information." : "Your registered profile information."}
                    </CardDescription>
                </div>
                {!isEditing && (
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                        <PenTool className="h-4 w-4 mr-2" /> Edit Profile
                    </Button>
                )}
            </CardHeader>
            <CardContent>
            {profile ? (
                isEditing ? (
                    <form className="space-y-4" onSubmit={form.handleSubmit((v) => { onSubmit(v); setIsEditing(false); })}>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="full_name">Full name</Label>
                                <Input id="full_name" {...form.register("full_name")} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label>Registration ID</Label>
                                <Input value={profile.registration_id} disabled className="bg-muted" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" {...form.register("phone")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="father_name">Father's Name</Label>
                                <Input id="father_name" {...form.register("father_name")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mother_name">Mother's Name</Label>
                                <Input id="mother_name" {...form.register("mother_name")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="college_name">College Name</Label>
                                <Input id="college_name" {...form.register("college_name")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="hsc_batch">HSC Batch</Label>
                                <Input id="hsc_batch" {...form.register("hsc_batch")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="school">School / College</Label>
                                <Input id="school" {...form.register("school")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ssc_gpa">SSC GPA</Label>
                                <Input id="ssc_gpa" type="number" step="0.01" {...form.register("ssc_gpa")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="hsc_gpa">HSC GPA</Label>
                                <Input id="hsc_gpa" type="number" step="0.01" {...form.register("hsc_gpa")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="batch_year">Batch year</Label>
                                <Input id="batch_year" placeholder="2025" {...form.register("batch_year")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="is_second_timer">Second Timer?</Label>
                                <Select
                                value={form.watch("is_second_timer")}
                                onValueChange={(val: "yes" | "no") => form.setValue("is_second_timer", val)}
                                >
                                <SelectTrigger id="is_second_timer">
                                    <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no">No</SelectItem>
                                    <SelectItem value="yes">Yes</SelectItem>
                                </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2 border-t mt-4">
                            <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                Save Changes
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8 text-sm">
                         <div>
                            <span className="block text-muted-foreground text-xs uppercase tracking-wide">Full Name</span>
                            <span className="font-medium">{profile.full_name || "-"}</span>
                         </div>
                         <div>
                            <span className="block text-muted-foreground text-xs uppercase tracking-wide">Registration ID</span>
                            <span className="font-medium">{profile.registration_id}</span>
                         </div>
                         <div>
                            <span className="block text-muted-foreground text-xs uppercase tracking-wide">Phone</span>
                            <span className="font-medium">{profile.phone || "-"}</span>
                         </div>
                         <div>
                            <span className="block text-muted-foreground text-xs uppercase tracking-wide">College</span>
                            <span className="font-medium">{
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (profile as any).college_name || "-"
                            }</span>
                         </div>
                         <div>
                            <span className="block text-muted-foreground text-xs uppercase tracking-wide">HSC Batch</span>
                            <span className="font-medium">{
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (profile as any).hsc_batch || "-"
                            }</span>
                         </div>
                         <div>
                            <span className="block text-muted-foreground text-xs uppercase tracking-wide">Second Timer</span>
                            <span className="font-medium">{
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (profile as any).is_second_timer ? "Yes" : "No"
                            }</span>
                         </div>
                         <div>
                            <span className="block text-muted-foreground text-xs uppercase tracking-wide">Father's Name</span>
                            <span className="font-medium">{
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (profile as any).father_name || "-"
                            }</span>
                         </div>
                         <div>
                            <span className="block text-muted-foreground text-xs uppercase tracking-wide">Mother's Name</span>
                            <span className="font-medium">{
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (profile as any).mother_name || "-"
                            }</span>
                         </div>
                         <div>
                            <span className="block text-muted-foreground text-xs uppercase tracking-wide">SSC GPA</span>
                            <span className="font-medium">{
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (profile as any).ssc_gpa || "0.00"
                            }</span>
                         </div>
                         <div>
                            <span className="block text-muted-foreground text-xs uppercase tracking-wide">HSC GPA</span>
                            <span className="font-medium">{
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (profile as any).hsc_gpa || "0.00"
                            }</span>
                         </div>
                    </div>
                )
            ) : (
                <p className="text-sm text-muted-foreground">Loading profile…</p>
            )}
            </CardContent>
        </Card>

        {/* Enrolled Courses Section */}
        <div className="md:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">My Enrolled Courses</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {enrollments?.map((enrollment) => (
                    <Card key={enrollment.id} className="overflow-hidden border border-border/60 hover:border-primary/50 transition-colors group">
                        <div className="aspect-video bg-muted relative overflow-hidden">
                             {enrollment.course?.image_url ? (
                                <img src={enrollment.course.image_url} alt={enrollment.course.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                             ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                    <BookOpen className="h-10 w-10 text-primary/40" />
                                </div>
                             )}
                             <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                Active
                             </div>
                        </div>
                        <CardContent className="p-4 space-y-3">
                            <h3 className="font-bold line-clamp-1 group-hover:text-primary transition-colors">{enrollment.course?.name || "Unknown Course"}</h3>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Enrolled: {new Date(enrollment.created_at).toLocaleDateString()}</span>
                            </div>
                            <Button asChild variant="outline" size="sm" className="w-full mt-2">
                                <Link to={`/dashboard/class-notes`}>
                                    Continue Learning
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}

                {/* Buy More Card */}
                <Card className="border-2 border-dashed border-muted hover:border-primary/50 transition-colors flex flex-col items-center justify-center text-center p-6 gap-4 cursor-pointer min-h-[250px] bg-muted/10" onClick={() => window.location.href = "/"}>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <PlusCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Enroll in New Course</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[150px] mx-auto">Explore premium courses and boost your preparation.</p>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1">
                        Browse Courses <ArrowRight className="h-3 w-3" />
                    </Button>
                </Card>
            </div>
        </div>
      </div>
    </section>
  );
};

export default StudentProfile;
