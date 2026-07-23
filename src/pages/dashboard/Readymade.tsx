import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trophy, Clock, CheckCircle, ChevronRight, Search, ChevronLeft, LayoutTemplate, X } from "lucide-react";
import { useNavigate, useNavigationType } from "react-router-dom";
import { setExamSourceList } from "@/lib/examSourceTracker";
import { useAuth } from "@/contexts/AuthContext";
import { CourseItemsManagerDialog } from "@/components/admin/CourseItemsManagerDialog";
import { ChapterSortDialog } from "@/components/admin/ChapterSortDialog";
import { SubjectSortDialog } from "@/components/admin/SubjectSortDialog";

const PAGE_SIZE = 15;

// Supabase/PostgREST caps a plain select() at 1000 rows. For aggregation queries
// (distinct subjects/chapters/topics) that must see every row, paginate through
// all of them instead — otherwise later categories silently disappear.
async function fetchAllRows<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  const BATCH = 1000;
  let from = 0;
  let all: T[] = [];
  while (true) {
    const { data, error } = await buildQuery(from, from + BATCH - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < BATCH) break;
    from += BATCH;
  }
  return all;
}

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
  const [currentSubjectsList, setCurrentSubjectsList] = useState<string[]>([]);
  const [manageSubjects, setManageSubjects] = useState(false);
  const { data: enrollments } = useEnrollments();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const navigationType = useNavigationType(); // "POP" = browser back/forward, "PUSH"/"REPLACE" = normal link click

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedParentTopics, setSelectedParentTopics] = useState<string[]>([]);

  const { data: parentTopics } = useQuery({
    queryKey: ["readymade-parent-topics", enrollments?.map((e: any) => e.course_id).join(',')],
    queryFn: async () => {
      const enrolledIds = enrollments?.map((e: any) => e.course_id) || [];
      const filter = buildEnrollmentFilter(enrolledIds);
      const data = await fetchAllRows<{ readymade_topic: string | null }>((from, to) => {
        let query = supabase
          .from("exams")
          .select("readymade_topic")
          .eq("is_readymade", true)
          .eq("is_published", true)
          .not("readymade_topic", "is", null)
          .range(from, to);
        if (filter) query = query.or(filter);
        else query = query.eq("is_visible_on_free", true);
        return query;
      });
      const unique = new Set<string>();
      data.forEach(row => { if (row.readymade_topic) unique.add(row.readymade_topic); });
      return Array.from(unique).sort().map(topic => ({ label: topic, value: topic }));
    }
  });

  const READYMADE_STATE_KEY = "atlas_readymade_nav_state_v1";
  const hasRestoredRef = useState(() => ({ restored: false }))[0];

  // Restore drill-down state (subject/chapter/subchapter/search/page) on mount,
  // so navigating away to take an exam and coming back (via result page's Back
  // button) lands the user exactly where they left off instead of the top-level list.
  useEffect(() => {
    // Only restore saved drill-down (subject/chapter) state when the user
    // arrived here via browser Back (e.g. from an exam/result page). A fresh
    // click from the sidebar or dashboard should always show the main
    // Readymade landing page, not wherever the user previously drilled into.
    if (navigationType !== "POP") {
      try { sessionStorage.removeItem(READYMADE_STATE_KEY); } catch { /* ignore */ }
      hasRestoredRef.restored = true;
      return;
    }
    try {
      const saved = sessionStorage.getItem(READYMADE_STATE_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.selectedSubject) setSelectedSubject(s.selectedSubject);
        if (s.selectedChapter) setSelectedChapter(s.selectedChapter);
        if (s.selectedSubChapter) setSelectedSubChapter(s.selectedSubChapter);
        if (s.searchQuery) { setSearchQuery(s.searchQuery); setDebouncedSearch(s.searchQuery); setIsSearchExpanded(true); }
        if (typeof s.page === "number") setPage(s.page);
        if (Array.isArray(s.selectedParentTopics)) setSelectedParentTopics(s.selectedParentTopics);
      }
    } catch { /* ignore */ }
    hasRestoredRef.restored = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save state on every change so it's ready if the user navigates to take-exam and back.
  // Skipped until the restore-effect above has run, so the initial (empty) state doesn't
  // overwrite a previously saved state in sessionStorage on the very first mount.
  useEffect(() => {
    if (!hasRestoredRef.restored) return;
    try {
      sessionStorage.setItem(READYMADE_STATE_KEY, JSON.stringify({
        selectedSubject, selectedChapter, selectedSubChapter, searchQuery, page, selectedParentTopics,
      }));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedChapter, selectedSubChapter, searchQuery, page, selectedParentTopics]);

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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Readymade Exam</h1>
        <div className="relative shrink-0">
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

      {!selectedSubject && parentTopics && parentTopics.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
          <Button
            variant={selectedParentTopics.length === 0 ? "default" : "secondary"}
            size="sm"
            className="rounded-full shadow-sm text-[11px] sm:text-xs min-h-7 sm:min-h-8 h-auto px-2 py-1 hover:scale-105 transition-transform whitespace-normal text-center leading-tight"
            onClick={() => { setPage(0); setSelectedParentTopics([]); }}
          >
            All
          </Button>
          {parentTopics.map(topic => (
            <Button
              key={topic.value}
              variant={selectedParentTopics.includes(topic.value) ? "default" : "secondary"}
              size="sm"
              className="rounded-full shadow-sm text-[11px] sm:text-xs min-h-7 sm:min-h-8 h-auto px-2 py-1 hover:scale-105 transition-transform whitespace-normal text-center leading-tight"
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
      )}

      {isAdmin && !selectedSubject && currentSubjectsList.length > 0 && (
        <div className="flex gap-2 bg-muted/30 p-2 rounded-lg border">
          <div className="text-xs font-medium mr-auto self-center">Admin:</div>
          <Button variant="outline" size="sm" onClick={() => setManageSubjects(true)}>Manage Subject Position</Button>
        </div>
      )}

      {isAdmin && selectedChapter && (
        <div className="flex gap-2 bg-muted/30 p-2 rounded-lg border">
          <div className="text-xs font-medium mr-auto self-center">Admin:</div>
          <Button variant="outline" size="sm" onClick={() => setManageType("exams")}>
            {selectedSubChapter ? `Manage ${selectedSubChapter} Exams Order` : "Manage All Exams Order"}
          </Button>
        </div>
      )}

      {isAdmin && !selectedChapter && selectedSubject && currentChaptersList.length > 0 && (
        <div className="flex gap-2 bg-muted/30 p-2 rounded-lg border">
          <div className="text-xs font-medium mr-auto self-center">Admin:</div>
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
      ) : manageSubjects ? (
        <SubjectSortDialog
          subjects={currentSubjectsList}
          onClose={() => setManageSubjects(false)}
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
          setCurrentSubjectsList={setCurrentSubjectsList}
        />
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReadymadeExamView = ({ enrollments, selectedSubject, setSelectedSubject, selectedChapter, setSelectedChapter, selectedSubChapter, setSelectedSubChapter, navigate, searchQuery, page, setPage, selectedParentTopics, setCurrentChaptersList, setCurrentSubjectsList }: any) => {

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
      const data = await fetchAllRows<{ subject: any; course_id: string | null; shared_course_ids: string[] | null }>((from, to) => {
        let query = supabase.from("exams").select("subject, course_id, shared_course_ids")
          .eq("is_readymade", true).eq("is_published", true).range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
        return applyAccessFilter(query);
      });
      const unique = new Set<string>();
      data.forEach((row: any) => {
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
      const data = await fetchAllRows<{ chapter: string | null; course_id: string | null; shared_course_ids: string[] | null; sort_order: number | null }>((from, to) => {
        let query = supabase.from("exams").select("chapter, course_id, shared_course_ids, sort_order")
          .eq("is_readymade", true).eq("is_published", true).contains("subject", [selectedSubject]).range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
        return applyAccessFilter(query);
      });
      const unique = new Set<string>(); const orderMap = new Map<string, number>();
      const settingsKey = `chapter_order_global_${selectedSubject}`;
      const { data: sd } = await supabase.from("app_settings").select("value").eq("key", settingsKey).maybeSingle();
      const savedOrder: string[] = sd?.value ? (sd.value as string[]) : [];
      data.forEach((row: any) => {
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
  useEffect(() => { if (subjects) setCurrentSubjectsList(subjects); }, [subjects, setCurrentSubjectsList]);

  // --- LEVEL 3: SUB-CHAPTERS (readymade_sub_chapter) ---
  const { data: subChapters, isLoading: loadingSubChapters } = useQuery({
    queryKey: ["readymade-exams-subchapters", selectedSubject, selectedChapter, enrolledIds.join(','), selectedParentTopics],
    queryFn: async () => {
      if (!selectedSubject || !selectedChapter) return [];
      const data = await fetchAllRows<{ readymade_sub_chapter: string | null }>((from, to) => {
        let query = supabase.from("exams")
          .select("readymade_sub_chapter")
          .eq("is_readymade", true).eq("is_published", true)
          .contains("subject", [selectedSubject]).eq("chapter", selectedChapter)
          .not("readymade_sub_chapter", "is", null)
          .range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
        return applyAccessFilter(query);
      });
      const unique = new Set<string>();
      data.forEach((row: any) => { if (row.readymade_sub_chapter) unique.add(row.readymade_sub_chapter); });
      return Array.from(unique).sort();
    },
    enabled: !!selectedSubject && !!selectedChapter && !selectedSubChapter && !searchQuery
  });

  // --- LEVEL 4: EXAMS (filtered by sub-chapter if present, else no sub-chapter filter) ---
  // No .range() here on purpose — user wants every exam in the chapter/session
  // visible on a single page, no "Next page" pagination for this level.
  const { data: examsData, isLoading: loadingExams } = useQuery({
    queryKey: ["readymade-exams-list", selectedSubject, selectedChapter, selectedSubChapter, enrolledIds.join(','), selectedParentTopics],
    queryFn: async () => {
      if (!selectedSubject || !selectedChapter) return { data: [], count: 0 };
      let query = supabase.from("exams")
        .select("*, course:courses(name), questions_count:exam_questions(count)", { count: 'exact' })
        .eq("is_readymade", true).eq("is_published", true)
        .contains("subject", [selectedSubject]).eq("chapter", selectedChapter)
        .order("sort_order", { ascending: false }).order("created_at", { ascending: false });
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
    return <div className="space-y-3"><ExamGrid exams={exams} navigate={navigate} /><PaginationControls page={page} setPage={setPage} totalPages={totalPages} /></div>;
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        {subjects.map(subject => (
          <Card key={subject} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedSubject(subject)}>
            <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Subject</span>
                <Trophy className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="text-base sm:text-xl font-bold text-primary leading-tight">{subject}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // LEVEL 2: Chapter selection
  if (!selectedChapter) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedSubject(null)} className="pl-0 h-8"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects</Button>
        <h2 className="text-base font-bold">{selectedSubject}</h2>
        {loadingChapters ? <div className="text-muted-foreground">Loading chapters...</div>
          : !chapters || chapters.length === 0 ? <div className="text-muted-foreground">No chapters found for this subject.</div>
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
              {chapters.map(chapter => (
                <Card key={chapter} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedChapter(chapter)}>
                  <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
                    <div className="text-sm sm:text-base font-semibold leading-tight">{chapter}</div>
                    <div className="text-[10px] sm:text-xs text-primary font-medium mt-1 flex items-center">View Exams <ChevronRight className="h-3 w-3 ml-1" /></div>
                  </CardContent>
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
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedChapter(null)} className="pl-0 h-8"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Chapters</Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{selectedSubject}</span><ChevronRight className="h-3 w-3" /><span>{selectedChapter}</span>
        </div>
        <h2 className="text-base font-bold">Select Session / Year</h2>
        {loadingSubChapters ? <div className="text-muted-foreground">Loading sessions...</div> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            {subChapters.map(sc => (
              <Card key={sc} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedSubChapter(sc)}>
                <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
                  <div className="text-sm sm:text-base font-semibold leading-tight">{sc}</div>
                  <div className="text-[10px] sm:text-xs text-primary font-medium mt-1 flex items-center">View Exams <ChevronRight className="h-3 w-3 ml-1" /></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // LEVEL 4: Exams list — all exams shown on a single page, no pagination
  const exams = examsData?.data || [];

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => {
        if (selectedSubChapter && subChapters && subChapters.length > 0) setSelectedSubChapter(null);
        else setSelectedChapter(null);
      }} className="pl-0 h-8">
        <ArrowLeft className="mr-2 h-4 w-4" /> {selectedSubChapter ? "Back to Sessions" : "Back to Chapters"}
      </Button>
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>{selectedSubject}</span>
          <ChevronRight className="h-3 w-3" />
          <span>{selectedChapter}</span>
          {selectedSubChapter && <><ChevronRight className="h-3 w-3" /><span>{selectedSubChapter}</span></>}
        </div>
        <h2 className="text-base font-bold mt-0.5">Available Readymade Exams</h2>
      </div>

      {loadingExams ? (
        <div className="text-muted-foreground">Loading exams...</div>
      ) : !exams || exams.length === 0 ? (
        <div className="text-muted-foreground">No exams found.</div>
      ) : (
        <ExamGrid exams={exams} navigate={navigate} />
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ExamGrid = ({ exams, navigate }: { exams: any[], navigate: any }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
    {exams.map((exam) => (
      <Card key={exam.id} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
        onClick={() => { setExamSourceList(exam.id, "/dashboard/readymade"); navigate(`/dashboard/take-exam/${exam.id}`); }}>
        <CardContent className="px-4 py-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">{exam.course?.name || "Public"}</p>
            <p className="text-sm font-bold leading-tight group-hover:text-primary transition-colors">{exam.title}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
              <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /><span>{exam.duration_minutes} min</span></div>
              <div className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /><span>{exam.questions_count?.[0]?.count || 0} Q</span></div>
              <Badge variant="outline" className="text-blue-500 border-blue-200 text-[10px] px-1.5 py-0">Readymade</Badge>
            </div>
          </div>
          <Button size="sm" className="shrink-0 group-hover:bg-primary/90">Start</Button>
        </CardContent>
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
