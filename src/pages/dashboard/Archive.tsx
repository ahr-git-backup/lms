
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, BookOpen, Layers, Trophy, Clock, CheckCircle, Lock, ChevronRight, Video, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SUBJECTS } from "@/lib/constants";

const Archive = () => {
  const [activeTab, setActiveTab] = useState("classes");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const { data: enrollments } = useEnrollments();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Archive – Atlas";
  }, []);

  const resetSelection = () => {
      setSelectedSubject(null);
      setSelectedChapter(null);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
        <p className="text-sm text-muted-foreground">Access your past classes and exams organized by subject.</p>
      </header>

      <Tabs defaultValue="classes" className="space-y-6" onValueChange={(val) => { setActiveTab(val); resetSelection(); }}>
        <TabsList>
            <TabsTrigger value="classes" className="gap-2"><Video className="h-4 w-4" /> Classes</TabsTrigger>
            <TabsTrigger value="exams" className="gap-2"><Trophy className="h-4 w-4" /> Exams</TabsTrigger>
        </TabsList>

        <TabsContent value="classes">
            <ArchiveClassView
                enrollments={enrollments}
                selectedSubject={selectedSubject}
                setSelectedSubject={setSelectedSubject}
                selectedChapter={selectedChapter}
                setSelectedChapter={setSelectedChapter}
                navigate={navigate}
            />
        </TabsContent>

        <TabsContent value="exams">
            <ArchiveExamView
                enrollments={enrollments}
                selectedSubject={selectedSubject}
                setSelectedSubject={setSelectedSubject}
                selectedChapter={selectedChapter}
                setSelectedChapter={setSelectedChapter}
                navigate={navigate}
            />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ArchiveClassView = ({ enrollments, selectedSubject, setSelectedSubject, selectedChapter, setSelectedChapter, navigate }: any) => {
    // 1. Fetch distinct Subjects available in enrolled classes
    const { data: subjects, isLoading: loadingSubjects } = useQuery({
        queryKey: ["archive-classes-subjects", enrollments?.map((e: any) => e.course_id).join(',')],
        queryFn: async () => {
            if (!enrollments || enrollments.length === 0) return [];
            const courseIds = enrollments.map((e: any) => e.course_id);
            // Filter where archive_course_ids contains ANY of the enrolled courseIds.
            // PostgREST: archive_course_ids.cs.{id1,id2}
            const { data } = await supabase
                .from("classes")
                .select("subject")
                .overlaps("archive_course_ids", courseIds);

            const unique = new Set<string>();
            data?.forEach(row => {
                 if (Array.isArray(row.subject)) row.subject.forEach((s: string) => unique.add(s));
                 else if (typeof row.subject === 'string') unique.add(row.subject);
            });
            return Array.from(unique).sort();
        },
        enabled: !!enrollments && !selectedSubject
    });

    // 2. Fetch distinct Chapters for selected Subject
    const { data: chapters, isLoading: loadingChapters } = useQuery({
        queryKey: ["archive-classes-chapters", selectedSubject],
        queryFn: async () => {
            if (!enrollments || enrollments.length === 0 || !selectedSubject) return [];
            const courseIds = enrollments.map((e: any) => e.course_id);
            const { data } = await supabase
                .from("classes")
                .select("chapter")
                .overlaps("archive_course_ids", courseIds)
                .contains("subject", [selectedSubject]);

            const unique = new Set<string>();
            data?.forEach(row => {
                if (row.chapter) unique.add(row.chapter);
            });
            return Array.from(unique).sort();
        },
        enabled: !!selectedSubject && !selectedChapter
    });

    // 3. Fetch Classes for selected Chapter
    const { data: classes, isLoading: loadingClasses } = useQuery({
        queryKey: ["archive-classes-list", selectedSubject, selectedChapter],
        queryFn: async () => {
            if (!enrollments || enrollments.length === 0 || !selectedSubject || !selectedChapter) return [];
            const courseIds = enrollments.map((e: any) => e.course_id);
            const { data } = await supabase
                .from("classes")
                .select("*, course:courses(name)")
                .overlaps("archive_course_ids", courseIds)
                .contains("subject", [selectedSubject])
                .eq("chapter", selectedChapter)
                .order("start_at", { ascending: false });
            return data;
        },
        enabled: !!selectedSubject && !!selectedChapter
    });

    if (!selectedSubject) {
        if (loadingSubjects) return <div className="text-muted-foreground">Loading subjects...</div>;
        if (!subjects || subjects.length === 0) return <div className="text-muted-foreground">No classes found in your courses.</div>;
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {subjects.map(subject => (
                     <Card key={subject} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedSubject(subject)}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Subject</CardTitle>
                            <BookOpen className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold text-primary">{subject}</div>
                        </CardContent>
                     </Card>
                ))}
            </div>
        );
    }

    if (!selectedChapter) {
         return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => setSelectedSubject(null)} className="pl-0"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects</Button>
                <h2 className="text-xl font-bold">{selectedSubject}</h2>
                {loadingChapters ? (
                    <div className="text-muted-foreground">Loading chapters...</div>
                ) : !chapters || chapters.length === 0 ? (
                    <div className="text-muted-foreground">No chapters found for this subject.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {chapters.map(chapter => (
                             <Card key={chapter} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedChapter(chapter)}>
                                <CardHeader className="pb-2">
                                     <CardTitle className="text-lg">{chapter}</CardTitle>
                                </CardHeader>
                                <CardFooter className="pt-0 text-xs text-primary font-medium">View Classes <ChevronRight className="h-3 w-3 ml-1" /></CardFooter>
                             </Card>
                        ))}
                    </div>
                )}
            </div>
         );
    }

    return (
        <div className="space-y-6">
            <Button variant="ghost" onClick={() => setSelectedChapter(null)} className="pl-0"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Chapters</Button>
            <div>
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{selectedSubject}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{selectedChapter}</span>
                </div>
                <h2 className="text-xl font-bold mt-1">Available Classes</h2>
            </div>

            {loadingClasses ? (
                <div className="text-muted-foreground">Loading classes...</div>
            ) : !classes || classes.length === 0 ? (
                <div className="text-muted-foreground">No classes found.</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {classes.map((classItem: any) => (
                         <Card key={classItem.id} className="border border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-2xl shadow-md hover:shadow-lg transition-all flex flex-col h-full">
                          <CardHeader className="space-y-1">
                            <div className="flex justify-between items-start gap-2">
                                <p className="text-xs font-mono uppercase text-muted-foreground">
                                    {classItem.course?.name}
                                </p>
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
                            <div className="flex gap-2 flex-wrap mt-auto">
                                {classItem.video_url && (
                                <Button size="sm" className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 border-none" onClick={() => navigate(`/dashboard/class/${classItem.id}`)}>
                                    Class
                                </Button>
                                )}
                                {classItem.notes_url && (
                                <Button size="sm" className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 border-none" asChild>
                                    <a href={classItem.notes_url} target="_blank" rel="noopener noreferrer">
                                    Note
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

const ArchiveExamView = ({ enrollments, selectedSubject, setSelectedSubject, selectedChapter, setSelectedChapter, navigate }: any) => {
    // 1. Fetch distinct Subjects
    const { data: subjects, isLoading: loadingSubjects } = useQuery({
        queryKey: ["archive-exams-subjects", enrollments?.map((e: any) => e.course_id).join(',')],
        queryFn: async () => {
            if (!enrollments || enrollments.length === 0) return [];
            const courseIds = enrollments.map((e: any) => e.course_id);
            const { data } = await supabase
                .from("exams")
                .select("subject")
                .overlaps("archive_course_ids", courseIds)
                .eq("is_published", true);

            const unique = new Set<string>();
            data?.forEach(row => {
                 if (Array.isArray(row.subject)) row.subject.forEach((s: string) => unique.add(s));
                 else if (typeof row.subject === 'string') unique.add(row.subject);
            });
            return Array.from(unique).sort();
        },
        enabled: !!enrollments && !selectedSubject
    });

    // 2. Fetch distinct Chapters
    const { data: chapters, isLoading: loadingChapters } = useQuery({
        queryKey: ["archive-exams-chapters", selectedSubject],
        queryFn: async () => {
            if (!enrollments || enrollments.length === 0 || !selectedSubject) return [];
            const courseIds = enrollments.map((e: any) => e.course_id);
            const { data } = await supabase
                .from("exams")
                .select("chapter")
                .overlaps("archive_course_ids", courseIds)
                .contains("subject", [selectedSubject])
                .eq("is_published", true);

            const unique = new Set<string>();
            data?.forEach(row => {
                if (row.chapter) unique.add(row.chapter);
            });
            return Array.from(unique).sort();
        },
        enabled: !!selectedSubject && !selectedChapter
    });

    // 3. Fetch Exams
    const { data: exams, isLoading: loadingExams } = useQuery({
        queryKey: ["archive-exams-list", selectedSubject, selectedChapter],
        queryFn: async () => {
             if (!enrollments || enrollments.length === 0 || !selectedSubject || !selectedChapter) return [];
             const courseIds = enrollments.map((e: any) => e.course_id);
             const { data } = await supabase
                 .from("exams")
                 .select("*, course:courses(name), questions_count:exam_questions(count)")
                 .overlaps("archive_course_ids", courseIds)
                 .contains("subject", [selectedSubject])
                 .eq("chapter", selectedChapter)
                 .eq("is_published", true)
                 .order("created_at", { ascending: false });
             return data;
        },
        enabled: !!selectedSubject && !!selectedChapter
    });

    if (!selectedSubject) {
        if (loadingSubjects) return <div className="text-muted-foreground">Loading subjects...</div>;
        if (!subjects || subjects.length === 0) return <div className="text-muted-foreground">No exams found in your courses.</div>;
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {subjects.map(subject => (
                     <Card key={subject} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedSubject(subject)}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Subject</CardTitle>
                            <Trophy className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold text-primary">{subject}</div>
                        </CardContent>
                     </Card>
                ))}
            </div>
        );
    }

    if (!selectedChapter) {
         return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => setSelectedSubject(null)} className="pl-0"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects</Button>
                <h2 className="text-xl font-bold">{selectedSubject}</h2>
                {loadingChapters ? (
                    <div className="text-muted-foreground">Loading chapters...</div>
                ) : !chapters || chapters.length === 0 ? (
                    <div className="text-muted-foreground">No chapters found for this subject.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {chapters.map(chapter => (
                             <Card key={chapter} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedChapter(chapter)}>
                                <CardHeader className="pb-2">
                                     <CardTitle className="text-lg">{chapter}</CardTitle>
                                </CardHeader>
                                <CardFooter className="pt-0 text-xs text-primary font-medium">View Exams <ChevronRight className="h-3 w-3 ml-1" /></CardFooter>
                             </Card>
                        ))}
                    </div>
                )}
            </div>
         );
    }

    return (
        <div className="space-y-6">
            <Button variant="ghost" onClick={() => setSelectedChapter(null)} className="pl-0"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Chapters</Button>
            <div>
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{selectedSubject}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{selectedChapter}</span>
                </div>
                <h2 className="text-xl font-bold mt-1">Available Exams</h2>
            </div>

            {loadingExams ? (
                <div className="text-muted-foreground">Loading exams...</div>
            ) : !exams || exams.length === 0 ? (
                <div className="text-muted-foreground">No exams found.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map((exam: any) => (
                    <Card
                        key={exam.id}
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group flex flex-col"
                        onClick={() => navigate(`/dashboard/take-exam/${exam.id}`)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start gap-2">
                                <div className="space-y-1">
                                    <p className="text-xs font-mono uppercase text-muted-foreground">
                                        {exam.course?.name}
                                    </p>
                                    <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                        {exam.title}
                                    </CardTitle>
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                    <Badge variant={exam.exam_type === 'live' ? 'destructive' : 'secondary'} className="shrink-0 capitalize">
                                        {exam.exam_type}
                                    </Badge>
                                </div>
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
            )}
        </div>
    );
};

export default Archive;
