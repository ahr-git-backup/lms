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
  const { data: enrollments, isLoading: enrollmentsLoading } = useEnrollments();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Past Exams – Beshi Joss LMS";
  }, []);

  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: ["past-exam-catalog", user?.id, selectedCourse, selectedSubject],
    queryFn: async () => {
        if (!user || !enrollments || enrollments.length === 0) return [];

        const courseIds = enrollments.map(e => e.course_id);
        const now = new Date().toISOString();

        let query = supabase
            .from("exams")
            .select("*, course:courses(*)")
            .in("course_id", courseIds)
            .eq("is_published", true)
            // Filter: Either practice exam OR (live exam AND window ended)
            .or(`exam_type.eq.practice,and(exam_type.eq.live,time_window_end.lt.${now})`)
            .order("created_at", { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        let filteredData = data || [];

        if (selectedCourse !== "all") {
            filteredData = filteredData.filter(e => e.course_id === selectedCourse);
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
        <div className="grid gap-4 md:grid-cols-2">
          {exams.map((exam) => (
            <Card key={exam.id} className="border border-foreground/50">
              <CardHeader className="space-y-1">
                <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-mono uppercase text-muted-foreground">
                    {exam.course.name}
                    </p>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={exam.exam_type === 'live' ? "secondary" : "outline"}>
                          {exam.exam_type === 'live' ? 'Expired Live' : 'Practice'}
                      </Badge>
                      {Array.isArray(exam.subject) && (
                        <div className="flex flex-wrap gap-1 justify-end">
                            {exam.subject.map((s: string) => (
                                <span key={s} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
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
              <CardContent>
                <Button
                  size="sm"
                  onClick={() => setSelectedExamForPopup(exam)}
                >
                  Start Practice
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PastExamCatalog;
