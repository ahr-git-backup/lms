import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const PAGE_SIZE = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CourseTable = ({ courseName, attempts }: { courseName: string, attempts: any[] }) => {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(attempts.length / PAGE_SIZE);
  const startIndex = (page - 1) * PAGE_SIZE;
  const currentAttempts = attempts.slice(startIndex, startIndex + PAGE_SIZE);

  // Summary Calculations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalScore = attempts.reduce((sum: number, a: any) => sum + (Number(a.score) || 0), 0);
  const averageScore = attempts.length > 0 ? (totalScore / attempts.length).toFixed(2) : "0.00";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground border-l-4 border-primary pl-3">
          {courseName}
        </h2>
        <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
            {attempts.length} Exams
        </span>
      </div>

      <div className="rounded-md border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[40%]">Exam Name</TableHead>
              <TableHead>Exam Date</TableHead>
              <TableHead className="text-right">Obtained Mark</TableHead>
              <TableHead className="text-right">Highest Mark (Live)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentAttempts.map((attempt) => (
              <TableRow key={attempt.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium">
                  {attempt.exam.title}
                  {attempt.attempt_type === 'live' && (
                     <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase">Live</span>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(attempt.submitted_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                  <span className="text-xs text-muted-foreground block">
                     {new Date(attempt.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
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
                    Total: {attempts.length}
                </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                // Simple pagination logic: Show all if small, or just current context if large
                // For simplicity in this iteration, limiting to a sliding window or just showing all if < 7
                (totalPages <= 7 || p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) ? (
                     <PaginationItem key={p}>
                        <PaginationLink
                            href="#"
                            isActive={page === p}
                            onClick={(e) => { e.preventDefault(); setPage(p); }}
                        >
                        {p}
                        </PaginationLink>
                    </PaginationItem>
                ) : (
                    (p === 2 || p === totalPages - 1) && <PaginationItem key={`ellipsis-${p}`}><span className="flex h-9 w-9 items-center justify-center">...</span></PaginationItem>
                )
            ))}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => { e.preventDefault(); setPage(p => Math.min(totalPages, p + 1)); }}
                className={page === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

const ExamAnalytics = () => {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Exam Analytics – Atlas";
  }, []);

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["exam-analytics-comprehensive", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: rawAttempts, error } = await supabase
        .from("exam_attempts")
        .select("*, exam:exams(*, course:courses(*))")
        .eq("profile_id", user.id);

      if (error) throw error;
      if (!rawAttempts || rawAttempts.length === 0) return [];

      // Fetch Highest Marks (Live Period)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniqueExamIds = [...new Set(rawAttempts.map((a: any) => a.exam_id))];
      const highScores: Record<string, number | null> = {};

      // Batch fetches in chunks of 10 to avoid too many parallel connections if list is huge
      const chunkSize = 10;
      for (let i = 0; i < uniqueExamIds.length; i += chunkSize) {
          const chunk = uniqueExamIds.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (examId) => {
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
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rawAttempts.map((attempt: any) => ({
        ...attempt,
        highest_live_score: highScores[attempt.exam_id],
      }));
    },
    enabled: !!user,
  });

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

    // Sort chronologically (Oldest first as per "chronologically" usually means,
    // but typically users want newest last in a table, or newest first?
    // "sort the exams chronologically (by date)" usually means Date Ascending (Jan 1, Jan 2, Jan 3).
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) =>
        new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      );
    });

    return groups;
  }, [attempts]);

  const totalAttempts = attempts?.length ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalAvg = totalAttempts > 0 ? (attempts!.reduce((sum: number, a: any) => sum + (Number(a.score) || 0), 0) / totalAttempts).toFixed(2) : "0.00";

  return (
    <section className="space-y-8 pb-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Exam Analysis Report</h1>
        <p className="text-sm text-muted-foreground">
          Comprehensive course-wise performance analysis.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading analysis...</p>
      ) : totalAttempts === 0 ? (
        <Card className="border border-foreground/60">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            You have not completed any exams yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
           {/* Top Stats Cards - Keeping these for high-level context */}
           <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-foreground/20 shadow-sm bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Exams Taken</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAttempts}</div>
              </CardContent>
            </Card>
            <Card className="border border-foreground/20 shadow-sm bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Global Average Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{globalAvg}</div>
              </CardContent>
            </Card>
            <Card className="border border-foreground/20 shadow-sm bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Courses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Object.keys(groupedAttempts).length}</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-10">
            {Object.entries(groupedAttempts).map(([courseName, courseAttempts]) => (
                <CourseTable key={courseName} courseName={courseName} attempts={courseAttempts} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default ExamAnalytics;
