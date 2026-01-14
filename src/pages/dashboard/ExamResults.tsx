import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ExamResults = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Exam Results – Atlas";
  }, []);

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["exam-results-report", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // 1. Fetch all attempts
      const { data: rawAttempts, error } = await supabase
        .from("exam_attempts")
        .select("*, exam:exams(*, course:courses(*))")
        .eq("profile_id", user.id);

      if (error) throw error;
      if (!rawAttempts || rawAttempts.length === 0) return [];

      // 2. Fetch Highest Marks (Live Period) for each unique exam
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniqueExamIds = [...new Set(rawAttempts.map((a: any) => a.exam_id))];
      const highScores: Record<string, number | null> = {};

      await Promise.all(
        uniqueExamIds.map(async (examId) => {
          // Check if examId is valid
          if (!examId) return;

          const { data } = await supabase
            .from("leaderboard_exam_attempts")
            .select("score")
            .eq("exam_id", examId)
            .eq("attempt_type", "live")
            .order("score", { ascending: false })
            .limit(1)
            .maybeSingle();

          highScores[examId] = data ? data.score : null;
        })
      );

      // 3. Merge high scores
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rawAttempts.map((attempt: any) => ({
        ...attempt,
        highest_live_score: highScores[attempt.exam_id],
      }));
    },
    enabled: !!user,
  });

  // Grouping Logic
  const groupedAttempts = useMemo(() => {
    if (!attempts) return {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups: Record<string, any[]> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attempts.forEach((attempt: any) => {
      const courseName = attempt.exam.course?.name || "Public Exams";

      if (!groups[courseName]) {
        groups[courseName] = [];
      }
      groups[courseName].push(attempt);
    });

    // Sort chronologically (oldest to newest) within groups
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) =>
        new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      );
    });

    return groups;
  }, [attempts]);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading exam results...</div>;
  }

  if (!attempts || attempts.length === 0) {
    return (
      <Card className="border border-foreground/50">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          No exam results found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Exam Results</h1>
        <p className="text-sm text-muted-foreground">
          Course-wise performance analysis report.
        </p>
      </header>

      {Object.entries(groupedAttempts).map(([courseName, courseAttempts]) => {
        const totalExams = courseAttempts.length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalScore = courseAttempts.reduce((sum: number, a: any) => sum + (Number(a.score) || 0), 0);
        const averageScore = totalExams > 0 ? (totalScore / totalExams).toFixed(2) : "0.00";

        return (
          <div key={courseName} className="space-y-3">
            <h2 className="text-xl font-bold text-foreground border-l-4 border-primary pl-3">
              {courseName}
            </h2>

            <div className="rounded-md border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Date Taken</TableHead>
                    <TableHead className="text-right">Obtained Mark</TableHead>
                    <TableHead className="text-right">Highest Mark (Live)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {courseAttempts.map((attempt: any) => (
                    <TableRow
                        key={attempt.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/dashboard/exam-review/${attempt.id}`)}
                        title="Click to review details"
                    >
                      <TableCell className="font-medium">
                        {attempt.exam.title}
                        {attempt.attempt_type === 'live' && (
                           <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase">Live</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(attempt.submitted_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {attempt.score}
                        <span className="text-muted-foreground font-normal text-xs ml-1">
                           / {attempt.exam.total_marks}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {attempt.highest_live_score !== null ? attempt.highest_live_score : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/5 hover:bg-primary/10">
                    <TableCell colSpan={2} className="font-bold text-primary">Summary</TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      Avg: {averageScore}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      Total Exams: {totalExams}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExamResults;
