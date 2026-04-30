import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trophy, Clock, CheckCircle, ChevronRight, Search, ChevronLeft, LayoutTemplate, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CourseItemsManagerDialog } from "@/components/admin/CourseItemsManagerDialog";
import { ChapterSortDialog } from "@/components/admin/ChapterSortDialog";

const PAGE_SIZE = 15;

// Helper: build the enrollment filter OR clause
const buildEnrollmentFilter = (enrolledIds: string[]) => {
  if (enrolledIds.length === 0) return "is_visible_on_free.eq.true";
  return `course_id.in.(${enrolledIds.join(',')}),shared_course_ids.ov.{${enrolledIds.join(',')}},readymade_course_ids.ov.{${enrolledIds.join(',')}},is_visible_on_free.eq.true`;
};

const Readymade = () => {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedSubChapter, setSelectedSubChapter] = useState<string | null>(null);
  const [manageType, setManageType] = useState<"classes" | "exams" | null>(null);
  const [manageChapters, setManageChapters] = useState(false);
  const [currentChaptersList, setCurrentChaptersList] = useState<string[]>([]);
  const { data: enrollments } = useEnrollments();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedParentTopics, setSelectedParentTopics] = useState<string[]>([]);

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
      const filter = buildEnrollmentFilter(enrolledIds);
      if (filter) query = query.or(filter);
      else query = query.eq("is_visible_on_free", true);
      const { data } = await query;
      const unique = new Set<string>();
      data?.forEach(row => { if (row.readymade_topic) unique.add(row.readymade_topic); });
      return Array.from(unique).sort().map(topic => ({ label: topic, value: topic }));
    }
  });

  useEffect(() => { document.title = "Readymade – Atlas"; }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery) setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const resetToSubject = () => { setSelectedChapter(null); setSelectedSubChapter(null); };
  const resetToChapter = () => { setSelectedSubChapter(null); };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Readymade Exam</h1>
        <p className="text-sm text-muted-foreground">Pre-configured practice exams for your courses.</p>
      </header>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {!selectedSubject && parentTopics?.map(topic => (
            <Button
              key={topic.value}
              variant={selectedParentTopics.includes(topic.value) ? "default" : "secondary"}
              size="sm"
              className="rounded-full shadow-sm text-xs h-8 hover:scale-105 transition-transform whitespace-nowrap"
              onClick={() => {
                setPage(0);
                setSelectedParentTopics(prev =>
                  prev.includes(topic.value) ? prev.filter(t => t !== topic.value) : [...prev, topic.value]
                );
              }}
            >
              {topic.label}
            </Button>
          ))}
        </div>
        <div className="relative shrink-0 flex items-center justify-end">
          {isSearchExpanded ? (
            <div className="flex items-center w-[180px] sm:w-64 relative animate-in fade-in zoom-in duration-200">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="absolute right-0 h-9 w-9"
                onClick={() => { setSearchQuery(""); setIsSearchExpanded(false); }}>
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

      {isAdmin && selectedChapter && (
        <div className="flex gap-2 mb-4 bg-muted/30 p-3 rounded-lg border">
          <div className="text-sm font-medium mr-auto self-center">Admin Controls:</div>
          <Button variant="outline" size="sm" onClick={() => setManageType("exams")}>
            {selectedSubChapter ? `Manage ${selectedSubChapter} Exams Order` : "Manage All Exams Order"}
          </Button>
        </div>
      )}

      {isAdmin && !selectedChapter && selectedSubject && currentChaptersList.length > 0 && (
        <div className="flex gap-2 mb-4 bg-muted/30 p-3 rounded-lg border">
          <div className="text-sm font-medium mr-auto self-center">Admin Controls:</div>
          <Button variant="outline" size="sm" onClick={() => setManageChapters(true)}>Manage Chapters Order</Button>
        </div>
      )}

      {manageType ? (
        <CourseItemsManagerDialog
          courseId={enrollments?.[0]?.course_id}
          courseName="Readymade Exams"
          subjectFilter={selectedSubject}
          chapterFilter={selectedChapter}
          subChapterFilter={selectedSubChapter}
          resourceType={manageType}
          onClose={() => setManageType(null)}
        />
      ) : manageChapters && selectedSubject ? (
        <ChapterSortDialog
          courseId={enrollments?.[0]?.course_id || null}
          subject={selectedSubject}
          chapters={currentChaptersList}
          contextName="Readymade Exams"
          onClose={() => setManageChapters(false)}
        />
      ) : (
        <ReadymadeExamView
          enrollments={enrollments}
          selectedSubject={selectedSubject}
          setSelectedSubject={(s: string | null) => { setSelectedSubject(s); resetToSubject(); }}
          selectedChapter={selectedChapter}
          setSelectedChapter={(c: string | null) => { setSelectedChapter(c); resetToChapter(); }}
          selectedSubChapter={selectedSubChapter}
          setSelectedSubChapter={setSelectedSubChapter}
          navigate={navigate}
          searchQuery={debouncedSearch}
          page={page}
          setPage={setPage}
          selectedParentTopics={selectedParentTopics}
          setCurrentChaptersList={setCurrentChaptersList}
        />
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReadymadeExamView = ({ enrollments, selectedSubject, setSelectedSubject, selectedChapter, setSelectedChapter, selectedSubChapter, setSelectedSubChapter, navigate, searchQuery, page, setPage, selectedParentTopics, setCurrentChaptersList }: any) => {

  const enrolledIds: string[] = enrollments?.map((e: any) => e.course_id) || [];
  const filterOrClause = buildEnrollmentFilter(enrolledIds);

  const applyAccessFilter = (query: any) => {
    if (filterOrClause) return query.or(filterOrClause);
    return query.eq("is_visible_on_free", true);
  };

  // --- SEARCH ---
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["readymade-exams-search", enrolledIds.join(','), searchQuery, page, selectedParentTopics],
    queryFn: async () => {
      const safeQuery = searchQuery.replace(/[^\w\s\u0980-\u09FF]/g, "").trim();
      if (!safeQuery) return { data: [], count: 0 };
      let query = supabase
        .from("exams")
        .select("*, course:courses(name), questions_count:exam_questions(count)", { count: 'exact' })
        .eq("is_readymade", true).eq("is_published", true)
        .ilike("title", `%${safeQuery}%`)
        .order("sort_order", { ascending: false }).order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      query = applyAccessFilter(query);
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!searchQuery
  });

  // --- LEVEL 1: SUBJECTS ---
  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ["readymade-exams-subjects", enrolledIds.join(','), selectedParentTopics],
    queryFn: async () => {
      let query = supabase.from("exams").select("subject, course_id, shared_course_ids")
        .eq("is_readymade", true).eq("is_published", true);
      if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      query = applyAccessFilter(query);
      const { data } = await query;
      const unique = new Set<string>();
      data?.forEach((row: any) => {
        if (Array.isArray(row.subject)) row.subject.forEach((s: string) => unique.add(s));
        else if (typeof row.subject === 'string') unique.add(row.subject);
      });
      const { data: settingsData } = await supabase.from("app_settings").select("value").eq("key", "subject_order_global").maybeSingle();
      const savedOrder: string[] = settingsData?.value ? (settingsData.value as string[]) : [];
      return Array.from(unique).sort((a, b) => {
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        return a.localeCompare(b);
      });
    },
    enabled: !selectedSubject && !searchQuery
  });

  // --- LEVEL 2: CHAPTERS ---
  const { data: chapters, isLoading: loadingChapters } = useQuery({
    queryKey: ["readymade-exams-chapters", selectedSubject, enrolledIds.join(','), selectedParentTopics],
    queryFn: async () => {
      if (!selectedSubject) return [];
      let query = supabase.from("exams").select("chapter, course_id, shared_course_ids, sort_order")
        .eq("is_readymade", true).eq("is_published", true).contains("subject", [selectedSubject]);
      if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      query = applyAccessFilter(query);
      const { data } = await query;
      const unique = new Set<string>(); const orderMap = new Map<string, number>();
      const settingsKey = `chapter_order_global_${selectedSubject}`;
      const { data: sd } = await supabase.from("app_settings").select("value").eq("key", settingsKey).maybeSingle();
      const savedOrder: string[] = sd?.value ? (sd.value as string[]) : [];
      data?.forEach((row: any) => {
        if (row.chapter) {
          unique.add(row.chapter);
          const cur = orderMap.get(row.chapter) || 0;
          if ((row.sort_order || 0) > cur) orderMap.set(row.chapter, row.sort_order || 0);
        }
      });
      return Array.from(unique).sort((a, b) => {
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        const oA = orderMap.get(a) || 0, oB = orderMap.get(b) || 0;
        if (oA !== oB) return oB - oA;
        return a.localeCompare(b);
      });
    },
    enabled: !!selectedSubject && !selectedChapter && !searchQuery
  });

  useEffect(() => { if (chapters) setCurrentChaptersList(chapters); }, [chapters, setCurrentChaptersList]);

  // --- LEVEL 3: SUB-CHAPTERS (readymade_sub_chapter) ---
  const { data: subChapters, isLoading: loadingSubChapters } = useQuery({
    queryKey: ["readymade-exams-subchapters", selectedSubject, selectedChapter, enrolledIds.join(','), selectedParentTopics],
    queryFn: async () => {
      if (!selectedSubject || !selectedChapter) return [];
      let query = supabase.from("exams")
        .select("readymade_sub_chapter")
        .eq("is_readymade", true).eq("is_published", true)
        .contains("subject", [selectedSubject]).eq("chapter", selectedChapter)
        .not("readymade_sub_chapter", "is", null);
      if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      query = applyAccessFilter(query);
      const { data } = await query;
      const unique = new Set<string>();
      data?.forEach((row: any) => { if (row.readymade_sub_chapter) unique.add(row.readymade_sub_chapter); });
      return Array.from(unique).sort();
    },
    enabled: !!selectedSubject && !!selectedChapter && !selectedSubChapter && !searchQuery
  });

  // --- LEVEL 4: EXAMS (filtered by sub-chapter if present, else no sub-chapter filter) ---
  const { data: examsData, isLoading: loadingExams } = useQuery({
    queryKey: ["readymade-exams-list", selectedSubject, selectedChapter, selectedSubChapter, page, enrolledIds.join(','), selectedParentTopics],
    queryFn: async () => {
      if (!selectedSubject || !selectedChapter) return { data: [], count: 0 };
      let query = supabase.from("exams")
        .select("*, course:courses(name), questions_count:exam_questions(count)", { count: 'exact' })
        .eq("is_readymade", true).eq("is_published", true)
        .contains("subject", [selectedSubject]).eq("chapter", selectedChapter)
        .order("sort_order", { ascending: false }).order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      // If subChapters exist for this chapter, only show exams for the selected sub-chapter
      if (selectedSubChapter) query = query.eq("readymade_sub_chapter", selectedSubChapter);
      query = applyAccessFilter(query);
      const { data, count, error } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!selectedSubject && !!selectedChapter && (!!selectedSubChapter || subChapters?.length === 0) && !searchQuery
  });

  // ---- RENDER ----
  if (searchQuery) {
    if (searching) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>;
    const exams = searchResults?.data || [];
    const count = searchResults?.count || 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);
    if (exams.length === 0) return <div className="text-center py-12 text-muted-foreground">No readymade exams found matching "{searchQuery}".</div>;
    return <div className="space-y-6"><ExamGrid exams={exams} navigate={navigate} /><PaginationControls page={page} setPage={setPage} totalPages={totalPages} /></div>;
  }

  // LEVEL 1: Subject selection
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
            <CardContent><div className="text-xl font-bold text-primary">{subject}</div></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // LEVEL 2: Chapter selection
  if (!selectedChapter) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedSubject(null)} className="pl-0"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects</Button>
        <h2 className="text-xl font-bold">{selectedSubject}</h2>
        {loadingChapters ? <div className="text-muted-foreground">Loading chapters...</div>
          : !chapters || chapters.length === 0 ? <div className="text-muted-foreground">No chapters found for this subject.</div>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {chapters.map(chapter => (
                <Card key={chapter} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedChapter(chapter)}>
                  <CardHeader className="pb-2"><CardTitle className="text-lg">{chapter}</CardTitle></CardHeader>
                  <CardFooter className="pt-0 text-xs text-primary font-medium">View Exams <ChevronRight className="h-3 w-3 ml-1" /></CardFooter>
                </Card>
              ))}
            </div>
          )}
      </div>
    );
  }

  // LEVEL 3: Sub-chapter (session) selection — only shown if sub-chapters exist
  if (!selectedSubChapter && subChapters && subChapters.length > 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedChapter(null)} className="pl-0"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Chapters</Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{selectedSubject}</span><ChevronRight className="h-3 w-3" /><span>{selectedChapter}</span>
        </div>
        <h2 className="text-xl font-bold">Select Session / Year</h2>
        {loadingSubChapters ? <div className="text-muted-foreground">Loading sessions...</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {subChapters.map(sc => (
              <Card key={sc} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedSubChapter(sc)}>
                <CardHeader className="pb-2"><CardTitle className="text-lg">{sc}</CardTitle></CardHeader>
                <CardFooter className="pt-0 text-xs text-primary font-medium">View Exams <ChevronRight className="h-3 w-3 ml-1" /></CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // LEVEL 4: Exams list
  const exams = examsData?.data || [];
  const totalCount = examsData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => {
        if (selectedSubChapter && subChapters && subChapters.length > 0) setSelectedSubChapter(null);
        else setSelectedChapter(null);
      }} className="pl-0">
        <ArrowLeft className="mr-2 h-4 w-4" /> {selectedSubChapter ? "Back to Sessions" : "Back to Chapters"}
      </Button>
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>{selectedSubject}</span>
          <ChevronRight className="h-3 w-3" />
          <span>{selectedChapter}</span>
          {selectedSubChapter && <><ChevronRight className="h-3 w-3" /><span>{selectedSubChapter}</span></>}
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
      <Card key={exam.id} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group flex flex-col"
        onClick={() => navigate(`/dashboard/take-exam/${exam.id}`)}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1">
              <p className="text-xs font-mono uppercase text-muted-foreground">{exam.course?.name || "Public"}</p>
              <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">{exam.title}</CardTitle>
            </div>
            <Badge variant="outline" className="shrink-0 text-blue-500 border-blue-200">Readymade</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="grid grid-cols-2 gap-y-2 text-sm text-muted-foreground mt-2">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4" /><span>{exam.duration_minutes} min</span></div>
            <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /><span>{exam.questions_count?.[0]?.count || 0} Questions</span></div>
          </div>
        </CardContent>
        <CardFooter className="pt-0 mt-auto border-t pt-4">
          <Button className="w-full group-hover:bg-primary/90">Start Exam</Button>
        </CardFooter>
      </Card>
    ))}
  </div>
);

const PaginationControls = ({ page, setPage, totalPages }: { page: number, setPage: (p: number) => void, totalPages: number }) => (
  <div className="flex items-center justify-between pt-4">
    <div className="text-xs text-muted-foreground">Page {page + 1} of {totalPages || 1}</div>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
        <ChevronLeft className="h-4 w-4" /> Previous
      </Button>
      <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>
        Next <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

export default Readymade;
