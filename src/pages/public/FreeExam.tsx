import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ArrowLeft, Trophy, Clock, CheckCircle, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Types
interface Exam {
  id: string;
  title: string;
  subject: string[] | string | null;
  exam_type: string;
  duration_minutes: number;
  questions_count: { count: number }[];
}

const FreeExam = () => {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Free Exams – Atlas";
  }, []);

  // State
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Fetch Public Exams
  const { data: exams, isLoading } = useQuery({
    queryKey: ["public-free-exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("id, title, subject, exam_type, duration_minutes, questions_count:exam_questions(count)")
        .is("course_id", null)
        .eq("is_published", true);

      if (error) throw error;
      return data;
    },
  });

  // Helper to extract unique subjects
  const getUniqueSubjects = () => {
    if (!exams) return [];
    const subjects = new Set<string>();
    exams.forEach(exam => {
      if (Array.isArray(exam.subject)) {
        exam.subject.forEach(s => subjects.add(s));
      } else if (typeof exam.subject === 'string' && exam.subject) {
        subjects.add(exam.subject);
      }
    });
    return Array.from(subjects).sort();
  };

  const subjects = getUniqueSubjects();

  // Filter exams by selected subject
  const filteredExams = exams?.filter(exam => {
    if (!selectedSubject) return true;
    if (Array.isArray(exam.subject)) return exam.subject.includes(selectedSubject);
    return exam.subject === selectedSubject;
  }) || [];

  // Level 1: Subjects
  if (!selectedSubject) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl min-h-[80vh]">
        <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Free Exams</h1>
            <p className="text-muted-foreground">Select a subject to test your skills.</p>
        </div>

        {isLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
             </div>
        ) : subjects.length === 0 ? (
            <div className="text-center py-20 bg-muted/30 rounded-lg">
                <Flame className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
                <h3 className="text-lg font-medium">No free exams available at the moment.</h3>
                <p className="text-sm text-muted-foreground">Please check back later.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {subjects.map(subject => (
                    <Card
                        key={subject}
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
                        onClick={() => setSelectedSubject(subject)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Subject</CardTitle>
                            <Trophy className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary mb-1">{subject}</div>
                            <p className="text-xs text-muted-foreground">
                                {exams?.filter(e => {
                                    if(Array.isArray(e.subject)) return e.subject.includes(subject);
                                    return e.subject === subject;
                                }).length} exams available
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
      </div>
    );
  }

  // Level 2: Exam List
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl min-h-[80vh]">
        <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent" onClick={() => setSelectedSubject(null)}>
             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects
        </Button>

        <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-primary">{selectedSubject}</h2>
            <p className="text-muted-foreground">Available exams.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam: any) => (
                <Card
                    key={exam.id}
                    className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group flex flex-col"
                    onClick={() => navigate(`/open-exam/${exam.id}`)}
                >
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start gap-2">
                             <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                 {exam.title}
                             </CardTitle>
                             <Badge variant={exam.exam_type === 'live' ? 'destructive' : 'secondary'} className="shrink-0 capitalize">
                                 {exam.exam_type}
                             </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <div className="grid grid-cols-2 gap-y-2 text-sm text-muted-foreground mt-2">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>{exam.duration_minutes} min</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                <span>{exam.questions_count?.[0]?.count || 0} Questions</span>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-0 mt-auto border-t pt-4">
                        <Button className="w-full group-hover:bg-primary/90">
                            Start Exam
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    </div>
  );
};

export default FreeExam;
