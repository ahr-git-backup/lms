import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trophy, Clock, CheckCircle, ChevronRight, Search, ChevronLeft, LayoutTemplate, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MultiSelect } from "@/components/ui/multi-select";

const PAGE_SIZE = 15;

const Readymade = () => {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const { data: enrollments } = useEnrollments();
  const navigate = useNavigate();

  // Search & Pagination State
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  // Topics filtering
  const [selectedParentTopics, setSelectedParentTopics] = useState<string[]>([]);

  // Fetch unique topics
  const { data: parentTopics } = useQuery({
      queryKey: ["readymade-parent-topics", enrollments?.map((e: any) => e.course_id).join(',')],
      queryFn: async () => {
          const enrolledIds = enrollments?.map((e: any) => e.course_id) || [];
          let query = supabase
              .from("exams")
              .select("readymade_topic")
              .eq("is_readymade", true)
              .eq("is_published", true)
              .not("readymade_topic", "is", null);

          if (enrolledIds.length > 0) {
              query = query.or(`course_id.in.(${enrolledIds.join(',')}),course_id.is.null,shared_course_ids.cs.{${enrolledIds.join(',')}},readymade_course_ids.cs.{${enrolledIds.join(',')}}`);
          } else {
              query = query.is("course_id", null);
          }

          const { data } = await query;
          const unique = new Set<string>();
          data?.forEach(row => {
              if (row.readymade_topic) unique.add(row.readymade_topic);
          });
          return Array.from(unique).sort().map(topic => ({ label: topic, value: topic }));
      }
  });

  useEffect(() => {
    document.title = "Readymade – Atlas";
  }, []);

  useEffect(() => {
      const timer = setTimeout(() => {
          setDebouncedSearch(searchQuery);
          if (searchQuery) setPage(0);
      }, 500);
      return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Readymade Exam</h1>
        <p className="text-sm text-muted-foreground">Pre-configured practice exams for your courses.</p>
      </header>

      <div className="flex flex-col sm:flex-row justify-end items-end sm:items-center gap-2">
          {parentTopics && parentTopics.length > 0 && (
              <div className="w-full sm:w-64">
                  <MultiSelect
                      options={parentTopics}
                      selected={selectedParentTopics}
                      onChange={setSelectedParentTopics}
                      placeholder="Select Topics..."
                  />
              </div>
          )}
          <div className="relative w-full sm:w-auto flex items-center justify-end">
              {isSearchExpanded ? (
                  <div className="flex items-center w-full sm:w-64 relative animate-in fade-in zoom-in duration-200">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                          placeholder="Search exams..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 pr-8"
                          autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 h-9 w-9"
                        onClick={() => {
                            setSearchQuery("");
                            setIsSearchExpanded(false);
                        }}
                      >
                          <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                  </div>
              ) : (
                  <Button variant="outline" size="icon" onClick={() => setIsSearchExpanded(true)}>
                      <Search className="h-4 w-4 text-muted-foreground" />
                  </Button>
              )}
          </div>
      </div>

      <ReadymadeExamView
            enrollments={enrollments}
            selectedSubject={selectedSubject}
            setSelectedSubject={setSelectedSubject}
            selectedChapter={selectedChapter}
            setSelectedChapter={setSelectedChapter}
            navigate={navigate}
            searchQuery={debouncedSearch}
            page={page}
            setPage={setPage}
            selectedParentTopics={selectedParentTopics}
      />
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReadymadeExamView = ({ enrollments, selectedSubject, setSelectedSubject, selectedChapter, setSelectedChapter, navigate, searchQuery, page, setPage, selectedParentTopics }: any) => {

    const { data: searchResults, isLoading: searching } = useQuery({
        queryKey: ["readymade-exams-search", enrollments?.map((e: any) => e.course_id).join(','), searchQuery, page, selectedParentTopics],
        queryFn: async () => {
            // Must have enrollments or be public (though readymade usually implies curated)
            // Logic: Is readymade AND (public OR enrolled OR shared)
            const enrolledIds = enrollments?.map((e: any) => e.course_id) || [];
            const safeQuery = searchQuery.replace(/[^\w\s\u0980-\u09FF]/g, "").trim();

            if (!safeQuery) return { data: [], count: 0 };

            let query = supabase
                .from("exams")
                .select("*, course:courses(name), questions_count:exam_questions(count)", { count: 'exact' })
                .eq("is_readymade", true)
                .eq("is_published", true)
                .ilike("title", `%${safeQuery}%`)
                .order("created_at", { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (selectedParentTopics && selectedParentTopics.length > 0) {
                query = query.in("readymade_topic", selectedParentTopics);
            }

            // Filter by access: Enrolled course must be in course_id, OR shared_course_ids, OR readymade_course_ids, OR null (public)
            if (enrolledIds.length > 0) {
                 query = query.or(`course_id.in.(${enrolledIds.join(',')}),course_id.is.null,shared_course_ids.cs.{${enrolledIds.join(',')}},readymade_course_ids.cs.{${enrolledIds.join(',')}}`);
            } else {
                 query = query.is("course_id", null);
            }

            const { data, error, count } = await query;
            if (error) throw error;
            return { data: data || [], count: count || 0 };
        },
        enabled: !!searchQuery
    });

    const { data: subjects, isLoading: loadingSubjects } = useQuery({
        queryKey: ["readymade-exams-subjects", enrollments?.map((e: any) => e.course_id).join(','), selectedParentTopics],
        queryFn: async () => {
            const enrolledIds = enrollments?.map((e: any) => e.course_id) || [];
            let query = supabase
                .from("exams")
                .select("subject, course_id, shared_course_ids")
                .eq("is_readymade", true)
                .eq("is_published", true);

             if (selectedParentTopics && selectedParentTopics.length > 0) {
                 query = query.in("readymade_topic", selectedParentTopics);
             }

             if (enrolledIds.length > 0) {
                 query = query.or(`course_id.in.(${enrolledIds.join(',')}),course_id.is.null,shared_course_ids.cs.{${enrolledIds.join(',')}},readymade_course_ids.cs.{${enrolledIds.join(',')}}`);
                 query = query.or(`course_id.in.(${enrolledIds.join(',')}),course_id.is.null,shared_course_ids.cs.{${enrolledIds.join(',')}},readymade_course_ids.cs.{${enrolledIds.join(',')}}`);
                 query = query.or(`course_id.in.(${enrolledIds.join(',')}),course_id.is.null,shared_course_ids.cs.{${enrolledIds.join(',')}},readymade_course_ids.cs.{${enrolledIds.join(',')}}`);
             } else {
                 query = query.is("course_id", null);
             }

            const { data } = await query;

            const unique = new Set<string>();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data?.forEach((row: any) => {
                 if (Array.isArray(row.subject)) row.subject.forEach((s: string) => unique.add(s));
                 else if (typeof row.subject === 'string') unique.add(row.subject);
            });
            return Array.from(unique).sort();
        },
        enabled: !selectedSubject && !searchQuery
    });

    const { data: chapters, isLoading: loadingChapters } = useQuery({
        queryKey: ["readymade-exams-chapters", selectedSubject, enrollments?.map((e: any) => e.course_id).join(','), selectedParentTopics],
        queryFn: async () => {
            if (!selectedSubject) return [];
            const enrolledIds = enrollments?.map((e: any) => e.course_id) || [];

            let query = supabase
                .from("exams")
                .select("chapter, course_id, shared_course_ids")
                .eq("is_readymade", true)
                .eq("is_published", true)
                .contains("subject", [selectedSubject]);

             if (selectedParentTopics && selectedParentTopics.length > 0) {
                 query = query.in("readymade_topic", selectedParentTopics);
             }

             if (enrolledIds.length > 0) {
                 query = query.or(`course_id.in.(${enrolledIds.join(',')}),course_id.is.null,shared_course_ids.cs.{${enrolledIds.join(',')}}`);
             } else {
                 query = query.is("course_id", null);
             }

            const { data } = await query;

            const unique = new Set<string>();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data?.forEach((row: any) => {
                if (row.chapter) unique.add(row.chapter);
            });
            return Array.from(unique).sort();
        },
        enabled: !!selectedSubject && !selectedChapter && !searchQuery
    });

    const { data: examsData, isLoading: loadingExams } = useQuery({
        queryKey: ["readymade-exams-list", selectedSubject, selectedChapter, page, enrollments?.map((e: any) => e.course_id).join(','), selectedParentTopics],
        queryFn: async () => {
             if (!selectedSubject || !selectedChapter) return { data: [], count: 0 };
             const enrolledIds = enrollments?.map((e: any) => e.course_id) || [];

             let query = supabase
                 .from("exams")
                 .select("*, course:courses(name), questions_count:exam_questions(count)", { count: 'exact' })
                 .eq("is_readymade", true)
                 .eq("is_published", true)
                 .contains("subject", [selectedSubject])
                 .eq("chapter", selectedChapter)
                 .order("created_at", { ascending: false })
                 .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

             if (selectedParentTopics && selectedParentTopics.length > 0) {
                 query = query.in("readymade_topic", selectedParentTopics);
             }

             if (enrolledIds.length > 0) {
                 query = query.or(`course_id.in.(${enrolledIds.join(',')}),course_id.is.null,shared_course_ids.cs.{${enrolledIds.join(',')}}`);
             } else {
                 query = query.is("course_id", null);
             }

             const { data, count, error } = await query;
             if (error) throw error;
             return { data: data || [], count: count || 0 };
        },
        enabled: !!selectedSubject && !!selectedChapter && !searchQuery
    });

    if (searchQuery) {
        if (searching) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>;
        const exams = searchResults?.data || [];
        const count = searchResults?.count || 0;
        const totalPages = Math.ceil(count / PAGE_SIZE);

        if (exams.length === 0) return <div className="text-center py-12 text-muted-foreground">No readymade exams found matching "{searchQuery}".</div>;

        return (
            <div className="space-y-6">
                <ExamGrid exams={exams} navigate={navigate} />
                <PaginationControls page={page} setPage={setPage} totalPages={totalPages} />
            </div>
        );
    }

    if (!selectedSubject) {
        if (loadingSubjects) return <div className="text-muted-foreground">Loading subjects...</div>;
        if (!subjects || subjects.length === 0) return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <LayoutTemplate className="h-12 w-12 opacity-20" />
                <p>No readymade exams found in your courses.</p>
            </div>
        );
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

    const exams = examsData?.data || [];
    const totalCount = examsData?.count || 0;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <Button variant="ghost" onClick={() => setSelectedChapter(null)} className="pl-0"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Chapters</Button>
            <div>
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{selectedSubject}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{selectedChapter}</span>
                </div>
                <h2 className="text-xl font-bold mt-1">Available Readymade Exams</h2>
            </div>

            {loadingExams ? (
                <div className="text-muted-foreground">Loading exams...</div>
            ) : !exams || exams.length === 0 ? (
                <div className="text-muted-foreground">No exams found.</div>
            ) : (
                <>
                <ExamGrid exams={exams} navigate={navigate} />
                <PaginationControls page={page} setPage={setPage} totalPages={totalPages} />
                </>
            )}
        </div>
    );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ExamGrid = ({ exams, navigate }: { exams: any[], navigate: any }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map((exam) => (
            <Card
                key={exam.id}
                className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group flex flex-col"
                onClick={() => navigate(`/dashboard/take-exam/${exam.id}`)}
            >
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1">
                            <p className="text-xs font-mono uppercase text-muted-foreground">
                                {exam.course?.name || "Public"}
                            </p>
                            <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                {exam.title}
                            </CardTitle>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-blue-500 border-blue-200">Readymade</Badge>
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
);

const PaginationControls = ({ page, setPage, totalPages }: { page: number, setPage: (p: number) => void, totalPages: number }) => {
    return (
        <div className="flex items-center justify-between pt-4">
             <div className="text-xs text-muted-foreground">
                 Page {page + 1} of {totalPages || 1}
             </div>
             <div className="flex gap-2">
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                 >
                     <ChevronLeft className="h-4 w-4" />
                     Previous
                 </Button>
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                 >
                     Next <ChevronRight className="h-4 w-4" />
                 </Button>
             </div>
        </div>
    );
};

export default Readymade;
