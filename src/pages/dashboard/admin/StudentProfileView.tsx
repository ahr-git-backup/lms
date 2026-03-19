import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Calendar, BookOpen, Presentation, FileText, CheckCircle2, XCircle, MinusCircle, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function StudentProfileView() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-student-profile", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["admin-student-analytics", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      
      // 1. Fetch user's enrollments and course details
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id, courses(name, price, created_at)")
        .eq("profile_id", studentId);

      const courseIds = enrollments?.map(e => e.course_id) || [];
      
      // 2. Fetch all exams belonging to these courses to know total pool
      const { data: exams } = await supabase
        .from("exams")
        .select("id, course_id, title, exam_type")
        .in("course_id", courseIds.length > 0 ? courseIds : ['']);

      // 3. Fetch all classes
      const { data: classes } = await supabase
        .from("classes")
        .select("id, course_id, title")
        .in("course_id", courseIds.length > 0 ? courseIds : ['']);

      // 4. Fetch all exam attempts
      const { data: attempts } = await supabase
        .from("exam_attempts")
        .select("id, exam_id, score, created_at")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false });

      // Group by course
      const courseProgress = enrollments?.map(enrollment => {
        const courseExams = exams?.filter(e => e.course_id === enrollment.course_id) || [];
        const courseClasses = classes?.filter(c => c.course_id === enrollment.course_id) || [];
        
        const liveExams = courseExams.filter(e => e.exam_type === 'live');
        const practiceExams = courseExams.filter(e => e.exam_type === 'practice');

        const courseAttempts = attempts?.filter(a => courseExams.some(ce => ce.id === a.exam_id)) || [];
        
        // Count unique exams attempted
        const attemptedExamsCount = new Set(courseAttempts.map(a => a.exam_id)).size;

        const progressPercentage = courseExams.length === 0 ? 0 : Math.round((attemptedExamsCount / courseExams.length) * 100);

        return {
          courseId: enrollment.course_id,
          courseName: (enrollment.courses as any)?.name || "Unknown Course",
          totalClasses: courseClasses.length,
          totalExams: courseExams.length,
          liveExamsTotal: liveExams.length,
          practiceExamsTotal: practiceExams.length,
          attempts: courseAttempts,
          progressPercentage
        };
      }) || [];

      return {
        courseProgress,
        globalStats: {
          totalEnrolled: enrollments?.length || 0,
          totalAttempts: attempts?.length || 0
        },
        recentAttempts: attempts?.slice(0, 10).map(a => {
            const examInfo = exams?.find(e => e.id === a.exam_id);
            return {
                ...a,
                examTitle: examInfo?.title || 'Unknown Exam',
                examType: examInfo?.exam_type || 'Unknown'
            }
        }) || []
      };
    },
    enabled: !!studentId,
  });

  const isLoading = profileLoading || analyticsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50 mb-4" />
        <p className="text-muted-foreground">Loading student profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
        <User className="h-16 w-16 mb-4 opacity-20" />
        <h2 className="text-xl font-bold">Student Not Found</h2>
        <Button variant="link" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{profile.full_name || "Unknown Student"}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
               <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold">User ID: {profile.registration_id}</span>
               {profile.phone && <span>• {profile.phone}</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Identity Card */}
          <Card className="md:col-span-1 shadow-sm h-fit">
              <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Profile Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex flex-col justify-center items-center mb-6 pt-2 pb-4 border-b">
                      <div className="h-24 w-24 bg-secondary rounded-full flex items-center justify-center text-4xl mb-3 shadow-inner text-muted-foreground">
                          {profile.full_name?.charAt(0) || <User />}
                      </div>
                      <div className="text-sm font-medium">{profile.school || 'College not provided'}</div>
                      <div className="text-xs text-muted-foreground">Batch {profile.batch_year || 'N/A'}</div>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                              <div className="text-xs text-muted-foreground">Signed Up Date</div>
                              <div className="font-medium">{profile.created_at ? format(new Date(profile.created_at), 'PPP') : 'N/A'}</div>
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <div>
                              <div className="text-xs text-muted-foreground">Courses Bought</div>
                              <div className="font-medium">{analytics?.globalStats.totalEnrolled || 0} enrolled</div>
                          </div>
                      </div>
                  </div>
              </CardContent>
          </Card>

          {/* Analytics Area */}
          <div className="md:col-span-3 space-y-6">
              {/* Top Stats Row */}
              <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-primary/5 border-primary/20 shadow-none">
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                          <BookOpen className="h-5 w-5 text-primary mb-2 opacity-80" />
                          <div className="text-2xl font-bold">{analytics?.globalStats.totalEnrolled || 0}</div>
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Courses Enrolled</div>
                      </CardContent>
                  </Card>
                  <Card className="bg-primary/5 border-primary/20 shadow-none">
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                          <FileText className="h-5 w-5 text-primary mb-2 opacity-80" />
                          <div className="text-2xl font-bold">{analytics?.globalStats.totalAttempts || 0}</div>
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Exams Given</div>
                      </CardContent>
                  </Card>
              </div>

              {/* Course Breakdowns */}
              <Card className="shadow-sm">
                  <CardHeader>
                      <CardTitle>Enrolled Courses Progress</CardTitle>
                      <CardDescription>Metrics spanning across all active courses the student owns.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      {analytics?.courseProgress.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                              No courses found for this student.
                          </div>
                      ) : (
                          analytics?.courseProgress.map((course) => (
                              <div key={course.courseId} className="space-y-3">
                                  <div className="flex justify-between items-center">
                                      <h4 className="font-semibold">{course.courseName}</h4>
                                      <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{course.progressPercentage}% Progress</span>
                                  </div>
                                  <Progress value={course.progressPercentage} className="h-2" />
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border text-sm">
                                          <Presentation className="h-4 w-4 text-blue-500" />
                                          <div>
                                              <span className="font-semibold">{course.totalClasses}</span> Total Classes
                                              <p className="text-[10px] text-muted-foreground leading-none mt-1">(Attendance log empty)</p>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border text-sm">
                                          <FileText className="h-4 w-4 text-orange-500" />
                                          <div>
                                              <span className="font-semibold">{course.attempts.filter(a => course.liveExamsTotal > 0).length}</span> Live Exams Taken
                                              <p className="text-[10px] text-muted-foreground leading-none mt-1">Out of {course.liveExamsTotal} available</p>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border text-sm">
                                          <FileText className="h-4 w-4 text-purple-500" />
                                          <div>
                                              <span className="font-semibold">{course.attempts.filter(a => course.practiceExamsTotal > 0).length}</span> Practice Exams
                                              <p className="text-[10px] text-muted-foreground leading-none mt-1">Multiple attempts logged</p>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </CardContent>
              </Card>

              {/* Recent Activity Log */}
              <Card className="shadow-sm">
                  <CardHeader>
                      <CardTitle>Recent Exam Activity</CardTitle>
                      <CardDescription>Latest generated exam results and practice runs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      {analytics?.recentAttempts.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">No recent activity found.</div>
                      ) : (
                          <div className="space-y-4">
                              {analytics?.recentAttempts.map((attempt) => (
                                  <div key={attempt.id} className="flex justify-between items-center p-3 border rounded-lg bg-card">
                                      <div>
                                          <div className="font-semibold flex items-center gap-2">
                                              <span>{attempt.examTitle}</span>
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider ${attempt.examType === 'live' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                  {attempt.examType}
                                              </span>
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-1">
                                              {format(new Date(attempt.created_at), 'PPp')}
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <div className="font-bold text-lg text-primary">{attempt.score?.toFixed(2)} Score</div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </CardContent>
              </Card>
          </div>
      </div>
    </div>
  );
}
