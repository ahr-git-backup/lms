import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUBJECTS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";

const PastExamCatalog = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("recent");
  const { data: enrollments, isLoading: enrollmentsLoading } = useEnrollments();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Past Exams – Atlas";
  }, []);

  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: ["past-exam-catalog", user?.id, selectedCourse, selectedSubject, sortOrder],
    queryFn: async () => {
        if (!user || !enrollments || enrollments.length === 0) return [];

        const courseIds = enrollments.map(e => e.course_id);
        const now = new Date().toISOString();

        let query = supabase
            .from("exams")
            .select("*, course:courses(*)")
            .or(`course_id.in.(${courseIds.join(',')}),shared_course_ids.ov.{${courseIds.join(',')}}`)
            .eq("is_published", true)
            // Filter: Either practice exam OR (live exam AND window ended)
            .or(`exam_type.eq.practice,and(exam_type.eq.live,time_window_end.lt.${now})`);

        if (sortOrder === "recent") {
            query = query.order("time_window_start", { ascending: false }).order("created_at", { ascending: false });
        } else if (sortOrder === "old") {
            query = query.order("time_window_start", { ascending: true }).order("created_at", { ascending: true });
        } else {
            query = query.order("sort_order", { ascending: false }).order("created_at", { ascending: false });
        }

        const { data, error } = await query;
        if (error) throw error;

        let filteredData = data || [];

        // Client-side filtering
        if (selectedCourse !== "all") {
            filteredData = filteredData.filter(e => {
                if (e.course_id === selectedCourse) return true;
                // @ts-ignore
                if (e.shared_course_ids && Array.isArray(e.shared_course_ids) && e.shared_course_ids.includes(selectedCourse)) return true;
                return false;
            });
        }

        if (selectedSubject !== "all") {
            filteredData = filteredData.filter(e => Array.isArray(e.subject) ? e.subject.includes(selectedSubject) : e.subject === selectedSubject);
        }

        return filteredData;
    },
    enabled: !!user && !!enrollments,
  });

  const isLoading = enrollmentsLoading || examsLoading;
  const [selectedExamForPopup, setSelectedExamForPopup] = useState<any>(null);

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
                        {selectedExamForPopup?.exam_type === 'live' ? 'Expired Live' : 'Practice Exam'}
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
        <h1 className="text-2xl font-semibold tracking-tight">Past Exams</h1>
        <p className="text-sm text-muted-foreground">
            Practice with expired live exams or dedicated practice tests.
        </p>
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
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground hidden sm:block">Sort</div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Order</SelectItem>
              <SelectItem value="recent">Recent to Old</SelectItem>
              <SelectItem value="old">Old to Recent</SelectItem>
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
      ) : !exams || exams.length === 0 ? (
        <Card className="border border-foreground/50">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No practice exams available at the moment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <Card key={exam.id} className="border border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-2xl shadow-md hover:shadow-lg transition-all flex flex-col h-full">
              <CardHeader className="space-y-1">
                <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-mono uppercase text-muted-foreground">
                    {exam.course?.name || "Public Exam"}
                    </p>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${exam.exam_type === 'live' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800' : 'bg-transparent text-emerald-700 border-emerald-200 dark:text-emerald-200 dark:border-emerald-800'}`}>
                          {exam.exam_type === 'live' ? 'Expired Live' : 'Practice'}
                      </span>
                      {Array.isArray(exam.subject) && (
                        <div className="flex flex-wrap gap-1 justify-end">
                            {exam.subject.map((s: string) => (
                                <span key={s} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800">
                                    {s}
                                </span>
                            ))}
                        </div>
                      )}
                    </div>
                </div>
                <CardTitle className="text-base">{exam.title}</CardTitle>
                <CardDescription className="text-xs">
                  Duration: {exam.duration_minutes} mins
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <div className="mt-auto">
                <Button
                  size="sm"
                  onClick={() => setSelectedExamForPopup(exam)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-full border-none"
                >
                  Start Practice
                </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PastExamCatalog;
