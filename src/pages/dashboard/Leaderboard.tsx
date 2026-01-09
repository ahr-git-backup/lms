import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Trophy, ChevronLeft, ChevronRight, BadgeAlert, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAGE_SIZE = 50;

const Leaderboard = () => {
  const { user, isAdmin, isTeacher } = useAuth();
  const { examId } = useParams();
  const isStaff = isAdmin || isTeacher;
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState<'live' | 'practice'>('live');

  useEffect(() => {
    document.title = "Leaderboard – Atlas";
  }, []);

  const { data: exam } = useQuery({
    queryKey: ["exam-details", examId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: hasAccess } = useQuery({
    queryKey: ["check-leaderboard-access", exam?.course_id, user?.id],
    queryFn: async () => {
       // If public exam (no course_id), allow access
       if (!exam?.course_id) return true;
       if (!user?.id) return false;

       const { data } = await supabase
          .from("enrollments")
          .select("id")
          .eq("course_id", exam.course_id)
          .eq("profile_id", user.id)
          .maybeSingle();
       return !!data;
    },
    enabled: !!exam && !!user?.id
  });

  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ["leaderboard", examId, page, filterType],
    queryFn: async () => {
      let query = (supabase as any)
        .from('leaderboard_exam_attempts')
        .select('*', { count: 'exact' })
        .eq('exam_id', examId);

      if (filterType === 'live') {
        query = query.eq('attempt_type', 'live');
      } else {
        query = query.or('attempt_type.eq.practice,attempt_type.is.null');
      }

      const { data, error, count } = await query
        .order('score', { ascending: false })
        .order('submitted_at', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      return { data: data || [], count: count || 0 };
    },
    enabled: !!exam,
  });

  // Automatically switch to practice view if exam is practice type
  useEffect(() => {
    if (exam?.exam_type === 'practice') {
      setFilterType('practice');
    }
  }, [exam?.exam_type]);

  const leaderboard = leaderboardData?.data || [];
  const totalCount = leaderboardData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleExport = async () => {
      try {
          // Fetch ALL records for export, not just paginated
          let query = (supabase as any)
            .from('leaderboard_exam_attempts')
            .select('*')
            .eq('exam_id', examId);

          if (filterType === 'live') {
            query = query.eq('attempt_type', 'live');
          } else {
            query = query.or('attempt_type.eq.practice,attempt_type.is.null');
          }

          const { data, error } = await query
            .order('score', { ascending: false })
            .order('submitted_at', { ascending: true });

          if (error) throw error;
          if (!data || data.length === 0) {
              alert("No data to export");
              return;
          }

          // Generate CSV
          const headers = ["Rank", "Name", "Registration ID", "Score", "Time Taken (sec)", "Submitted At", "Attempt No"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows = data.map((item: any, idx: number) => [
              idx + 1,
              item.profile?.full_name || "Unknown",
              item.profile?.registration_id || "",
              item.score,
              item.time_taken_seconds,
              new Date(item.submitted_at).toLocaleString(),
              item.attempt_number || 1
          ]);

          const csvContent = [
              headers.join(","),
              ...rows.map(r => r.map(c => `"${c}"`).join(","))
          ].join("\n");

          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `${exam?.title}_leaderboard_${filterType}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

      } catch (err) {
          console.error(err);
          alert("Failed to export");
      }
  };

  // If exam is not live type, we might not need tabs, but user said "expired live exam will be counted as a practice exam"
  // So even for expired live exams, we should probably show the historical "Live Rank" vs "Practice Rank".
  const showTabs = exam?.exam_type === 'live';

  if (hasAccess === false) {
     return (
        <div className="p-8 text-center text-muted-foreground">
            You are not enrolled in this course or this exam is private.
        </div>
     );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
                <p className="text-sm text-muted-foreground">
                    {exam?.title}
                </p>
            </div>
          </div>
          {isStaff && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
          )}
      </div>

      <Card className="border-0 shadow-none bg-transparent md:border md:border-yellow-500/20 md:bg-yellow-50/10 md:shadow-sm">
        <CardHeader className="px-0 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Top Performers
                </CardTitle>
                <CardDescription>
                    Rankings based on score. Ties are broken by submission time.
                </CardDescription>
              </div>

              {showTabs && (
                  <Tabs value={filterType} onValueChange={(v) => { setFilterType(v as 'live'|'practice'); setPage(0); }}>
                      <TabsList>
                          <TabsTrigger value="live">Live Rank</TabsTrigger>
                          <TabsTrigger value="practice">Practice Rank</TabsTrigger>
                      </TabsList>
                  </Tabs>
              )}
          </div>
        </CardHeader>
        <CardContent className="px-0 md:px-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading ranking...</div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
                No attempts recorded yet for this category.
            </div>
          ) : (
            <>
            <div className="rounded-md border bg-card overflow-x-auto no-scrollbar scroll-smooth">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px] whitespace-nowrap">Rank</TableHead>
                    <TableHead className="whitespace-nowrap">Student</TableHead>
                    <TableHead className="whitespace-nowrap">Reg ID</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Score</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Time Taken</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {leaderboard.map((attempt: any, index: number) => {
                    // Calculate global rank
                    const globalIndex = (page * PAGE_SIZE) + index;
                    let rankIcon = null;
                    if (globalIndex === 0) rankIcon = "🥇";
                    else if (globalIndex === 1) rankIcon = "🥈";
                    else if (globalIndex === 2) rankIcon = "🥉";

                    // Format Time Taken
                    const formatDuration = (seconds: number) => {
                        if (!seconds) return "-";
                        const m = Math.floor(seconds / 60);
                        const s = seconds % 60;
                        return `${m}m ${s}s`;
                    };

                    // Format attempt number
                    const attemptNumber = attempt.attempt_number ? (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground ml-2">
                             {attempt.attempt_number}{[1, 21, 31].includes(attempt.attempt_number) ? 'st' : [2, 22, 32].includes(attempt.attempt_number) ? 'nd' : [3, 23, 33].includes(attempt.attempt_number) ? 'rd' : 'th'} attempt
                        </span>
                    ) : null;

                    const isSecondTimer = attempt.profile?.is_second_timer;

                    return (
                        <TableRow key={attempt.id} className={globalIndex < 3 ? "bg-muted/30" : ""}>
                            <TableCell className="font-bold whitespace-nowrap">
                                {rankIcon ? <span className="text-lg mr-2">{rankIcon}</span> : <span className="text-muted-foreground ml-2">#{globalIndex + 1}</span>}
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    {attempt.profile?.full_name || "Unknown"}
                                    {isSecondTimer && (
                                        <div className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" title="Second Timer">
                                            <BadgeAlert className="h-3 w-3" />
                                            2nd Timer
                                        </div>
                                    )}
                                    {attemptNumber}
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                {attempt.profile?.registration_id
                                    ? `${attempt.profile.registration_id.slice(0, 2)}...${attempt.profile.registration_id.slice(-2)}`
                                    : "Unknown"}
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                                {attempt.score}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                                {formatDuration(attempt.time_taken_seconds)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(attempt.submitted_at).toLocaleString()}
                            </TableCell>
                        </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-4">
                 <div className="text-xs text-muted-foreground">
                     Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                 </div>
                 <div className="flex gap-2">
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                     >
                         <ChevronLeft className="h-4 w-4" />
                         Previous
                     </Button>
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= totalPages - 1}
                     >
                         Next
                         <ChevronRight className="h-4 w-4" />
                     </Button>
                 </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leaderboard;
