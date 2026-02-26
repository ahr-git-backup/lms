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
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const PAGE_SIZE = 10;

type AnalyticsExam = {
  id: string;
  title: string;
  total_marks: number | null;
  time_window_start: string | null;
  time_window_end: string | null;
  created_at: string;
  is_archive?: boolean;
  course_name: string;
  live_attempt: {
    score: number;
    rank: number;
    highest_score: number | null;
  } | null;
  practice_attempt: {
    score: number;
    rank: number;
    highest_score: number | null;
  } | null;
  highest_live_score: number | null;
  highest_practice_score: number | null;
};

// Helper to determine status
const getLiveStatus = (exam: AnalyticsExam) => {
    if (exam.live_attempt) return exam.live_attempt.score;
    const now = new Date();
    if (exam.time_window_end) {
        const endTime = new Date(exam.time_window_end);
        if (now > endTime) return "Absent";
    }
    return "-";
};

const getPracticeStatus = (exam: AnalyticsExam) => {
    if (exam.practice_attempt) return exam.practice_attempt.score;
    return "Absent"; // Per user request
};

const CourseTable = ({ courseName, exams }: { courseName: string, exams: AnalyticsExam[] }) => {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(exams.length / PAGE_SIZE);
  const startIndex = (page - 1) * PAGE_SIZE;
  const currentExams = exams.slice(startIndex, startIndex + PAGE_SIZE);

  // Summary Calculations
  const liveStats = exams.reduce((acc, exam) => {
      const status = getLiveStatus(exam);
      if (typeof status === 'number') {
          acc.obtained += status;
          acc.total += exam.total_marks || 0;
      } else if (status === "Absent") {
           acc.total += exam.total_marks || 0;
      }
      return acc;
  }, { obtained: 0, total: 0 });

  const practiceStats = exams.reduce((acc, exam) => {
       acc.total += exam.total_marks || 0;
       if (exam.practice_attempt) {
           acc.obtained += Number(exam.practice_attempt.score) || 0;
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

      {/* Desktop View */}
      <div className="hidden md:block rounded-md border bg-card overflow-hidden shadow-sm">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[30%] py-2 text-xs font-semibold">Exam Name</TableHead>
              <TableHead className="py-2 text-xs font-semibold whitespace-nowrap">Date</TableHead>

              <TableHead className="py-2 text-xs font-semibold text-right whitespace-nowrap">Live Mark</TableHead>
              <TableHead className="py-2 text-xs font-semibold text-right whitespace-nowrap">Rank</TableHead>

              <TableHead className="py-2 text-xs font-semibold text-right whitespace-nowrap">Prac Mark</TableHead>
              <TableHead className="py-2 text-xs font-semibold text-right whitespace-nowrap">Rank</TableHead>

              <TableHead className="py-2 text-xs font-semibold text-right whitespace-nowrap">Top (Live)</TableHead>
              <TableHead className="py-2 text-xs font-semibold text-right whitespace-nowrap">Top (Prac)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentExams.map((item) => {
              const liveStatus = getLiveStatus(item);
              const practiceStatus = getPracticeStatus(item);

              return (
              <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="py-2 font-medium">
                  <div className="line-clamp-2 leading-tight" title={item.title}>
                    {item.title}
                  </div>
                </TableCell>
                <TableCell className="py-2 whitespace-nowrap">
                  {new Date(item.time_window_start || item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  <span className="text-[10px] text-muted-foreground block">
                     {new Date(item.time_window_start || item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </TableCell>

                {/* Live Mark Column */}
                <TableCell className="py-2 text-right font-bold whitespace-nowrap">
                  {liveStatus === "Absent" ? (
                      <span className="text-red-500 font-medium text-xs">Absent</span>
                  ) : liveStatus === "-" ? (
                      <span className="text-muted-foreground">-</span>
                  ) : (
                      <span>{liveStatus} <span className="text-muted-foreground text-[10px] font-normal">/ {item.total_marks}</span></span>
                  )}
                </TableCell>

                {/* Live Rank */}
                <TableCell className="py-2 text-right font-mono whitespace-nowrap">
                    {item.live_attempt?.rank ? (
                        <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                            #{item.live_attempt.rank}
                        </span>
                    ) : (
                        <span className="text-muted-foreground/30">-</span>
                    )}
                </TableCell>

                 {/* Practice Mark Column */}
                 <TableCell className="py-2 text-right font-bold whitespace-nowrap">
                  {practiceStatus === "Absent" ? (
                      <span className="text-muted-foreground/50 font-normal text-xs">Absent</span>
                  ) : (
                      <span>{practiceStatus} <span className="text-muted-foreground text-[10px] font-normal">/ {item.total_marks}</span></span>
                  )}
                </TableCell>

                {/* Practice Rank */}
                <TableCell className="py-2 text-right font-mono whitespace-nowrap">
                    {item.practice_attempt?.rank ? (
                        <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold">
                            #{item.practice_attempt.rank}
                        </span>
                    ) : (
                        <span className="text-muted-foreground/30">-</span>
                    )}
                </TableCell>

                <TableCell className="py-2 text-right text-muted-foreground whitespace-nowrap font-mono text-xs">
                  {item.highest_live_score !== null ? item.highest_live_score : "-"}
                </TableCell>
                <TableCell className="py-2 text-right text-muted-foreground whitespace-nowrap font-mono text-xs">
                  {item.highest_practice_score !== null ? item.highest_practice_score : "-"}
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-primary/5 hover:bg-primary/10">
                <TableCell colSpan={2} className="py-2 font-bold text-primary text-xs">Summary</TableCell>
                <TableCell className="py-2 text-right font-bold text-primary whitespace-nowrap text-xs">
                    {liveStats.obtained} / {liveStats.total}
                </TableCell>
                <TableCell className="py-2 text-right font-bold text-primary whitespace-nowrap text-xs">
                    -
                </TableCell>
                <TableCell className="py-2 text-right font-bold text-primary whitespace-nowrap text-xs">
                    {practiceStats.obtained} / {practiceStats.total}
                </TableCell>
                <TableCell colSpan={3} />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {currentExams.map((item) => {
             const liveStatus = getLiveStatus(item);
             const practiceStatus = getPracticeStatus(item);
             return (
                 <Card key={item.id} className="text-sm shadow-sm border-2 border-green-500/20">
                     <CardContent className="p-3 space-y-3">
                         <div className="flex justify-between items-start gap-2">
                             <div className="font-semibold leading-tight">{item.title}</div>
                             <div className="text-[10px] text-muted-foreground whitespace-nowrap text-right">
                                 <div>{new Date(item.time_window_start || item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                                 <div>{new Date(item.time_window_start || item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                             </div>
                         </div>

                         <div className="grid grid-cols-2 gap-2 text-xs">
                             <div className="space-y-1 bg-muted/30 p-2 rounded">
                                 <div className="font-semibold text-muted-foreground flex items-center gap-1">Live <span className="ml-auto text-[10px] font-normal opacity-70">Top: {item.highest_live_score ?? '-'}</span></div>
                                 <div className="flex justify-between items-center">
                                     <span className={liveStatus === "Absent" ? "text-red-500 font-medium" : "font-bold"}>
                                         {liveStatus === "Absent" ? "Absent" : liveStatus === "-" ? "-" : `${liveStatus}/${item.total_marks}`}
                                     </span>
                                     {item.live_attempt?.rank && (
                                         <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-bold">#{item.live_attempt.rank}</span>
                                     )}
                                 </div>
                             </div>

                             <div className="space-y-1 bg-muted/30 p-2 rounded">
                                 <div className="font-semibold text-muted-foreground flex items-center gap-1">Practice <span className="ml-auto text-[10px] font-normal opacity-70">Top: {item.highest_practice_score ?? '-'}</span></div>
                                 <div className="flex justify-between items-center">
                                      <span className={practiceStatus === "Absent" ? "text-muted-foreground/50" : "font-bold"}>
                                         {practiceStatus === "Absent" ? "Absent" : `${practiceStatus}/${item.total_marks}`}
                                     </span>
                                     {item.practice_attempt?.rank && (
                                         <span className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full text-[10px] font-bold">#{item.practice_attempt.rank}</span>
                                     )}
                                 </div>
                             </div>
                         </div>
                     </CardContent>
                 </Card>
             );
        })}
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
    queryKey: ["exam-analytics-rpc-v1", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.rpc('get_student_exam_analytics');
      if (error) {
        console.error("Error fetching analytics:", error);
        throw error;
      }

      // Cast the result to our type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as any) as AnalyticsExam[];
    },
    enabled: !!user,
  });

  // Calculate Graph Data (Last 30 Days)
  const graphData = useMemo(() => {
      if (!analyticsData) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Filter exams taken/ended in last 30 days
      const recentExams = analyticsData.filter(exam => {
          const date = new Date(exam.time_window_start || exam.created_at);
          return date >= thirtyDaysAgo;
      });

      // Sort by date ascending
      recentExams.sort((a, b) => new Date(a.time_window_start || a.created_at).getTime() - new Date(b.time_window_start || b.created_at).getTime());

      // Map to graph format
      return recentExams.map(exam => {
          // Prefer live score if exists, else practice, else 0 (if attended)
          // Actually, if neither attempt exists, user was Absent, so maybe exclude?
          // But user wants "1 month marks... improvement or not". Showing 0 for absent might be misleading or motivating.
          // Let's show score only if attempt exists.

          let score = null;
          if (exam.live_attempt) score = Number(exam.live_attempt.score);
          else if (exam.practice_attempt) score = Number(exam.practice_attempt.score);

          if (score === null) return null; // Skip absent exams from graph to avoid cluttering with 0s

          return {
              name: exam.title.length > 15 ? exam.title.slice(0, 15) + "..." : exam.title,
              fullTitle: exam.title,
              date: new Date(exam.time_window_start || exam.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
              score: score,
              total: exam.total_marks
          };
      }).filter(item => item !== null);

  }, [analyticsData]);

  const groupedExams = useMemo(() => {
    if (!analyticsData) return {};

    const groups: Record<string, AnalyticsExam[]> = {};

    analyticsData.forEach((exam) => {
      // Determine group name
      let groupName = exam.course_name || "Public Exams";

      if (exam.is_archive) {
          groupName = `Archive - ${exam.course_name || "Public"}`;
      }

      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(exam);
    });

    // Sort chronologically (Oldest first)
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) =>
        new Date(a.time_window_start || a.created_at).getTime() - new Date(b.time_window_start || b.created_at).getTime()
      );
    });

    // Ordering: Enrolled -> Archive -> Public
    const sortedGroups: Record<string, AnalyticsExam[]> = {};

    const enrolledKeys = Object.keys(groups).filter(k => !k.startsWith("Archive") && k !== "Public Exams").sort();
    const archiveKeys = Object.keys(groups).filter(k => k.startsWith("Archive")).sort();

    enrolledKeys.forEach(k => sortedGroups[k] = groups[k]);
    archiveKeys.forEach(k => sortedGroups[k] = groups[k]);

    if (groups["Public Exams"]) {
        sortedGroups["Public Exams"] = groups["Public Exams"];
    }

    return sortedGroups;
  }, [analyticsData]);

  const totalExams = analyticsData?.length ?? 0;

  // Calculate Global Stats
  // Live: Obtained / Total (where exam ended)
  const globalLiveObtained = analyticsData?.reduce((sum, e) => sum + (Number(e.live_attempt?.score) || 0), 0) || 0;
  const globalLiveTotal = analyticsData?.reduce((sum, e) => sum + (e.total_marks || 0), 0) || 0;

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

           {/* Performance Graph */}
           {graphData.length > 0 && (
               <Card className="shadow-sm border">
                   <CardHeader>
                       <CardTitle>Performance Trend (Last 30 Days)</CardTitle>
                   </CardHeader>
                   <CardContent className="h-[300px]">
                       <ResponsiveContainer width="100%" height="100%">
                           <LineChart data={graphData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                               <XAxis
                                   dataKey="date"
                                   tick={{ fontSize: 12 }}
                                   tickMargin={10}
                                   axisLine={false}
                                   tickLine={false}
                               />
                               <YAxis
                                   tick={{ fontSize: 12 }}
                                   axisLine={false}
                                   tickLine={false}
                               />
                               <Tooltip
                                   content={({ active, payload, label }) => {
                                       if (active && payload && payload.length) {
                                           const data = payload[0].payload;
                                           return (
                                               <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                                                   <p className="font-bold mb-1">{data.fullTitle}</p>
                                                   <p className="text-muted-foreground mb-2">{label}</p>
                                                   <p className="font-semibold text-primary">
                                                       Score: {data.score} / {data.total}
                                                   </p>
                                               </div>
                                           );
                                       }
                                       return null;
                                   }}
                               />
                               <Line
                                   type="monotone"
                                   dataKey="score"
                                   stroke="#2563eb"
                                   strokeWidth={3}
                                   dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                                   activeDot={{ r: 6 }}
                               />
                           </LineChart>
                       </ResponsiveContainer>
                   </CardContent>
               </Card>
           )}

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
