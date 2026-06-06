import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, Video, FileText, FolderOpen, Layers, ChevronRight, Clock, Trophy, Archive, LayoutTemplate } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { CourseItemsManagerDialog } from "@/components/admin/CourseItemsManagerDialog";
import { ChapterSortDialog } from "@/components/admin/ChapterSortDialog";

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { data: enrollments } = useEnrollments();
  const { isAdmin } = useAuth();

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [manageType, setManageType] = useState<"classes" | "exams" | null>(null);
  const [manageChapters, setManageChapters] = useState(false);

  const enrollment = enrollments?.find((e: any) => e.course_id === courseId);

  useEffect(() => {
    if (enrollment?.course?.name) {
        document.title = `${enrollment.course.name} – Atlas`;
    }
  }, [enrollment]);

  // 1. Subjects
  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ["course-subjects", courseId],
    queryFn: async () => {
      if (!courseId) return [];

      // Fetch subjects from classes
      const { data: classData } = await supabase
        .from("classes")
        .select("subject")
        .or(`course_id.eq.${courseId},shared_course_ids.ov.{${courseId}}`);

      // Fetch subjects from exams
      const { data: examData } = await supabase
        .from("exams")
        .select("subject")
        .or(`course_id.eq.${courseId},shared_course_ids.ov.{${courseId}}`)
        .eq("is_published", true);

      const unique = new Set<string>();

      const processSubjects = (data: any[]) => {
          data?.forEach(row => {
             if (Array.isArray(row.subject)) row.subject.forEach((s: string) => unique.add(s));
             else if (typeof row.subject === 'string') unique.add(row.subject);
          });
      };

      processSubjects(classData || []);
      processSubjects(examData || []);

      const { data: settingsData } = await supabase.from("app_settings").select("value").eq("key", "subject_order_global").maybeSingle();
            const savedOrder: string[] = settingsData?.value ? (settingsData.value as string[]) : [];

            return Array.from(unique).sort((a, b) => {
                const idxA = savedOrder.indexOf(a);
                const idxB = savedOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });
    },
    enabled: !!courseId
  });

  // 2. Chapters
  const { data: chapters, isLoading: loadingChapters } = useQuery({
    queryKey: ["course-chapters", courseId, selectedSubject],
    queryFn: async () => {
      if (!courseId || !selectedSubject) return [];

      // Fetch chapters from classes
      const { data: classData } = await supabase
        .from("classes")
        .select("chapter, sort_order")
        .or(`course_id.eq.${courseId},shared_course_ids.ov.{${courseId}}`)
        .contains("subject", [selectedSubject]);

      // Fetch chapters from exams
      const { data: examData } = await supabase
        .from("exams")
        .select("chapter, sort_order")
        .or(`course_id.eq.${courseId},shared_course_ids.ov.{${courseId}}`)
        .contains("subject", [selectedSubject])
        .eq("is_published", true);

      const settingsKey = `chapter_order_global_${selectedSubject}`;
      const { data: settingsData } = await supabase.from("app_settings").select("value").eq("key", settingsKey).maybeSingle();

      const unique = new Set<string>();
      const orderMap = new Map<string, number>();

      const savedOrder: string[] = settingsData?.value ? (settingsData.value as string[]) : [];

      const processChapters = (data: any[]) => {
          data?.forEach(row => {
              if (row.chapter) {
                  unique.add(row.chapter);
                  const currentMax = orderMap.get(row.chapter) || 0;
                  const itemOrder = row.sort_order || 0;
                  if (itemOrder > currentMax) {
                      orderMap.set(row.chapter, itemOrder);
                  }
              }
          });
      };

      processChapters(classData || []);
      processChapters(examData || []);

      return Array.from(unique).sort((a, b) => {
          // First respect the saved order
          const idxA = savedOrder.indexOf(a);
          const idxB = savedOrder.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          // Fallback to item priority
          const orderA = orderMap.get(a) || 0;
          const orderB = orderMap.get(b) || 0;
          if (orderA !== orderB) return orderB - orderA; // higher first
          return a.localeCompare(b); // fallback to alphabetical
      });
    },
    enabled: !!courseId && !!selectedSubject
  });

  if (!enrollment && enrollments) {
      return (
          <div className="p-8 text-center">
              <h2 className="text-xl font-bold text-destructive">Access Denied</h2>
              <p>You are not enrolled in this course.</p>
              <Button className="mt-4" onClick={() => navigate("/dashboard/my-courses")}>My Courses</Button>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
              if (selectedChapter) setSelectedChapter(null);
              else if (selectedSubject) setSelectedSubject(null);
              else navigate("/dashboard/my-courses");
          }}>
              <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
                {selectedChapter || selectedSubject || enrollment?.course?.name || "Course View"}
            </h1>
            {selectedSubject && (
                <p className="text-xs text-muted-foreground">
                    {enrollment?.course?.name} {selectedChapter ? `> ${selectedSubject}` : ""}
                </p>
            )}
          </div>
      </div>

      {isAdmin && selectedChapter && (
          <div className="flex gap-2 mb-4 bg-muted/30 p-3 rounded-lg border">
              <div className="text-sm font-medium mr-auto self-center">Admin Controls:</div>
              <Button variant="outline" size="sm" onClick={() => setManageType("classes")}>Manage Classes Order</Button>
              <Button variant="outline" size="sm" onClick={() => setManageType("exams")}>Manage Exams Order</Button>
          </div>
      )}

      {isAdmin && !selectedChapter && selectedSubject && chapters && chapters.length > 0 && (
          <div className="flex gap-2 mb-4 bg-muted/30 p-3 rounded-lg border">
              <div className="text-sm font-medium mr-auto self-center">Admin Controls:</div>
              <Button variant="outline" size="sm" onClick={() => setManageChapters(true)}>Manage Chapters Order</Button>
          </div>
      )}

      {manageType ? (
        <CourseItemsManagerDialog
          courseId={courseId!}
          courseName={enrollment?.course?.name || "Course"}
          subjectFilter={selectedSubject}
          chapterFilter={selectedChapter}
          resourceType={manageType}
          onClose={() => setManageType(null)}
        />
      ) : manageChapters ? (
        <ChapterSortDialog
          courseId={courseId!}
          subject={selectedSubject!}
          chapters={chapters || []}
          contextName={enrollment?.course?.name || "Course"}
          onClose={() => setManageChapters(false)}
        />
      ) : (
          <>
          {!selectedSubject ? (
              <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Subjects</h2>
                  {loadingSubjects ? <div className="text-muted-foreground">Loading...</div> : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {subjects?.map(sub => (
                              <Card key={sub} className="cursor-pointer hover:border-primary/50 transition-all" onClick={() => setSelectedSubject(sub)}>
                                  <CardHeader className="flex flex-row items-center gap-4">
                                      <div className="p-3 bg-primary/10 rounded-full text-primary">
                                          <BookOpen className="h-6 w-6" />
                                      </div>
                                      <CardTitle className="text-base">{sub}</CardTitle>
                                  </CardHeader>
                              </Card>
                          ))}
                          {subjects?.length === 0 && <p className="text-muted-foreground">No content found.</p>}
                      </div>
                  )}
              </div>
          ) : !selectedChapter ? (
              <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Chapters in {selectedSubject}</h2>
                  {loadingChapters ? <div className="text-muted-foreground">Loading...</div> : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {chapters?.map(chap => (
                              <Card key={chap} className="cursor-pointer hover:border-primary/50 transition-all" onClick={() => setSelectedChapter(chap)}>
                                  <CardHeader className="flex flex-row items-center justify-between">
                                      <CardTitle className="text-base">{chap}</CardTitle>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </CardHeader>
                              </Card>
                          ))}
                          {chapters?.length === 0 && <p className="text-muted-foreground">No chapters found.</p>}
                      </div>
                  )}
              </div>
          ) : (
              <CourseContentTabs courseId={courseId!} subject={selectedSubject} chapter={selectedChapter} />
          )}
          </>
      )}
    </div>
  );
};

const CourseContentTabs = ({ courseId, subject, chapter }: { courseId: string, subject: string, chapter: string }) => {
    return (
        <Tabs defaultValue="recordings" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto">
                <TabsTrigger value="recordings" className="gap-2"><Video className="h-4 w-4" /> Recordings</TabsTrigger>
                <TabsTrigger value="exams" className="gap-2"><Trophy className="h-4 w-4" /> Exams</TabsTrigger>
                <TabsTrigger value="readymade" className="gap-2"><LayoutTemplate className="h-4 w-4" /> Readymade Exam</TabsTrigger>
                <TabsTrigger value="archive-class" className="gap-2"><Archive className="h-4 w-4" /> Arch. Class</TabsTrigger>
                <TabsTrigger value="archive-exam" className="gap-2 col-span-2 sm:col-span-1"><FileText className="h-4 w-4" /> Arch. Exams</TabsTrigger>
            </TabsList>

            <TabsContent value="recordings" className="mt-6">
                <ClassList courseId={courseId} subject={subject} chapter={chapter} />
            </TabsContent>

            <TabsContent value="exams" className="mt-6">
                <ExamList courseId={courseId} subject={subject} chapter={chapter} />
            </TabsContent>

            <TabsContent value="readymade" className="mt-6">
                <ReadymadeExamList courseId={courseId} subject={subject} chapter={chapter} />
            </TabsContent>

            <TabsContent value="archive-class" className="mt-6">
                <ArchiveClassList courseId={courseId} subject={subject} chapter={chapter} />
            </TabsContent>

            <TabsContent value="archive-exam" className="mt-6">
                <ArchiveExamList courseId={courseId} subject={subject} chapter={chapter} />
            </TabsContent>
        </Tabs>
    );
}

const ClassList = ({ courseId, subject, chapter }: any) => {
    const navigate = useNavigate();
    const { data: classes, isLoading } = useQuery({
        queryKey: ["course-classes", courseId, subject, chapter],
        queryFn: async () => {
            const { data } = await supabase
                .from("classes")
                .select("*")
                .or(`course_id.eq.${courseId},shared_course_ids.ov.{${courseId}}`)
                .not("is_archive", "is", true)
                .contains("subject", [subject])
                .eq("chapter", chapter)
                .order("sort_order", { ascending: false })
                .order("start_at", { ascending: false });
            return data || [];
        }
    });

    if (isLoading) return <div>Loading...</div>;
    if (!classes || classes.length === 0) return <div>No recordings found.</div>;

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {classes.map((cls: any) => (
                <Card key={cls.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm leading-snug">{cls.title}</CardTitle>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {cls.start_at && new Date(cls.start_at).toLocaleDateString()}
                        </div>
                    </CardHeader>
                    <CardFooter className="mt-auto pt-4">
                        <Button size="sm" className="w-full" onClick={() => navigate(`/dashboard/class/${cls.id}`)}>
                            Watch Class
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}

const ExamList = ({ courseId, subject, chapter }: any) => {
    const navigate = useNavigate();
    const { data: exams, isLoading } = useQuery({
        queryKey: ["course-exams", courseId, subject, chapter],
        queryFn: async () => {
            const { data } = await supabase
                .from("exams")
                .select("*")
                .or(`course_id.eq.${courseId},shared_course_ids.ov.{${courseId}}`)
                .not("is_archive", "is", true)
                .contains("subject", [subject])
                .eq("chapter", chapter)
                .eq("is_published", true)
                .not("is_readymade", "is", true) // Exclude readymade
                .order("created_at", { ascending: false });
            return data || [];
        }
    });

    if (isLoading) return <div>Loading...</div>;
    if (!exams || exams.length === 0) return <div>No exams found.</div>;

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {exams.map((exam: any) => (
                <Card key={exam.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-sm leading-snug">{exam.title}</CardTitle>
                            {exam.exam_type === 'live' && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">LIVE</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {exam.duration_minutes} mins • {exam.total_marks || '?'} marks
                        </div>
                    </CardHeader>
                    <CardFooter className="mt-auto pt-4">
                        <Button size="sm" className="w-full" onClick={() => navigate(`/dashboard/take-exam/${exam.id}`)}>
                            Start Exam
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}

const ReadymadeExamList = ({ courseId, subject, chapter }: any) => {
    const navigate = useNavigate();
    const { data: exams, isLoading } = useQuery({
        queryKey: ["course-readymade-exams", courseId, subject, chapter],
        queryFn: async () => {
            const { data } = await supabase
                .from("exams")
                .select("*")
                .or(`course_id.eq.${courseId},shared_course_ids.ov.{${courseId}},readymade_course_ids.ov.{${courseId}}`)
                .contains("subject", [subject])
                .eq("chapter", chapter)
                .eq("is_published", true)
                .eq("is_readymade", true)
                .order("created_at", { ascending: false });
            return data || [];
        }
    });

    if (isLoading) return <div>Loading...</div>;
    if (!exams || exams.length === 0) return <div>No readymade exams found.</div>;

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {exams.map((exam: any) => (
                <Card key={exam.id} className="flex flex-col border-blue-100 bg-blue-50/20">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-sm leading-snug">{exam.title}</CardTitle>
                            <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600">Readymade</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {exam.duration_minutes} mins • {exam.total_marks || '?'} marks
                        </div>
                    </CardHeader>
                    <CardFooter className="mt-auto pt-4">
                        <Button size="sm" className="w-full" onClick={() => navigate(`/dashboard/take-exam/${exam.id}`)}>
                            Start Exam
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}

const ArchiveClassList = ({ courseId, subject, chapter }: any) => {
    const navigate = useNavigate();
    const { data: classes, isLoading } = useQuery({
        queryKey: ["course-archive-classes", courseId, subject, chapter],
        queryFn: async () => {
            const { data } = await supabase
                .from("classes")
                .select("*")
                .or(`archive_course_ids.cs.{${courseId}},and(course_id.eq.${courseId},is_archive.eq.true)`)
                .contains("subject", [subject])
                .eq("chapter", chapter)
                .order("sort_order", { ascending: false })
                .order("start_at", { ascending: false });
            return data || [];
        }
    });

    if (isLoading) return <div>Loading...</div>;
    if (!classes || classes.length === 0) return <div>No archive classes found.</div>;

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {classes.map((cls: any) => (
                <Card key={cls.id} className="flex flex-col border-emerald-100 bg-emerald-50/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm leading-snug">{cls.title}</CardTitle>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                             <Badge variant="outline" className="text-[10px]">Archive</Badge>
                             <Clock className="h-3 w-3" />
                             {cls.start_at && new Date(cls.start_at).toLocaleDateString()}
                        </div>
                    </CardHeader>
                    <CardFooter className="mt-auto pt-4">
                        <Button size="sm" className="w-full" onClick={() => navigate(`/dashboard/class/${cls.id}`)}>
                            Watch Class
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}

const ArchiveExamList = ({ courseId, subject, chapter }: any) => {
    const navigate = useNavigate();
    const { data: exams, isLoading } = useQuery({
        queryKey: ["course-archive-exams", courseId, subject, chapter],
        queryFn: async () => {
            const { data } = await supabase
                .from("exams")
                .select("*")
                .or(`archive_course_ids.cs.{${courseId}},and(course_id.eq.${courseId},is_archive.eq.true)`)
                .contains("subject", [subject])
                .eq("chapter", chapter)
                .eq("is_published", true)
                .order("created_at", { ascending: false });
            return data || [];
        }
    });

    if (isLoading) return <div>Loading...</div>;
    if (!exams || exams.length === 0) return <div>No archive exams found.</div>;

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {exams.map((exam: any) => (
                <Card key={exam.id} className="flex flex-col border-emerald-100 bg-emerald-50/20">
                    <CardHeader className="pb-2">
                         <div className="flex justify-between items-start">
                            <CardTitle className="text-sm leading-snug">{exam.title}</CardTitle>
                            <Badge variant="outline" className="text-[10px]">Archive</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {exam.duration_minutes} mins
                        </div>
                    </CardHeader>
                    <CardFooter className="mt-auto pt-4">
                        <Button size="sm" className="w-full" onClick={() => navigate(`/dashboard/take-exam/${exam.id}`)}>
                            Start Exam
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}

export default CourseView;
