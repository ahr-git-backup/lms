import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trophy, RotateCw } from "lucide-react";
import { SUBJECTS } from "@/lib/constants";

// Helper Component for Result Card
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ResultCard = ({ attempt, isLive, navigate, profile }: { attempt: any, isLive: boolean, navigate: any, profile: any }) => {
    // Calculate GPA score component if fields exist
    let gpaScore = 0;
    if (profile?.ssc_gpa && profile?.hsc_gpa) {
        gpaScore = (Number(profile.ssc_gpa) * 8) + (Number(profile.hsc_gpa) * 12);
    }
    const totalScoreWithGpa = Number(attempt.score) + gpaScore;
    const percentage = attempt.exam.total_marks > 0 ? ((Number(attempt.score) / Number(attempt.exam.total_marks)) * 100).toFixed(1) : null;

    return (
    <Card className={`border rounded-2xl shadow-md hover:shadow-lg transition-all flex flex-col h-full border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900`}>
        <CardHeader className="space-y-1">
            <div className="flex justify-between items-start">
                <p className="text-xs font-mono uppercase text-muted-foreground">
                    {attempt.exam.course?.name || "Public Exam"}
                </p>
                {isLive && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">LIVE</span>}
            </div>
            <CardTitle className="text-base">{attempt.exam.title}</CardTitle>
            <CardDescription className="text-xs">
                <div>Exam Score: <span className="font-bold text-foreground">{attempt.score}</span> / {attempt.exam.total_marks} {percentage && <span className="ml-1 text-muted-foreground">({percentage}%)</span>}</div>
                {gpaScore > 0 && <div>Total (with GPA): <span className="font-bold text-primary">{totalScoreWithGpa.toFixed(2)}</span></div>}
                <div>Taken on {attempt.submitted_at && new Date(attempt.submitted_at).toLocaleDateString()}</div>
            </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col flex-1">
            <div className="flex gap-1.5 mt-auto">
                <Button
                    size="sm"
                    className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white border-none text-[10px] h-7 px-2"
                    onClick={() => navigate(`/dashboard/exam-review/${attempt.id}`)}
                >
                    Review
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/dashboard/leaderboard/${attempt.exam.id}`)}
                    title="View Leaderboard"
                    className="rounded-full hover:bg-emerald-100 text-emerald-700 h-7 w-7 p-0 shrink-0"
                >
                    <Trophy className="h-3.5 w-3.5" />
                </Button>
            </div>
        </CardContent>
    </Card>
    );
};

const ExamResults = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const { data: enrollments } = useEnrollments();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Results – Atlas";
  }, []);

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["exam-results", user?.id, selectedCourse, selectedSubject],
    queryFn: async () => {
      if (!user) return [];

      const query = supabase
        .from("exam_attempts")
        .select("*, exam:exams(*, course:courses(*))")
        .eq("profile_id", user.id)
        .order("submitted_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];

      if (selectedCourse !== "all") {
        filteredData = filteredData.filter(a => a.exam.course_id === selectedCourse);
      }

      if (selectedSubject !== "all") {
        filteredData = filteredData.filter(a => a.exam.subject === selectedSubject);
      }

      return filteredData;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Exam Results</h1>
        <p className="text-sm text-muted-foreground">Review your scores and answer scripts.</p>
      </header>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground hidden sm:block">Course</div>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {enrollments?.map((enrollment) => (
                <SelectItem key={enrollment.course_id} value={enrollment.course_id}>
                  {enrollment.course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground hidden sm:block">Subject</div>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {SUBJECTS.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : !attempts || attempts.length === 0 ? (
        <Card className="border border-foreground/50">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No exam results found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
            {/* Live Exams Section - Only show actual Live Attempts */}
            {attempts.some(a => a.attempt_type === 'live') && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                        Live Exam Results
                    </h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        {attempts.filter(a => a.attempt_type === 'live').map((attempt) => (
                            <ResultCard key={attempt.id} attempt={attempt} isLive={true} navigate={navigate} profile={profile} />
                        ))}
                    </div>
                </div>
            )}

            {/* Practice Exams Section - Show Practice OR Expired Live (treated as practice) */}
             {attempts.some(a => a.attempt_type !== 'live') && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500"></span>
                        Practice Exam Results
                    </h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        {attempts.filter(a => a.attempt_type !== 'live').map((attempt) => (
                            <ResultCard key={attempt.id} attempt={attempt} isLive={false} navigate={navigate} profile={profile} />
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default ExamResults;
