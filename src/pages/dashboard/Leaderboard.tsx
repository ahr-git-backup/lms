import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Trophy, ChevronLeft, ChevronRight, BadgeAlert, Download, FileText, Star } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PAGE_SIZE = 50;

const Podium = ({ topThree, isStaff }: { topThree: any[], isStaff: boolean }) => {
    if (!topThree || topThree.length === 0) return null;

    const first = topThree[0];
    const second = topThree[1];
    const third = topThree[2];

    const PodiumItem = ({ student, rank, color, height, glowColor, zIndex, CrownIcon }: { student: any, rank: number, color: string, height: string, glowColor: string, zIndex: number, CrownIcon?: boolean }) => {
        if (!student) return <div className="w-24 sm:w-32 hidden md:block"></div>;

        return (
            <div className={`flex flex-col items-center justify-end mx-1 sm:mx-2 md:mx-4`} style={{ zIndex }}>
                <div className="relative mb-3 flex flex-col items-center group">
                    {/* Crown for 1st place */}
                    {CrownIcon && (
                         <div className="absolute -top-7 text-yellow-400 drop-shadow-md z-20 animate-bounce">
                             <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-crown"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.956-.734L2.02 6.02a.5.5 0 0 1 .798-.518l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>
                         </div>
                    )}
                    
                    {/* Avatar with glowing ring */}
                    <div className={`relative p-1 rounded-full bg-gradient-to-br ${color} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                        <Avatar className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 border-4 border-background bg-background shadow-inner">
                            <AvatarImage src={student.profile?.avatar_url} />
                            <AvatarFallback className="text-xl font-bold bg-muted text-foreground">
                                {student.profile?.full_name?.slice(0, 2)?.toUpperCase() || "??"}
                            </AvatarFallback>
                        </Avatar>
                        
                        {/* Score badge overlapping the avatar */}
                        <div className={`absolute -bottom-3 left-1/2 transform -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white shadow-md whitespace-nowrap bg-gradient-to-r ${color}`}>
                            {student.score} marks
                        </div>
                    </div>
                </div>

                <div className="text-center mb-3 max-w-[100px] sm:max-w-[120px]">
                    <div className="font-bold text-sm sm:text-base text-foreground truncate drop-shadow-sm" title={student.profile?.full_name}>
                        {student.profile?.full_name?.split(" ")[0]}
                    </div>
                    {isStaff && student.time_taken_seconds && (
                         <div className="text-[10px] text-muted-foreground font-mono">
                             {Math.floor(student.time_taken_seconds / 60)}m {student.time_taken_seconds % 60}s
                         </div>
                    )}
                </div>

                {/* The 3D Podium Block */}
                <div 
                    className={`w-24 sm:w-32 lg:w-40 rounded-t-lg relative flex items-start justify-center pt-4 sm:pt-6 transition-all duration-500 hover:brightness-110 overflow-hidden text-white shadow-[0_-5px_25px_-5px_rgba(0,0,0,0.1)] bg-gradient-to-b ${color}`} 
                    style={{ height, boxShadow: `0 -5px 25px -5px ${glowColor}` }}
                >
                    {/* Glossy overlay effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>
                    <span className="font-black text-4xl sm:text-5xl lg:text-7xl drop-shadow-md z-10 opacity-90">{rank}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="relative flex justify-center items-end pt-12 pb-6 px-4 mb-4 bg-gradient-to-t from-slate-100/50 to-transparent dark:from-slate-900/50 rounded-2xl mx-auto overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-10 left-10 text-yellow-300 opacity-50"><Star size={24} fill="currentColor" /></div>
            <div className="absolute top-20 right-12 text-blue-300 opacity-40"><Star size={16} fill="currentColor" /></div>
            <div className="absolute top-5 right-1/4 text-pink-300 opacity-60"><Star size={20} fill="currentColor" /></div>
            
            <PodiumItem student={second} rank={2} color="from-slate-400 to-slate-500" glowColor="rgba(148, 163, 184, 0.5)" height="120px" zIndex={20} />
            <PodiumItem student={first} rank={1} color="from-yellow-400 to-amber-500" glowColor="rgba(250, 204, 21, 0.6)" height="160px" zIndex={30} CrownIcon={true} />
            <PodiumItem student={third} rank={3} color="from-orange-400 to-orange-600" glowColor="rgba(249, 115, 22, 0.5)" height="90px" zIndex={10} />
        </div>
    );
};

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
        .order('time_taken_seconds', { ascending: true, nullsFirst: false })
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

  // Top 3 for Podium (Only on page 0)
  const topThree = page === 0 ? leaderboard.slice(0, 3) : [];

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
            .order('time_taken_seconds', { ascending: true, nullsFirst: false })
            .order('submitted_at', { ascending: true });

          if (error) throw error;
          if (!data || data.length === 0) {
              alert("No data to export");
              return;
          }

          // Generate CSV
          const headers = ["Rank", "Name", "Registration ID", "Score", "Time Taken (sec)", "Submitted At", "Attempt No", "Warnings"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows = data.map((item: any, idx: number) => {
              const regId = item.profile?.registration_id || "";
              const maskedRegId = isStaff ? regId : (regId.length >= 4 ? "**" + regId.slice(-4) : regId);

              return [
                idx + 1,
                item.profile?.full_name || "Unknown",
                maskedRegId,
                item.score,
                item.time_taken_seconds || "-",
                new Date(item.submitted_at).toLocaleString(),
                item.attempt_number || 1,
                item.violation_count || 0
              ];
          });

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

  const handlePrintPDF = async (isFullAdminReport = false) => {
      try {
          // 1. Fetch Exam Questions (to grade)
          const { data: questions, error: qError } = await supabase
              .from('exam_questions')
              .select('id, correct_option')
              .eq('exam_id', examId);

          if (qError) throw qError;
          const questionsMap = new Map(questions.map(q => [q.id, q.correct_option]));

          // 2. Fetch Attempts with Answers & Profile details
          // We fetch from leaderboard_exam_attempts to ensure we get the correct profile data structure
          // BUT we also need 'answers' which is only in exam_attempts.
          // Solution: Fetch from exam_attempts but join profile correctly or check why profile might be null.
          // The issue "name and hsc batch not coming" means attempt.profile is likely null.
          // This happens if the user enrolled but doesn't have a full profile or RLS blocks it.
          // However, the main leaderboard UI works (fetching from leaderboard_exam_attempts view).
          // Let's use the view for profile data and join attempts for answers if needed, OR just trust the view has everything except answers.
          // Actually, the view `leaderboard_exam_attempts` usually aggregates data.
          // Let's try fetching from the VIEW first to see if that fixes the data visibility.

          let query = (supabase as any)
            .from('leaderboard_exam_attempts')
            .select('*')
            .eq('exam_id', examId);

           if (filterType === 'live') {
                query = query.eq('attempt_type', 'live');
           } else {
                query = query.or('attempt_type.eq.practice,attempt_type.is.null');
           }

           const { data: attempts, error: aError } = await query
                .order('score', { ascending: false })
                .order('time_taken_seconds', { ascending: true, nullsFirst: false })
                .order('submitted_at', { ascending: true });

           if (aError) throw aError;
           if (!attempts || attempts.length === 0) {
               alert("No data to export");
               return;
           }

           const escapeHtml = (unsafe: string) => {
               return unsafe
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
           };

           const title = escapeHtml(`${exam?.title} (${filterType === 'live' ? 'Live Exam' : 'Practice Exam'})${isFullAdminReport ? ' - Full Admin Report' : ''}`);

           // 3. Construct HTML
           let rowsHtml = '';
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           attempts.forEach((attempt: any, index: number) => {
               const name = escapeHtml(attempt.profile?.full_name || "Unknown");
               const regIdRaw = attempt.profile?.registration_id || ""
               const regIdMasked = isFullAdminReport ? regIdRaw : (regIdRaw.length >= 4 ? "**" + regIdRaw.slice(-4) : (regIdRaw || "-"));
               const hsc = escapeHtml(attempt.profile?.hsc_batch || "-");
               const college = escapeHtml(attempt.profile?.college_name || attempt.profile?.school || "-");
               const warnings = attempt.violation_count || 0;

               const formatDurationPrint = (seconds: number) => {
                   if (!seconds) return "-";
                   const m = Math.floor(seconds / 60);
                   const s = seconds % 60;
                   return `${m}m ${s}s`;
               };

               rowsHtml += `
               <tr>
                   <td class="text-center"><span class="rank-badge">${index + 1}</span></td>
                   <td style="font-weight: 600;">${name}</td>
                   <td class="text-center font-mono text-xs" style="color: #6b7280;">${regIdMasked}</td>
                   <td class="text-center font-bold" style="color: #10b981;">${attempt.score}</td>
                   ${isFullAdminReport ? `<td class="text-center font-mono text-xs" style="color: #6b7280;">${formatDurationPrint(attempt.time_taken_seconds)}</td>` : ''}
                   <td class="text-center" style="color: #6b7280;">${hsc}</td>
                   <td class="text-center" style="color: #4b5563;">${college}</td>
                   ${isFullAdminReport ? `<td class="text-center" style="color: ${warnings > 0 ? '#ef4444' : '#9ca3af'}; font-weight: ${warnings > 0 ? 'bold' : 'normal'};">${warnings > 0 ? warnings : '-'}</td>` : ''}
               </tr>`;
           });

           const htmlContent = `
            <!DOCTYPE html>
            <html lang="bn">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    @font-face {
                        font-family: 'SolaimanLipi';
                        src: url('${window.location.origin}/SolaimanLipi.ttf') format('truetype');
                    }
                    @page {
                        size: A4;
                        margin: 15mm;
                        @bottom-right {
                            content: "Page " counter(page) " of " counter(pages);
                            font-family: sans-serif;
                            font-size: 10px;
                            color: #9ca3af;
                        }
                    }
                    body {
                        font-family: 'SolaimanLipi', sans-serif;
                        margin: 0;
                        padding: 0;
                        color: #1f2937;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        position: relative;
                    }
                    
                    /* The Watermark */
                    .watermark {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 70%;
                        height: 70%;
                        background-image: url('${window.location.origin}/logo.png');
                        background-repeat: no-repeat;
                        background-position: center;
                        background-size: contain;
                        opacity: 0.10; /* Making it more visible */
                        z-index: -1;
                        pointer-events: none;
                    }

                    .header-container {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-bottom: 2px solid #e5e7eb;
                        padding-bottom: 16px;
                        margin-bottom: 24px;
                    }
                    .header-left h1 {
                        color: #10b981;
                        font-size: 26px;
                        margin: 0 0 4px 0;
                        font-weight: 800;
                    }
                    .header-left p {
                        margin: 0;
                        color: #6b7280;
                        font-size: 13px;
                    }
                    .header-right {
                        text-align: right;
                    }
                    .header-right img {
                        height: 48px;
                        object-fit: contain;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 13px;
                    }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    tr {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    
                    /* Modern Table Styling */
                    th {
                        background-color: #f3f4f6 !important;
                        color: #374151 !important;
                        padding: 8px 6px; /* Reduced gap */
                        font-weight: 700;
                        text-align: center;
                        border-bottom: 2px solid #d1d5db !important;
                        text-transform: uppercase;
                        font-size: 11px;
                        letter-spacing: 0.05em;
                    }
                    th:first-child { border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
                    th:last-child { border-top-right-radius: 6px; border-bottom-right-radius: 6px; }
                    th:nth-child(2) { text-align: left; }
                    
                    td {
                        padding: 8px 6px; /* Reduced gap */
                        border-bottom: 1px solid #d1d5db !important; /* Made divider darker and forced */
                        color: #111827;
                    }
                    td:nth-child(2) { text-align: left; font-weight: 500; }
                    
                    body table tbody tr {
                        background-color: transparent !important;
                    }

                    /* Top 3 Highlighting */
                    tbody tr:nth-child(1) td { background-color: rgba(16, 185, 129, 0.12) !important; border-bottom: 1px solid #d1d5db !important; }
                    tbody tr:nth-child(2) td { background-color: rgba(16, 185, 129, 0.06) !important; border-bottom: 1px solid #d1d5db !important; }
                    tbody tr:nth-child(3) td { background-color: rgba(16, 185, 129, 0.03) !important; border-bottom: 1px solid #d1d5db !important; }

                    .text-center { text-align: center; }
                    
                    /* Rank badges */
                    .rank-badge {
                        display: inline-block;
                        width: 20px;
                        height: 20px;
                        line-height: 20px;
                        text-align: center;
                        border-radius: 50%;
                        background-color: #f3f4f6;
                        color: #374151;
                        font-weight: bold;
                        font-size: 10px;
                    }
                    tbody tr:nth-child(1) .rank-badge { background-color: #fbbf24 !important; color: white !important; }
                    tbody tr:nth-child(2) .rank-badge { background-color: #9ca3af !important; color: white !important; }
                    tbody tr:nth-child(3) .rank-badge { background-color: #f97316 !important; color: white !important; }

                    .footer {
                        margin-top: 30px;
                        text-align: center;
                        font-size: 11px;
                        color: #6b7280;
                        border-top: 1px solid #d1d5db;
                        padding-top: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="watermark"></div>
                <div class="header-container">
                    <div class="header-left">
                        <h1>${title}</h1>
                        <p>Generated on ${new Date().toLocaleString()}</p>
                    </div>
                    <div class="header-right">
                        <img src="${window.location.origin}/logo.png" alt="Logo" />
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 8%;">Rank</th>
                            <th style="width: 25%;">Student Name</th>
                            <th style="width: 12%;">Reg ID</th>
                            <th style="width: 9%;">Score</th>
                            ${isFullAdminReport ? `<th style="width: 9%;">Time</th>` : ''}
                            <th style="width: 12%;">HSC Batch</th>
                            <th style="width: 17%;">College</th>
                            ${isFullAdminReport ? `<th style="width: 8%;">Warnings</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <div class="footer">
                    Powered by ATLAS LMS • Official Exam Result Sheet
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                        }, 500);
                    }
                </script>
            </body>
            </html>
           `;

           const printWindow = window.open('', '_blank');
           if (printWindow) {
               printWindow.document.write(htmlContent);
               printWindow.document.close();
           } else {
               alert("Popup blocked! Please allow popups for this site.");
           }

      } catch (err) {
          console.error(err);
          alert("Failed to generate PDF");
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
          <div className="flex gap-2 self-end sm:self-auto flex-wrap justify-end">
            {isStaff && (
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">CSV</span>
                </Button>
            )}
            {isStaff && (
                <Button variant="outline" size="sm" onClick={() => handlePrintPDF(false)}>
                    <FileText className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">PDF/Print</span>
                </Button>
            )}
            {isStaff && (
                <Button variant="default" size="sm" onClick={() => handlePrintPDF(true)}>
                    <FileText className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Admin PDF</span>
                </Button>
            )}
          </div>
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
            {/* Podium Component */}
            {topThree.length > 0 && <Podium topThree={topThree} isStaff={isStaff} />}

            <div className="rounded-md border bg-card overflow-x-auto no-scrollbar scroll-smooth">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] md:w-[80px] whitespace-nowrap">Rank</TableHead>
                    <TableHead className="whitespace-nowrap">Student</TableHead>
                    <TableHead className="whitespace-nowrap hidden md:table-cell">Reg ID</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Score</TableHead>
                    {isStaff && <TableHead className="text-right whitespace-nowrap hidden md:table-cell">Time</TableHead>}
                    {isStaff && <TableHead className="text-right whitespace-nowrap hidden md:table-cell">Warnings</TableHead>}
                    <TableHead className="text-right whitespace-nowrap hidden md:table-cell">Submitted</TableHead>
                    {isStaff && <TableHead className="text-right whitespace-nowrap hidden md:table-cell">Action</TableHead>}
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
                                        {isStaff && (
                                            <>
                                                <span>•</span>
                                                <span>{formatDuration(attempt.time_taken_seconds)}</span>
                                            </>
                                        )}
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
                            {isStaff && (
                                <TableCell className="text-right font-mono text-xs whitespace-nowrap hidden md:table-cell">
                                    {formatDuration(attempt.time_taken_seconds)}
                                </TableCell>
                            )}
                            {isStaff && (
                                <TableCell className="text-right text-xs whitespace-nowrap hidden md:table-cell">
                                    {attempt.violation_count > 0 ? (
                                        <span className="text-red-600 font-bold flex items-center justify-end gap-1"><BadgeAlert className="h-3 w-3"/> {attempt.violation_count}</span>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                            )}
                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                                {new Date(attempt.submitted_at).toLocaleString()}
                            </TableCell>
                            {isStaff && (
                                <TableCell className="text-right whitespace-nowrap hidden md:table-cell">
                                    <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/exam-review/${attempt.id}`)}>
                                        Review
                                    </Button>
                                </TableCell>
                            )}
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
