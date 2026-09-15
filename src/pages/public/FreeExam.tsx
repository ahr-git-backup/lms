import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ArrowLeft, Trophy, Flame, Layers, Plus, Search, ChevronLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PublicHeader from "@/components/PublicHeader";
import { ExamGrid } from "@/pages/dashboard/Readymade";
import { fetchCached } from "@/lib/cacheProxy";

// Types
interface Exam {
  id: string;
  title: string;
  subject: string[] | string | null;
  chapter: string | null;
  readymade_sub_chapter: string | null;
  exam_type: string;
  duration_minutes: number;
  free_exam_category: string | null;
  is_visible_on_free?: boolean;
  questions_count: { count: number }[];
}

const CATEGORY_LABELS: Record<string, string> = { Onushilon: "Onushiloni" };
const categoryLabel = (cat: string) => CATEGORY_LABELS[cat] || cat;

const PAGE_SIZE = 12;

const FreeExam = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    document.title = "Free Exams – Atlas";
  }, []);

  // State (synced with URL query params so refresh keeps the same drill-down level)
  const [selectedCategory, setSelectedCategoryState] = useState<string | null>(searchParams.get("cat"));
  const [selectedSubject, setSelectedSubjectState] = useState<string | null>(searchParams.get("sub"));
  const [selectedChapter, setSelectedChapterState] = useState<string | null>(searchParams.get("chap"));
  const [selectedSubChapter, setSelectedSubChapterState] = useState<string | null>(searchParams.get("subchap"));

  const updateParams = (next: { cat?: string | null; sub?: string | null; chap?: string | null; subchap?: string | null }) => {
    const params = new URLSearchParams(searchParams);
    const entries: [string, string | null | undefined][] = [
      ["cat", next.cat],
      ["sub", next.sub],
      ["chap", next.chap],
      ["subchap", next.subchap],
    ];
    entries.forEach(([key, value]) => {
      if (value === undefined) return;
      if (value === null) params.delete(key);
      else params.set(key, value);
    });
    setSearchParams(params, { replace: true });
  };

  const setSelectedCategory = (val: string | null) => {
    setSelectedCategoryState(val);
    setSelectedSubjectState(null);
    setSelectedChapterState(null);
    setSelectedSubChapterState(null);
    updateParams({ cat: val, sub: null, chap: null, subchap: null });
  };
  const setSelectedSubject = (val: string | null) => {
    setSelectedSubjectState(val);
    setSelectedChapterState(null);
    setSelectedSubChapterState(null);
    updateParams({ sub: val, chap: null, subchap: null });
  };
  const setSelectedChapter = (val: string | null) => {
    setSelectedChapterState(val);
    setSelectedSubChapterState(null);
    updateParams({ chap: val, subchap: null });
  };
  const setSelectedSubChapter = (val: string | null) => {
    setSelectedSubChapterState(val);
    updateParams({ subchap: val });
  };

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
      return fetchCached("/free-exams-metadata", async () => {
        const { data, error } = await supabase
          .from("exams")
          .select("id, title, subject, chapter, readymade_sub_chapter, exam_type, duration_minutes, free_exam_category, is_visible_on_free, questions_count:exam_questions(count)")
          .eq("is_published", true)
          // @ts-ignore
          .eq("is_visible_on_free", true);

        if (error) throw error;
        return data;
      });
    },
    enabled: !debouncedSearch,
    staleTime: 5 * 60 * 1000, // cache 5 min — this list rarely changes; avoids refetch storms under concurrent traffic
  });

  // Fetch Search Results
  const { data: searchResults, isLoading: isLoadingSearch } = useQuery({
      queryKey: ["public-free-exams-search", debouncedSearch, page],
      queryFn: async () => {
          const query = supabase
              .from("exams")
              .select("id, title, subject, chapter, exam_type, duration_minutes, is_visible_on_free, questions_count:exam_questions(count)", { count: 'exact' })
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

  const OTHER_SUBJECT = "Other";

  // Helper to extract unique subjects (within the selected category)
  const getUniqueSubjects = () => {
    if (!exams) return [];
    const subjects = new Set<string>();
    let hasUnassigned = false;
    exams
      .filter(exam => !selectedCategory || (exam.free_exam_category || "HSC") === selectedCategory)
      .forEach(exam => {
        if (Array.isArray(exam.subject) && exam.subject.length > 0) {
          exam.subject.forEach(s => subjects.add(s));
        } else if (typeof exam.subject === 'string' && exam.subject) {
          subjects.add(exam.subject);
        } else {
          hasUnassigned = true;
        }
      });
    const sorted = Array.from(subjects).sort();
    return hasUnassigned ? [...sorted, OTHER_SUBJECT] : sorted;
  };

  const getUniqueChapters = () => {
      if (!filteredExams) return [];
      const chapters = new Set<string>();
      filteredExams.forEach(exam => {
          if (exam.chapter) chapters.add(exam.chapter);
      });
      return Array.from(chapters).sort();
  };

  const getUniqueSubChapters = () => {
      if (!filteredExamsByChapter) return [];
      const subChapters = new Set<string>();
      filteredExamsByChapter.forEach(exam => {
          if (exam.readymade_sub_chapter) subChapters.add(exam.readymade_sub_chapter);
      });
      return Array.from(subChapters).sort();
  };

  const handleBack = () => {
      if (selectedSubChapter) {
          setSelectedSubChapter(null);
      } else if (selectedChapter) {
          setSelectedChapter(null);
      } else if (selectedSubject) {
          setSelectedSubject(null);
      } else if (selectedCategory) {
          setSelectedCategory(null);
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
                          <ExamGrid
                              exams={results}
                              navigate={navigate}
                              enrolledIds={[]}
                              fullAccessCourseIds={[]}
                              subChapterGrants={new Set()}
                              isAdmin={isAdmin}
                              listPath="/free-exam"
                              examPath="/take-exam"
                          />

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

  // Filter exams by selected category + subject
  const filteredExams = exams?.filter(exam => {
    if (selectedCategory && (exam.free_exam_category || "HSC") !== selectedCategory) return false;
    if (!selectedSubject) return true;
    if (selectedSubject === OTHER_SUBJECT) {
      return !Array.isArray(exam.subject) || exam.subject.length === 0;
    }
    if (Array.isArray(exam.subject)) return exam.subject.includes(selectedSubject);
    return exam.subject === selectedSubject;
  }) || [];

  const filteredExamsByChapter = filteredExams.filter(exam => {
      if (!selectedChapter) return true;
      if (selectedChapter === "General") return !exam.chapter;
      return exam.chapter === selectedChapter;
  });

  const filteredExamsBySubChapter = filteredExamsByChapter.filter(exam => {
      if (!selectedSubChapter) return true;
      if (selectedSubChapter === "General") return !exam.readymade_sub_chapter;
      return exam.readymade_sub_chapter === selectedSubChapter;
  });

  // Level 0: Categories (HSC / Medical / Varsity / Onushilon)
  if (!selectedCategory) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <PublicHeader />
        <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        {renderHeader()}

        {isLoadingMetadata ? (
             <div className="grid grid-cols-2 gap-3 sm:gap-6">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
             </div>
        ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-6">
                {(() => {
                    const PREFERRED_ORDER = ["HSC", "Medical", "Varsity", "Onushilon"];
                    const present = Array.from(new Set((exams || []).map(e => e.free_exam_category || "HSC")));
                    const ordered = [
                        ...PREFERRED_ORDER.filter(c => present.includes(c)),
                        ...present.filter(c => !PREFERRED_ORDER.includes(c)).sort(),
                    ];
                    return ordered;
                })().map(cat => (
                    <Card
                        key={cat}
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
                        onClick={() => setSelectedCategory(cat)}
                    >
                        <CardContent className="px-4 py-6 sm:px-6 sm:py-8 flex flex-col items-center text-center gap-2">
                            <Trophy className="h-10 w-10 sm:h-14 sm:w-14 text-primary group-hover:scale-110 transition-transform" />
                            <div className="text-xl sm:text-3xl font-bold text-primary leading-tight">{categoryLabel(cat)}</div>
                            <p className="text-sm sm:text-base text-muted-foreground">
                                {exams?.filter(e => (e.free_exam_category || "HSC") === cat).length || 0} exams
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

  // Level 1: Subjects
  if (!selectedSubject) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <PublicHeader />
        <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Types
        </Button>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                {subjects.map(subject => (
                    <Card
                        key={subject}
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
                        onClick={() => setSelectedSubject(subject)}
                    >
                        <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Subject</span>
                                <Trophy className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="text-base sm:text-xl font-bold text-primary mb-0.5 leading-tight">{subject}</div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                                {exams?.filter(e => {
                                    if (subject === OTHER_SUBJECT) return !Array.isArray(e.subject) || e.subject.length === 0;
                                    if(Array.isArray(e.subject)) return e.subject.includes(subject);
                                    return e.subject === subject;
                                }).length} exams
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

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                    {chapters.map(chapter => (
                        <Card
                            key={chapter}
                            className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
                            onClick={() => setSelectedChapter(chapter)}
                        >
                            <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Layers className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <span className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">{chapter}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                                        {filteredExams.filter(e => e.chapter === chapter).length} exams
                                    </p>
                                    <ChevronRight className="h-3 w-3 text-primary" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {filteredExams.some(e => !e.chapter) && (
                         <Card
                            className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group border-dashed"
                            onClick={() => setSelectedChapter("General")}
                        >
                            <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
                                <span className="text-sm font-semibold">General / Other</span>
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
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

  // Level 3: Sub-Chapters (topic-wise breakdown within a chapter) — only
  // shown when this chapter actually has any sub-chapter-tagged exams;
  // chapters with no sub-chapters skip straight to the exam list, same as
  // the paid Readymade page's behavior.
  if (!selectedSubChapter) {
      const subChaptersList = getUniqueSubChapters();
      const hasSubChapters = subChaptersList.length > 0;

      if (hasSubChapters) {
          return (
            <div className="min-h-screen bg-background text-foreground flex flex-col">
                <PublicHeader />
                <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
                <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent" onClick={handleBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Chapters
                </Button>

                <div className="mb-8">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <span>{selectedSubject}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span>{selectedChapter}</span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-primary">Select a Topic</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                    {subChaptersList.map(subChapter => (
                        <Card
                            key={subChapter}
                            className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
                            onClick={() => setSelectedSubChapter(subChapter)}
                        >
                            <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Layers className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <span className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">{subChapter}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                                        {filteredExamsByChapter.filter(e => e.readymade_sub_chapter === subChapter).length} exams
                                    </p>
                                    <ChevronRight className="h-3 w-3 text-primary" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {filteredExamsByChapter.some(e => !e.readymade_sub_chapter) && (
                         <Card
                            className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group border-dashed"
                            onClick={() => setSelectedSubChapter("General")}
                        >
                            <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
                                <span className="text-sm font-semibold">General / Other</span>
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                    {filteredExamsByChapter.filter(e => !e.readymade_sub_chapter).length} exams
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

  // Level 4: Exam List
  const finalExams = selectedSubChapter
      ? filteredExamsBySubChapter
      : selectedChapter
          ? filteredExamsByChapter
          : filteredExams;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
        <PublicHeader />
        <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent" onClick={handleBack}>
             <ArrowLeft className="mr-2 h-4 w-4" /> Back to {selectedSubChapter ? 'Topics' : selectedChapter ? 'Chapters' : 'Subjects'}
        </Button>

        <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span>{selectedCategory ? categoryLabel(selectedCategory) : ""}</span>
                <ChevronRight className="h-3 w-3" />
                <span>{selectedSubject}</span>
                {selectedChapter && (
                    <>
                        <ChevronRight className="h-3 w-3" />
                        <span>{selectedChapter}</span>
                    </>
                )}
                {selectedSubChapter && (
                    <>
                        <ChevronRight className="h-3 w-3" />
                        <span>{selectedSubChapter}</span>
                    </>
                )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-primary">Available Exams</h2>
        </div>

        {finalExams.length === 0 ? (
            <div className="text-center py-10">No exams found in this section.</div>
        ) : (
            <ExamGrid
                exams={finalExams}
                navigate={navigate}
                enrolledIds={[]}
                fullAccessCourseIds={[]}
                subChapterGrants={new Set()}
                isAdmin={isAdmin}
                listPath="/free-exam"
                examPath="/take-exam"
            />
        )}
        </main>
    </div>
  );
};

export default FreeExam;
