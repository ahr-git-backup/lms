import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { useReminderPreferences } from "@/hooks/useReminderPreferences";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUBJECTS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";

const LiveExam = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const { data: enrollments } = useEnrollments();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Live Exam – Atlas";
  }, []);

  const { data: exams, isLoading } = useQuery({
    queryKey: ["live-exams", selectedCourse, selectedSubject],
    queryFn: async () => {
      const now = new Date().toISOString();
      // Fetch only live exams, we will filter for expired ones on the client or refine query
      let query = supabase
        .from("exams")
        .select("*, course:courses(*)")
        .eq("is_published", true)
        .eq("exam_type", "live") // Ensure only Live exams
        .gt("time_window_end", now) // Only show exams that haven't ended
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: false });

      if (selectedCourse !== "all") {
        query = query.or(`course_id.eq.${selectedCourse},shared_course_ids.cs.{${selectedCourse}}`);
      }

      if (selectedSubject !== "all") {
        query = query.contains("subject", [selectedSubject]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: attempts } = useQuery({
    queryKey: ["exam-attempts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*")
        .eq("profile_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { preferences } = useReminderPreferences();

  const enrolledCourseIds = enrollments?.map((e) => e.course_id) || [];
  const filteredExams = exams?.filter((e) => enrolledCourseIds.includes(e.course_id)) || [];

  const [selectedExamForPopup, setSelectedExamForPopup] = useState<any>(null);

  const hasAttempted = (examId: string) => {
    return attempts?.some(a => a.exam_id === examId);
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!selectedExamForPopup} onOpenChange={(open) => !open && setSelectedExamForPopup(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{selectedExamForPopup?.title}</DialogTitle>
                <DialogDescription>
                    Review the details below before starting.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-muted p-3 rounded-md">
                        <span className="font-semibold block">Duration</span>
                        {selectedExamForPopup?.duration_minutes} minutes
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                        <span className="font-semibold block">Total Marks</span>
                        {selectedExamForPopup?.total_marks || "N/A"}
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                        <span className="font-semibold block">Negative Marking</span>
                        {selectedExamForPopup?.negative_mark_per_question || 0} per wrong answer
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                        <span className="font-semibold block">Type</span>
                        {selectedExamForPopup?.exam_type === 'live' ? 'Live Exam' : 'Practice Exam'}
                    </div>
                </div>

                {selectedExamForPopup?.instructions && (
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm">Instructions</h3>
                        <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 p-4 rounded-md text-sm">
                            <ReactMarkdown>{selectedExamForPopup.instructions}</ReactMarkdown>
                        </div>
                    </div>
                )}

                <div className="text-xs text-muted-foreground p-2 border border-yellow-500/20 bg-yellow-500/10 rounded-md">
                     ⚠️ <strong>Warning:</strong> Ensure you have a stable internet connection.
                     {selectedExamForPopup?.exam_type === 'live' && " This is a one-time attempt live exam."}
                </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedExamForPopup(null)}>
                    Cancel
                </Button>
                <Button onClick={() => navigate(`/dashboard/take-exam/${selectedExamForPopup?.id}`)}>
                    Start Exam
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Live exams</h1>
        <p className="text-sm text-muted-foreground">Take published exams within the time window.</p>
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
      ) : filteredExams.length === 0 ? (
        <Card className="border border-foreground/50">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No exams available for this course yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredExams.map((exam) => {
            const attempted = hasAttempted(exam.id);
            const isLive = exam.exam_type === "live";
            const now = new Date();
            const start = exam.time_window_start ? new Date(exam.time_window_start) : null;
            const end = exam.time_window_end ? new Date(exam.time_window_end) : null;
            const isActive = isLive && start && end && now >= start && now <= end;

            return (
              <Card key={exam.id} className={`transition-all rounded-2xl shadow-md hover:shadow-lg flex flex-col h-full ${isActive ? 'border border-emerald-600 shadow-[0_0_15px_rgba(5,150,105,0.5)] bg-emerald-50 dark:bg-emerald-900/40' : 'border border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900'}`}>
                <CardHeader className="space-y-1">
                  <div className="flex justify-between items-start gap-2">
                      <p className="text-xs font-mono uppercase text-muted-foreground">
                          {exam.course?.name || "Public Exam"}
                      </p>
                      {isActive && (
                        <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                            LIVE NOW
                        </span>
                      )}
                      {Array.isArray(exam.subject) && (
                        <div className="flex flex-wrap gap-1 justify-end">
                            {exam.subject.map((s: string) => (
                                <span key={s} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors border-emerald-200 bg-emerald-100/50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800">
                                    {s}
                                </span>
                            ))}
                        </div>
                      )}
                  </div>
                  <CardTitle className="text-base">{exam.title}</CardTitle>
                  <CardDescription className="text-xs">
                    Duration: {exam.duration_minutes} min • {exam.exam_type === "live" ? "Live Exam" : "Practice Exam"}
                    {preferences && ((exam.exam_type === "live" && preferences.remind_for_live_exams) ||
                      (exam.exam_type === "practice" && preferences.remind_for_practice_exams)) &&
                      exam.time_window_start && (() => {
                        const now = new Date();
                        const start = new Date(exam.time_window_start);
                        const diffMinutes = Math.round((start.getTime() - now.getTime()) / 60000);
                        if (diffMinutes > 0 && preferences.remind_before_minutes && diffMinutes <= preferences.remind_before_minutes) {
                          return (
                            <span className="block text-[10px] text-muted-foreground mt-1">
                              Starts in {diffMinutes} minute{diffMinutes === 1 ? "" : "s"}
                            </span>
                          );
                        }
                        return null;
                      })()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLive && attempted ? (
                    <div className="text-xs text-muted-foreground">Attempt Completed</div>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={() => setSelectedExamForPopup(exam)}
                      disabled={isLive && attempted}
                      className={isActive ? "w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white border-none" : "w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white border-none"}
                    >
                      {isActive ? "Start Live Exam" : "Start Exam"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiveExam;
