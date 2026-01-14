import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Helper to determine status
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLiveStatus = (exam: any, attempt: any) => {
    if (attempt) return attempt.score; // Taken
    const now = new Date();
    const endTime = new Date(exam.time_window_end);
    if (now > endTime) return "Absent"; // Missed
    return "-"; // Upcoming or Ongoing
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPracticeStatus = (attempt: any) => {
    if (attempt) return attempt.score;
    return "Absent"; // Per user request
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CourseTable = ({ courseName, exams }: { courseName: string, exams: any[] }) => {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(exams.length / PAGE_SIZE);
  const startIndex = (page - 1) * PAGE_SIZE;
  const currentExams = exams.slice(startIndex, startIndex + PAGE_SIZE);

  // Summary Calculations
  const liveStats = exams.reduce((acc, exam) => {
      if (exam.liveAttempt) {
          acc.obtained += Number(exam.liveAttempt.score) || 0;
          acc.total += exam.total_marks || 0;
      } else if (getLiveStatus(exam, null) === "Absent") {
           // If absent, we still count the total marks as 'lost' potential?
           // Usually "Obtained / Full Marks Sum" implies sum of full marks of ALL exams listed?
           // "obtained mark/out of full marks sum"
           // Let's sum total marks of ALL exams in the list, and obtained of what was taken.
           acc.total += exam.total_marks || 0;
      }
      return acc;
  }, { obtained: 0, total: 0 });

  const practiceStats = exams.reduce((acc, exam) => {
       // Practice is always available, so sum total marks of all exams
       acc.total += exam.total_marks || 0;
       if (exam.practiceAttempt) {
           acc.obtained += Number(exam.practiceAttempt.score) || 0;
       }
       return acc;
  }, { obtained: 0, total: 0 });


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground border-l-4 border-primary pl-3">
          {courseName}
        </h2>
        <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
            {exams.length} Exams
        </span>
      </div>

      <div className="rounded-md border bg-card overflow-hidden shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="min-w-[250px] whitespace-normal">Exam Name</TableHead>
              <TableHead className="whitespace-nowrap">Exam Date</TableHead>
              <TableHead className="text-right whitespace-nowrap">Live Mark</TableHead>
              <TableHead className="text-right whitespace-nowrap">Practice Mark</TableHead>
              <TableHead className="text-right whitespace-nowrap">Highest (Live)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentExams.map((item) => {
              const liveStatus = getLiveStatus(item, item.liveAttempt);
              const practiceStatus = getPracticeStatus(item.practiceAttempt);

              return (
              <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium min-w-[250px]">
                  <div className="line-clamp-2" title={item.title}>
                    {item.title}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(item.time_window_start || item.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                  <span className="text-xs text-muted-foreground block">
                     {new Date(item.time_window_start || item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </TableCell>

                {/* Live Mark Column */}
                <TableCell className="text-right font-bold whitespace-nowrap">
                  {liveStatus === "Absent" ? (
                      <span className="text-red-500 font-medium">Absent</span>
                  ) : liveStatus === "-" ? (
                      <span className="text-muted-foreground">-</span>
                  ) : (
                      <span>{liveStatus} <span className="text-muted-foreground text-xs font-normal">/ {item.total_marks}</span></span>
                  )}
                </TableCell>

                 {/* Practice Mark Column */}
                 <TableCell className="text-right font-bold whitespace-nowrap">
                  {practiceStatus === "Absent" ? (
                      <span className="text-muted-foreground/50 font-normal">Absent</span>
                  ) : (
                      <span>{practiceStatus} <span className="text-muted-foreground text-xs font-normal">/ {item.total_marks}</span></span>
                  )}
                </TableCell>

                <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                  {item.highest_live_score !== null ? item.highest_live_score : "-"}
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-primary/5 hover:bg-primary/10">
                <TableCell colSpan={2} className="font-bold text-primary">Summary</TableCell>
                <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                    {liveStats.obtained} / {liveStats.total}
                </TableCell>
                <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                    {practiceStats.obtained} / {practiceStats.total}
                </TableCell>
                <TableCell />
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
  const { data: enrollments } = useEnrollments();

  useEffect(() => {
    document.title = "Exam Analytics – Atlas";
  }, []);

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["exam-analytics-comprehensive-v2", user?.id, enrollments?.length],
    queryFn: async () => {
      if (!user) return null;

      // 1. Get Course IDs
      const courseIds = enrollments?.map(e => e.course_id) || [];

      // 2. Fetch ALL Exams (Active + Archived?)
      // We assume public exams (course_id is null) + enrolled course exams
      let examsQuery = supabase
        .from("exams")
        .select("id, title, total_marks, time_window_start, time_window_end, course_id, course:courses(name), created_at");

      if (courseIds.length > 0) {
          examsQuery = examsQuery.or(`course_id.in.(${courseIds.join(',')}),course_id.is.null`);
      } else {
          examsQuery = examsQuery.is("course_id", null);
      }

      const { data: allExams, error: examsError } = await examsQuery;
      if (examsError) throw examsError;

      // 3. Fetch Attempts
      const { data: attempts, error: attemptsError } = await supabase
        .from("exam_attempts")
        .select("id, exam_id, score, attempt_type, submitted_at")
        .eq("profile_id", user.id);

      if (attemptsError) throw attemptsError;

      // 4. Fetch High Scores (Live)
      const uniqueExamIds = allExams?.map(e => e.id) || [];
      const highScores: Record<string, number | null> = {};

      const chunkSize = 10;
      for (let i = 0; i < uniqueExamIds.length; i += chunkSize) {
          const chunk = uniqueExamIds.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (examId) => {
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

      // 5. Merge Data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mergedExams = allExams?.map((exam: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const examAttempts = attempts?.filter((a: any) => a.exam_id === exam.id) || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const liveAttempt = examAttempts.find((a: any) => a.attempt_type === 'live');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const practiceAttempt = examAttempts.find((a: any) => a.attempt_type !== 'live'); // Treat non-live as practice

          return {
              ...exam,
              liveAttempt,
              practiceAttempt,
              highest_live_score: highScores[exam.id]
          };
      });

      return mergedExams || [];
    },
    enabled: !!user && enrollments !== undefined,
  });

  const groupedExams = useMemo(() => {
    if (!analyticsData) return {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups: Record<string, any[]> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    analyticsData.forEach((exam: any) => {
      const courseName = exam.course?.name || "Public Exams";
      if (!groups[courseName]) {
        groups[courseName] = [];
      }
      groups[courseName].push(exam);
    });

    // Sort chronologically (Oldest first)
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) =>
        new Date(a.time_window_start || a.created_at).getTime() - new Date(b.time_window_start || b.created_at).getTime()
      );
    });

    return groups;
  }, [analyticsData]);

  const totalExams = analyticsData?.length ?? 0;

  // Calculate Global Stats
  // Live: Obtained / Total (where exam ended)
  const globalLiveObtained = analyticsData?.reduce((sum, e) => sum + (Number(e.liveAttempt?.score) || 0), 0) || 0;
  const globalLiveTotal = analyticsData?.reduce((sum, e) => sum + (e.total_marks || 0), 0) || 0; // Simplified to all exams

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
      ) : totalExams === 0 ? (
        <Card className="border border-foreground/60">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No exams found available for you.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
           <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-foreground/20 shadow-sm bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Exams Available</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalExams}</div>
              </CardContent>
            </Card>
            <Card className="border border-foreground/20 shadow-sm bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Live Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                    {globalLiveObtained} <span className="text-sm text-muted-foreground font-normal">/ {globalLiveTotal}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-foreground/20 shadow-sm bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Courses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Object.keys(groupedExams).length}</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-10">
            {Object.entries(groupedExams).map(([courseName, exams]) => (
                <CourseTable key={courseName} courseName={courseName} exams={exams} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default ExamAnalytics;
