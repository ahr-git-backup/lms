import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Trophy, ChevronLeft, ChevronRight, BadgeAlert, Download, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE_SIZE = 50;

const Leaderboard = () => {
  const { user, isAdmin, isTeacher } = useAuth();
  const { data: enrollments } = useEnrollments();
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

  // Calculate Access using useEnrollments (which handles linked courses)
  const hasAccess = (() => {
      if (!exam) return undefined; // Loading state essentially
      if (!exam.course_id) return true; // Public
      if (isStaff) return true;

      const enrolledIds = enrollments?.map(e => e.course_id) || [];
      if (enrolledIds.includes(exam.course_id)) return true;

      // Check shared courses if available in exam object (assuming standard field)
      // @ts-ignore
      if (exam.shared_course_ids && Array.isArray(exam.shared_course_ids)) {
          // @ts-ignore
          if (exam.shared_course_ids.some(id => enrolledIds.includes(id))) return true;
      }

      return false;
  })();

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

  const handleExportCSV = async () => {
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

  const handleExportPDF = async () => {
      try {
          // 1. Fetch Exam Questions (to grade)
          const { data: questions, error: qError } = await supabase
              .from('exam_questions')
              .select('id, correct_option')
              .eq('exam_id', examId);

          if (qError) throw qError;
          const questionsMap = new Map(questions.map(q => [q.id, q.correct_option]));

          // 2. Fetch Attempts with Answers & Profile details
          // We query exam_attempts directly to get 'answers' column
          let query = supabase
              .from('exam_attempts')
              .select(`
                *,
                profile:profiles(full_name, registration_id, college_name)
              `)
              .eq('exam_id', examId);

           if (filterType === 'live') {
                query = query.eq('attempt_type', 'live');
           } else {
                query = query.or('attempt_type.eq.practice,attempt_type.is.null');
           }

           const { data: attempts, error: aError } = await query
                .order('score', { ascending: false })
                .order('submitted_at', { ascending: true });

           if (aError) throw aError;
           if (!attempts || attempts.length === 0) {
               alert("No data to export");
               return;
           }

           // 3. Prepare Data
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           const rows = attempts.map((attempt: any, index: number) => {
               // Calculate Right/Wrong/Blank
               let right = 0;
               let wrong = 0;
               let blank = 0;

               // Answers is JSON array: [{question_id, selected_option}]
               const answersArr = attempt.answers as any[] || [];
               const answersMap = new Map(answersArr.map(a => [a.question_id, a.selected_option]));

               questions.forEach(q => {
                   const selected = answersMap.get(q.id);
                   if (!selected) {
                       blank++;
                   } else if (selected === q.correct_option) {
                       right++;
                   } else {
                       wrong++;
                   }
               });

               // Percentage
               const percent = exam?.total_marks ? ((attempt.score / exam.total_marks) * 100).toFixed(2) : "0.00";

               return [
                   attempt.profile?.full_name || "Unknown",
                   attempt.score,
                   index + 1, // Position
                   percent,
                   right,
                   wrong,
                   blank,
                   attempt.profile?.college_name || "N/A"
               ];
           });

           // 4. Generate PDF
           const doc = new jsPDF();

           // Add Font for Bangla support if needed (Standard fonts don't support Bangla well, but we'll use standard for now or assume English names primarily.
           // If Bangla is strictly required, we'd need to add a font. For this task, we'll try default.)

           // Header
           doc.setFontSize(16);
           doc.text(`${exam?.title} (${filterType === 'live' ? 'Live Exam' : 'Practice Exam'})`, 14, 20);

           // Table
           autoTable(doc, {
               startY: 30,
               head: [['NAME', 'Marks', 'Position', 'Percent', 'Right', 'Wrong', 'Blank', 'College']],
               body: rows,
               theme: 'grid',
               headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }, // Light gray header
               styles: { fontSize: 8, cellPadding: 2 },
               columnStyles: {
                   0: { cellWidth: 40 }, // Name
                   7: { cellWidth: 40 }  // College
               }
           });

           doc.save(`${exam?.title}_result_sheet.pdf`);

      } catch (err) {
          console.error(err);
          alert("Failed to export PDF");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight truncate">Leaderboard</h1>
                <p className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-[400px]">
                    {exam?.title}
                </p>
            </div>
          </div>
          {isStaff && (
              <div className="flex gap-2 self-end sm:self-auto">
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">CSV</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <FileText className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">PDF</span>
                </Button>
              </div>
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
                    <TableHead className="w-[60px] md:w-[80px] whitespace-nowrap">Rank</TableHead>
                    <TableHead className="whitespace-nowrap">Student</TableHead>
                    <TableHead className="whitespace-nowrap hidden md:table-cell">Reg ID</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Score</TableHead>
                    <TableHead className="text-right whitespace-nowrap hidden md:table-cell">Time</TableHead>
                    <TableHead className="text-right whitespace-nowrap hidden md:table-cell">Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {leaderboard.map((attempt: any, index: number) => {
                    // Calculate global rank
                    const globalIndex = (page * PAGE_SIZE) + index;
                    let rankIcon = null;
                    let rowClass = "";

                    if (globalIndex === 0) {
                        rankIcon = "🥇";
                        rowClass = "bg-yellow-100/50 hover:bg-yellow-100/60 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30";
                    } else if (globalIndex === 1) {
                        rankIcon = "🥈";
                        rowClass = "bg-slate-100/50 hover:bg-slate-100/60 dark:bg-slate-800/20 dark:hover:bg-slate-800/30";
                    } else if (globalIndex === 2) {
                        rankIcon = "🥉";
                        rowClass = "bg-orange-100/50 hover:bg-orange-100/60 dark:bg-orange-900/20 dark:hover:bg-orange-900/30";
                    }

                    // Format Time Taken
                    const formatDuration = (seconds: number) => {
                        if (!seconds) return "-";
                        const m = Math.floor(seconds / 60);
                        const s = seconds % 60;
                        return `${m}m ${s}s`;
                    };

                    // Format attempt number
                    const attemptNumber = attempt.attempt_number ? (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground ml-2 hidden sm:inline">
                             {attempt.attempt_number}{[1, 21, 31].includes(attempt.attempt_number) ? 'st' : [2, 22, 32].includes(attempt.attempt_number) ? 'nd' : [3, 23, 33].includes(attempt.attempt_number) ? 'rd' : 'th'} attempt
                        </span>
                    ) : null;

                    const isSecondTimer = attempt.profile?.is_second_timer;

                    return (
                        <TableRow key={attempt.id} className={rowClass}>
                            <TableCell className="font-bold whitespace-nowrap">
                                {rankIcon ? <span className="text-2xl mr-2">{rankIcon}</span> : <span className="text-muted-foreground ml-2">#{globalIndex + 1}</span>}
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        {(attempt.profile?.full_name || "Unknown").length > 15
                                            ? (attempt.profile?.full_name || "Unknown").slice(0, 15) + "..."
                                            : (attempt.profile?.full_name || "Unknown")}
                                        {isSecondTimer && (
                                            <div className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" title="Second Timer">
                                                <BadgeAlert className="h-3 w-3" />
                                                <span className="hidden sm:inline">2nd Timer</span>
                                            </div>
                                        )}
                                        {attemptNumber}
                                    </div>
                                    <div className="md:hidden text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                                        <span>{attempt.profile?.registration_id ? attempt.profile.registration_id.slice(-6) : "..."}</span>
                                        <span>•</span>
                                        <span>{formatDuration(attempt.time_taken_seconds)}</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                                {attempt.profile?.registration_id
                                    ? `${attempt.profile.registration_id.slice(0, 2)}...${attempt.profile.registration_id.slice(-2)}`
                                    : "Unknown"}
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                                {attempt.score}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap hidden md:table-cell">
                                {formatDuration(attempt.time_taken_seconds)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
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
