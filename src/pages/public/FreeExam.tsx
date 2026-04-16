import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronRight, ArrowLeft, Trophy, Clock, CheckCircle, Flame, Layers, Plus, Edit, Search, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PublicHeader from "@/components/PublicHeader";

// Types
interface Exam {
  id: string;
  title: string;
  subject: string[] | string | null;
  chapter: string | null;
  exam_type: string;
  duration_minutes: number;
  questions_count: { count: number }[];
}

const PAGE_SIZE = 12;

const FreeExam = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  useEffect(() => {
    document.title = "Free Exams – Atlas";
  }, []);

  // State
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
      const timer = setTimeout(() => {
          setDebouncedSearch(searchQuery);
          if (searchQuery) setPage(0);
      }, 500);
      return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Public Exams (Metadata for hierarchy)
  const { data: exams, isLoading: isLoadingMetadata } = useQuery({
    queryKey: ["public-free-exams-metadata"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("id, title, subject, chapter, exam_type, duration_minutes, questions_count:exam_questions(count)")
        .is("course_id", null)
        .eq("is_published", true)
        // @ts-ignore
        .eq("is_visible_on_free", true);

      if (error) throw error;
      return data;
    },
    enabled: !debouncedSearch
  });

  // Fetch Search Results
  const { data: searchResults, isLoading: isLoadingSearch } = useQuery({
      queryKey: ["public-free-exams-search", debouncedSearch, page],
      queryFn: async () => {
          const query = supabase
              .from("exams")
              .select("id, title, subject, chapter, exam_type, duration_minutes, questions_count:exam_questions(count)", { count: 'exact' })
              .is("course_id", null)
              .eq("is_published", true)
              // @ts-ignore
              .eq("is_visible_on_free", true)
              .ilike("title", `%${debouncedSearch}%`)
              .order("created_at", { ascending: false })
              .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          const { data, error, count } = await query;
          if (error) throw error;
          return { data: data as Exam[], count: count || 0 };
      },
      enabled: !!debouncedSearch
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

  const getUniqueChapters = () => {
      if (!filteredExams) return [];
      const chapters = new Set<string>();
      filteredExams.forEach(exam => {
          if (exam.chapter) chapters.add(exam.chapter);
      });
      return Array.from(chapters).sort();
  };

  const handleBack = () => {
      if (selectedChapter) {
          setSelectedChapter(null);
      } else if (selectedSubject) {
          setSelectedSubject(null);
      }
  };

  // Header Component
  const renderHeader = () => (
      <div className="mb-8 relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                  <h1 className="text-3xl font-bold tracking-tight mb-2">Free Exams</h1>
                  <p className="text-muted-foreground">Select a subject to test your skills.</p>
              </div>
              <div className="w-full md:w-auto flex items-center gap-2">
                  <div className="relative w-full md:w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                          placeholder="Search exams..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                      />
                  </div>
                  {isAdmin && (
                      <Button onClick={() => navigate("/admin/exams")}>
                          <Plus className="mr-2 h-4 w-4" /> Add
                      </Button>
                  )}
              </div>
          </div>
      </div>
  );

  // --- Views ---

  // Search Mode View
  if (debouncedSearch) {
      const results = searchResults?.data || [];
      const totalCount = searchResults?.count || 0;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);

      return (
          <div className="min-h-screen bg-background text-foreground flex flex-col">
              <PublicHeader />
              <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
                  {renderHeader()}

                  {isLoadingSearch ? (
                      <div className="space-y-4">
                          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
                      </div>
                  ) : results.length === 0 ? (
                      <div className="text-center py-20 bg-muted/30 rounded-lg">
                          <Search className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
                          <h3 className="text-lg font-medium">No exams found.</h3>
                          <p className="text-sm text-muted-foreground">Try a different search term.</p>
                      </div>
                  ) : (
                      <div className="space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {results.map((exam) => (
                                  <Card
                                      key={exam.id}
                                      className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group flex flex-col"
                                      onClick={() => navigate(`/open-exam/${exam.id}`)}
                                  >
                                      <CardHeader className="pb-2">
                                          <div className="flex justify-between items-start gap-2">
                                              <div className="space-y-1">
                                                  <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                                      {exam.title}
                                                  </CardTitle>
                                              </div>
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

                          {/* Pagination */}
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
                                       <ChevronLeft className="h-4 w-4" /> Previous
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
                      </div>
                  )}
              </main>
          </div>
      );
  }

  // Browse Mode
  const subjects = getUniqueSubjects();

  // Filter exams by selected subject
  const filteredExams = exams?.filter(exam => {
    if (!selectedSubject) return true;
    if (Array.isArray(exam.subject)) return exam.subject.includes(selectedSubject);
    return exam.subject === selectedSubject;
  }) || [];

  const filteredExamsByChapter = filteredExams.filter(exam => {
      if (!selectedChapter) return true;
      return exam.chapter === selectedChapter;
  });

  // Level 1: Subjects
  if (!selectedSubject) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <PublicHeader />
        <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        {renderHeader()}

        {isLoadingMetadata ? (
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
        </main>
      </div>
    );
  }

  // Level 2: Chapters
  if (!selectedChapter) {
      const chapters = getUniqueChapters();
      const hasChapters = chapters.length > 0;

      if (hasChapters) {
          return (
            <div className="min-h-screen bg-background text-foreground flex flex-col">
                <PublicHeader />
                <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
                <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent" onClick={handleBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects
                </Button>

                <div className="mb-8">
                    <h2 className="text-2xl font-bold tracking-tight text-primary">{selectedSubject}</h2>
                    <p className="text-muted-foreground">Select a chapter.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {chapters.map(chapter => (
                        <Card
                            key={chapter}
                            className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
                            onClick={() => setSelectedChapter(chapter)}
                        >
                            <CardHeader className="pb-2">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                    <Layers className="h-5 w-5 text-primary" />
                                </div>
                                <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">{chapter}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    {filteredExams.filter(e => e.chapter === chapter).length} exams
                                </p>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <div className="text-xs text-primary font-medium flex items-center mt-auto">
                                    View Exams <ChevronRight className="h-3 w-3 ml-1" />
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                    {filteredExams.some(e => !e.chapter) && (
                         <Card
                            className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group border-dashed"
                            onClick={() => setSelectedChapter("General")}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">General / Other</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    {filteredExams.filter(e => !e.chapter).length} exams
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
                </main>
            </div>
          );
      }
  }

  // Level 3: Exam List
  const finalExams = selectedChapter === "General"
      ? filteredExams.filter(e => !e.chapter)
      : selectedChapter
          ? filteredExamsByChapter
          : filteredExams;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
        <PublicHeader />
        <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent" onClick={handleBack}>
             <ArrowLeft className="mr-2 h-4 w-4" /> Back to {selectedChapter ? 'Chapters' : 'Subjects'}
        </Button>

        <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span>{selectedSubject}</span>
                {selectedChapter && (
                    <>
                        <ChevronRight className="h-3 w-3" />
                        <span>{selectedChapter}</span>
                    </>
                )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-primary">Available Exams</h2>
        </div>

        {finalExams.length === 0 ? (
            <div className="text-center py-10">No exams found in this section.</div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {finalExams.map((exam: any) => (
                    <Card
                        key={exam.id}
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group flex flex-col"
                        onClick={() => navigate(`/open-exam/${exam.id}`)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start gap-2">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                        {exam.title}
                                    </CardTitle>
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                    <Badge variant={exam.exam_type === 'live' ? 'destructive' : 'secondary'} className="shrink-0 capitalize">
                                        {exam.exam_type}
                                    </Badge>
                                    {isAdmin && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/admin/exams?editId=${exam.id}`);
                                            }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    )}
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
        </main>
    </div>
  );
};

export default FreeExam;
