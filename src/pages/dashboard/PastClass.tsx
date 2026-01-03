import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SUBJECTS } from "@/lib/constants";
import { useNavigate } from "react-router-dom";

const PastClass = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const { data: enrollments } = useEnrollments();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Past Class – Beshi Joss LMS";
  }, []);

  const { data: classes, isLoading } = useQuery({
    queryKey: ["past-classes", selectedCourse, selectedSubject],
    queryFn: async () => {
      const now = new Date().toISOString();
      let query = supabase
        .from("classes")
        .select("*, course:courses(*)")
        .or(`class_type.eq.recorded,and(class_type.eq.live,end_at.lt.${now})`)
        .order("start_at", { ascending: false });

      if (selectedCourse !== "all") {
        query = query.eq("course_id", selectedCourse);
      }

      if (selectedSubject !== "all") {
        query = query.contains("subject", [selectedSubject]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const enrolledCourseIds = enrollments?.map(e => e.course_id) || [];
  const filteredClasses = classes?.filter(c => enrolledCourseIds.includes(c.course_id)) || [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Past classes</h1>
        <p className="text-sm text-muted-foreground">Watch recordings of previous sessions.</p>
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
      ) : filteredClasses.length === 0 ? (
        <Card className="border border-foreground/50">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No recorded classes available for this course yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((classItem) => (
            <Card key={classItem.id} className="border border-foreground/50">
              <CardHeader className="space-y-1">
                <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-mono uppercase text-muted-foreground">
                        {classItem.course.name}
                    </p>
                    {Array.isArray(classItem.subject) && (
                        <div className="flex flex-wrap gap-1 justify-end">
                            {classItem.subject.map((s: string) => (
                                <span key={s} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                    {s}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <CardTitle className="text-base">{classItem.title}</CardTitle>
                <CardDescription className="text-xs">
                  {classItem.start_at && new Date(classItem.start_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {classItem.topic && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{classItem.topic}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                    {classItem.video_url && (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/class/${classItem.id}`)}>
                        Watch Recording
                    </Button>
                    )}
                    {classItem.notes_url && (
                    <Button size="sm" variant="outline" asChild>
                        <a href={classItem.notes_url} target="_blank" rel="noopener noreferrer">
                        Download Notes
                        </a>
                    </Button>
                    )}
                    {classItem.button_text && classItem.button_url && (
                    <Button size="sm" variant="outline" asChild>
                        <a href={classItem.button_url} target="_blank" rel="noopener noreferrer">
                        {classItem.button_text}
                        </a>
                    </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PastClass;
