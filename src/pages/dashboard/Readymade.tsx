import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trophy, Clock, CheckCircle, ChevronRight, Search, ChevronLeft, LayoutTemplate, X, Lock, Sparkles, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openSolvePdf } from "@/lib/solvePdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

// Determine whether a given exam is accessible to the current user (same rule as
// buildEnrollmentFilter, evaluated client-side so we can render ALL exams and just
// lock the ones the user doesn't have access to, instead of hiding them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isExamUnlocked = (exam: any, enrolledIds: string[]): boolean => {
  if (exam.is_visible_on_free) return true;
  if (enrolledIds.length === 0) return false;
  if (exam.course_id && enrolledIds.includes(exam.course_id)) return true;
  if (Array.isArray(exam.shared_course_ids) && exam.shared_course_ids.some((id: string) => enrolledIds.includes(id))) return true;
  if (Array.isArray(exam.readymade_course_ids) && exam.readymade_course_ids.some((id: string) => enrolledIds.includes(id))) return true;
  return false;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PremiumLockDialog = ({ exam, onClose, navigate }: { exam: any; onClose: () => void; navigate: any }) => {
  const courseId = exam?.course_id;
  return (
    <Dialog open={!!exam} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-center">Premium Exam — লক করা আছে</DialogTitle>
          <DialogDescription className="text-center">
            এই exam-টি দেখতে হলে আপনাকে পেইড ব্যাচে ভর্তি হতে হবে।
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-sm space-y-1.5">
          <p className="font-semibold text-amber-700 dark:text-amber-400">ভর্তি হলে যা যা পাবেন:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>সব Premium Readymade Exam আনলিমিটেড অ্যাক্সেস</li>
            <li>বিস্তারিত সমাধান ও ব্যাখ্যা</li>
            <li>লাইভ ক্লাস ও প্রিমিয়াম সাপোর্ট</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2 mt-1">
          {courseId && (
            <Button className="w-full" onClick={() => { onClose(); navigate(`/courses/${courseId}/buy`); }}>
              কোর্সে ভর্তি হোন
            </Button>
          )}
          <a href="https://wa.me/8801999681290" target="_blank" rel="noopener noreferrer" className="w-full">
            <Button variant="outline" className="w-full gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.87 11.87L4 20l4.24-1.11a7.9 7.9 0 0 0 3.8.97h.01A7.94 7.94 0 0 0 20 12a7.85 7.85 0 0 0-2.4-5.68Zm-5.55 12.2a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.66.67-2.44-.16-.25a6.58 6.58 0 0 1 5.6-10.11 6.53 6.53 0 0 1 4.63 1.92 6.53 6.53 0 0 1 1.92 4.63 6.6 6.6 0 0 1-6.56 6.55Zm3.6-4.9c-.2-.1-1.16-.57-1.34-.64-.18-.07-.31-.1-.44.1-.13.2-.5.63-.62.76-.11.13-.23.14-.42.05a5.4 5.4 0 0 1-1.6-.98 5.98 5.98 0 0 1-1.1-1.37c-.12-.2 0-.3.09-.4.1-.1.2-.24.3-.36.1-.12.13-.2.2-.34.07-.13.03-.25-.02-.35-.05-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.34h-.38c-.13 0-.35.05-.53.25-.18.2-.7.68-.7 1.66s.72 1.92.82 2.06c.1.13 1.4 2.15 3.4 3.01.48.2.85.33 1.14.42.48.15.91.13 1.26.08.38-.06 1.16-.47 1.33-.93.16-.46.16-.85.11-.93-.05-.08-.18-.13-.38-.23Z"/></svg>
              WhatsApp-এ যোগাযোগ করুন
            </Button>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
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
  const { data: enrollments, isLoading: loadingEnrollments } = useEnrollments();
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const navigationType = useNavigationType(); // "POP" = browser back/forward, "PUSH"/"REPLACE" = normal link click

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedParentTopics, setSelectedParentTopics] = useState<string[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lockedExam, setLockedExam] = useState<any | null>(null);

  const { data: boards } = useQuery({
    queryKey: ["readymade-boards", enrollments?.map((e: any) => e.course_id).join(','), selectedParentTopics],
    queryFn: async () => {
      const enrolledIds = enrollments?.map((e: any) => e.course_id) || [];
      const filter = buildEnrollmentFilter(enrolledIds);
      const data = await fetchAllRows<{ readymade_category: string | null }>((from, to) => {
        let query = supabase
          .from("exams")
          .select("readymade_category")
          .eq("is_readymade", true)
          .eq("is_published", true)
          .not("readymade_category", "is", null)
          .range(from, to);
        if (selectedParentTopics.length > 0) query = query.in("readymade_topic", selectedParentTopics);
        if (filter) query = query.or(filter);
        else query = query.eq("is_visible_on_free", true);
        return query;
      });
      const unique = new Set<string>();
      data.forEach(row => { if (row.readymade_category) unique.add(row.readymade_category); });
      return Array.from(unique).sort().map(b => ({ label: b, value: b }));
    }
  });

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
        if (Array.isArray(s.selectedBoards)) setSelectedBoards(s.selectedBoards);
        if (Array.isArray(s.selectedBoards)) setSelectedBoards(s.selectedBoards);
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
        selectedSubject, selectedChapter, selectedSubChapter, searchQuery, page, selectedParentTopics, selectedBoards,
      }));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedChapter, selectedSubChapter, searchQuery, page, selectedParentTopics, selectedBoards]);

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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
          <Button
            variant={selectedParentTopics.length === 0 ? "default" : "secondary"}
            size="sm"
            className="rounded-full shadow-sm text-[11px] sm:text-xs min-h-7 sm:min-h-8 h-auto px-2 py-1 hover:scale-105 transition-transform whitespace-normal text-center leading-tight"
            onClick={() => { setPage(0); setSelectedParentTopics([]); setSelectedBoards([]); }}
          >
            All
          </Button>
          {parentTopics.map(topic => (
            <Button
              key={topic.value}
              variant={selectedParentTopics.includes(topic.value) ? "default" : "secondary"}
              size="sm"
              className="rounded-full shadow-sm text-[11px] sm:text-xs h-auto min-h-7 sm:min-h-8 py-1 px-2 hover:scale-105 transition-transform leading-tight whitespace-normal text-center"
              onClick={() => {
                setPage(0);
                setSelectedBoards([]);
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

      {/* Board/category filter row intentionally hidden — only Parent Topic pills shown above */}

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
          selectedBoards={selectedBoards}
          setCurrentChaptersList={setCurrentChaptersList}
          setCurrentSubjectsList={setCurrentSubjectsList}
          userId={user?.id}
          lockedExam={lockedExam}
          setLockedExam={setLockedExam}
          isAdmin={isAdmin}
          loadingEnrollments={loadingEnrollments}
        />
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReadymadeExamView = ({ enrollments, selectedSubject, setSelectedSubject, selectedChapter, setSelectedChapter, selectedSubChapter, setSelectedSubChapter, navigate, searchQuery, page, setPage, selectedParentTopics, selectedBoards, setCurrentChaptersList, setCurrentSubjectsList, userId, lockedExam, setLockedExam, isAdmin, loadingEnrollments }: any) => {

  const enrolledIds: string[] = enrollments?.map((e: any) => e.course_id) || [];

  // --- SEARCH ---
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["readymade-exams-search", enrolledIds.join(','), searchQuery, page, selectedParentTopics, selectedBoards],
    queryFn: async () => {
      const safeQuery = searchQuery.replace(/[^\w\s\u0980-\u09FF]/g, "").trim();
      if (!safeQuery) return { data: [], count: 0 };
      let query = supabase
        .from("exams")
        .select("*, course:courses(name), questions_count:exam_questions(count)", { count: 'exact' })
        .eq("is_readymade", true).eq("is_published", true)
        .is("parent_exam_id", null)
        .ilike("title", `%${safeQuery}%`)
        .order("sort_order", { ascending: false }).order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!searchQuery
  });

  // --- LEVEL 1: SUBJECTS ---
  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ["readymade-exams-subjects", enrolledIds.join(','), selectedParentTopics, selectedBoards],
    queryFn: async () => {
      const data = await fetchAllRows<{ subject: any; course_id: string | null; shared_course_ids: string[] | null }>((from, to) => {
        let query = supabase.from("exams").select("subject, course_id, shared_course_ids")
          .eq("is_readymade", true).eq("is_published", true).range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        return query;
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
    queryKey: ["readymade-exams-chapters", selectedSubject, enrolledIds.join(','), selectedParentTopics, selectedBoards],
    queryFn: async () => {
      if (!selectedSubject) return [];
      const data = await fetchAllRows<{ chapter: string | null; course_id: string | null; shared_course_ids: string[] | null; sort_order: number | null }>((from, to) => {
        let query = supabase.from("exams").select("chapter, course_id, shared_course_ids, sort_order")
          .eq("is_readymade", true).eq("is_published", true).contains("subject", [selectedSubject]).range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        return query;
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

  // --- OVERALL STATS (Total Exams / User Attempted / Total MCQs) ---
  const { data: overallStats, isLoading: loadingOverallStats } = useQuery({
    queryKey: ["readymade-exams-overall-stats", enrolledIds.join(','), userId],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const allExamRows = await fetchAllRows<{ id: string }>((from, to) => {
        let q = supabase.from("exams").select("id")
          .eq("is_readymade", true).eq("is_published", true).range(from, to);
        return q;
      });
      const examIds = allExamRows.map(r => r.id);
      const totalExams = examIds.length;

      let totalMcqs = 0;
      let attemptedCount = 0;

      if (examIds.length > 0) {
        // PostgREST chokes on very long .in() lists (URL length limit) once the
        // platform has many readymade exams, silently returning 0. Batch the
        // exam_id list so the count query always succeeds regardless of scale.
        const ID_BATCH = 200;
        for (let i = 0; i < examIds.length; i += ID_BATCH) {
          const batchIds = examIds.slice(i, i + ID_BATCH);
          const { count: mcqCount } = await supabase
            .from("exam_questions")
            .select("id", { count: 'exact', head: true })
            .in("exam_id", batchIds);
          totalMcqs += mcqCount || 0;
        }

        if (userId) {
          const attemptedIds = new Set<string>();
          for (let i = 0; i < examIds.length; i += ID_BATCH) {
            const batchIds = examIds.slice(i, i + ID_BATCH);
            const { data: attemptRows } = await supabase
              .from("exam_attempts")
              .select("exam_id")
              .eq("profile_id", userId)
              .in("exam_id", batchIds);
            (attemptRows || []).forEach((r: any) => attemptedIds.add(r.exam_id));
          }
          attemptedCount = attemptedIds.size;
        }
      }

      return { totalExams, totalMcqs, attemptedCount, remaining: Math.max(totalExams - attemptedCount, 0) };
    },
    enabled: !selectedSubject && !searchQuery
  });

  // --- LEVEL 3: SUB-CHAPTERS (readymade_sub_chapter) ---
  const { data: subChapters, isLoading: loadingSubChapters } = useQuery({
    queryKey: ["readymade-exams-subchapters", selectedSubject, selectedChapter, enrolledIds.join(','), selectedParentTopics, selectedBoards],
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
      if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        return query;
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
    queryKey: ["readymade-exams-list", selectedSubject, selectedChapter, selectedSubChapter, enrolledIds.join(','), selectedParentTopics, selectedBoards],
    queryFn: async () => {
      if (!selectedSubject || !selectedChapter) return { data: [], count: 0 };
      let query = supabase.from("exams")
        .select("*, course:courses(name), questions_count:exam_questions(count)", { count: 'exact' })
        .eq("is_readymade", true).eq("is_published", true)
        .is("parent_exam_id", null)
        .contains("subject", [selectedSubject]).eq("chapter", selectedChapter)
        .order("sort_order", { ascending: false }).order("created_at", { ascending: false });
      if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
      // If subChapters exist for this chapter, only show exams for the selected sub-chapter
      if (selectedSubChapter) query = query.eq("readymade_sub_chapter", selectedSubChapter);
      const { data, count, error } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!selectedSubject && !!selectedChapter && (!!selectedSubChapter || subChapters?.length === 0) && !searchQuery
  });

  // ---- RENDER ----
  if (searchQuery) {
    if (searching || loadingEnrollments) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>;
    const exams = searchResults?.data || [];
    const count = searchResults?.count || 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);
    if (exams.length === 0) return <div className="text-center py-12 text-muted-foreground">No readymade exams found matching "{searchQuery}".</div>;
    return <div className="space-y-3"><PremiumLockDialog exam={lockedExam} onClose={() => setLockedExam(null)} navigate={navigate} /><ExamGrid exams={exams} navigate={navigate} enrolledIds={enrolledIds} onLockedClick={setLockedExam} isAdmin={isAdmin} /><PaginationControls page={page} setPage={setPage} totalPages={totalPages} /></div>;
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
      <div className="space-y-3">
        {overallStats ? (
          <div className="grid grid-cols-3 gap-2">
            <Card className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="p-2 flex flex-col items-center text-center gap-0.5">
                <span className="text-[10px] text-muted-foreground leading-tight">Total Exams</span>
                <span className="text-base font-bold text-blue-600 leading-tight">{overallStats.totalExams}</span>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-2 flex flex-col items-center text-center gap-0.5">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 leading-tight">দিয়েছো: {overallStats.attemptedCount} টি</span>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 leading-tight">বাকি: {overallStats.remaining} টি</span>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-2 flex flex-col items-center text-center gap-0.5">
                <span className="text-[10px] text-muted-foreground leading-tight">Total MCQ</span>
                <span className="text-base font-bold text-amber-600 leading-tight">{overallStats.totalMcqs}</span>
              </CardContent>
            </Card>
          </div>
        ) : loadingOverallStats ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => (
              <Card key={i} className="border-muted">
                <CardContent className="p-2 flex flex-col items-center gap-1">
                  <div className="h-2.5 w-12 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-8 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        {subjects.map(subject => (
          <Card key={subject} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedSubject(subject)}>
            <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Subject</span>
                <Trophy className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="text-base sm:text-xl font-bold text-primary leading-tight whitespace-pre-line">{subject}</div>
            </CardContent>
          </Card>
        ))}
        </div>
      </div>
    );
  }

  // LEVEL 2: Chapter selection
  if (!selectedChapter) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedSubject(null)} className="pl-0 h-8"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects</Button>
        <h2 className="text-base font-bold whitespace-pre-line">{selectedSubject}</h2>
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
      <PremiumLockDialog exam={lockedExam} onClose={() => setLockedExam(null)} navigate={navigate} />
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

      {loadingExams || loadingEnrollments ? (
        <div className="text-muted-foreground">Loading exams...</div>
      ) : !exams || exams.length === 0 ? (
        <div className="text-muted-foreground">No exams found.</div>
      ) : (
        <ExamGrid exams={exams} navigate={navigate} enrolledIds={enrolledIds} onLockedClick={setLockedExam} isAdmin={isAdmin} />
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SplitExamDialog = ({ exam, onClose }: { exam: any; onClose: () => void }) => {
  const { toast } = useToast();
  const [count, setCount] = useState("5");
  const [saving, setSaving] = useState(false);
  const totalQ = exam?.questions_count?.[0]?.count || 0;

  const handleSplit = async () => {
    const n = parseInt(count, 10);
    if (!n || n < 1) {
      toast({ title: "Invalid count", description: "Enter a valid MCQ count per exam.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("create_split_exams", { p_parent_exam_id: exam.id, p_per_split_count: n });
      if (error) throw error;
      toast({ title: "Split হয়েছে", description: `Exam splitted into groups of ${n} MCQs.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Split করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!exam} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Split Exam</DialogTitle>
          <DialogDescription>
            মোট {totalQ}টি MCQ আছে। প্রতি exam-এ কতটি MCQ থাকবে লিখুন।
          </DialogDescription>
        </DialogHeader>
        <Input
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          placeholder="e.g. 5"
        />
        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1" onClick={handleSplit} disabled={saving}>{saving ? "..." : "Split করুন"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SplitExamDropdown = ({ parentId, navigate, isAdmin }: { parentId: string; navigate: any; isAdmin: boolean }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: splits, isLoading, refetch } = useQuery({
    queryKey: ["split-exams", parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("id, title, split_start, split_end")
        .eq("parent_exam_id", parentId)
        .order("split_start", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("exams").delete().eq("id", id);
      if (error) throw error;
      refetch();
    } catch (err: any) {
      toast({ title: "Delete করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-primary"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="ml-1">ভেঙে ভেঙে পরীক্ষা দাও</span>
      </Button>
      {open && (
        <div className="mt-1 space-y-1 border-l-2 border-primary/20 pl-2">
          {isLoading ? (
            <div className="text-[11px] text-muted-foreground">Loading...</div>
          ) : !splits || splits.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">No splits yet.</div>
          ) : (
            splits.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 cursor-pointer hover:bg-muted"
                onClick={() => {
                  setExamSourceList(s.id, "/dashboard/readymade");
                  navigate(`/dashboard/take-exam/${s.id}`);
                }}
              >
                <span className="text-xs font-medium">{s.title}</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white">Start</Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-[10px] text-destructive hover:text-destructive"
                      disabled={deletingId === s.id}
                      onClick={(e) => handleDelete(e, s.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ExamGrid = ({ exams, navigate, enrolledIds = [], onLockedClick, isAdmin = false }: { exams: any[], navigate: any, enrolledIds?: string[], onLockedClick?: (exam: any) => void, isAdmin?: boolean }) => {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [splittingExam, setSplittingExam] = useState<any | null>(null);

  const handleDownloadPdf = async (e: React.MouseEvent, exam: any) => {
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(exam.id);
    try {
      const { data, error } = await supabase.rpc("get_exam_questions_practice", { p_exam_id: exam.id });
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: "No questions found", description: "This exam has no questions to export.", variant: "destructive" });
        return;
      }
      openSolvePdf({
        examName: exam.title,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        questions: data.map((q: any) => ({
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          option_e: q.option_e,
          correct_option: q.correct_option,
          user_answer: null,
          explanation: q.explanation,
        })),
        totalMarks: data.length,
      });
    } catch (err: any) {
      toast({ title: "PDF তৈরি করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
    {splittingExam && <SplitExamDialog exam={splittingExam} onClose={() => setSplittingExam(null)} />}
    {exams.map((exam) => {
      const unlocked = isExamUnlocked(exam, enrolledIds);
      return (
        <Card key={exam.id} className={`cursor-pointer transition-all hover:shadow-md group ${unlocked ? "hover:border-primary/50" : "border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10"}`}
          onClick={() => {
            if (!unlocked) { onLockedClick?.(exam); return; }
            setExamSourceList(exam.id, "/dashboard/readymade");
            navigate(`/dashboard/take-exam/${exam.id}`);
          }}>
          <CardContent className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className={`text-base font-bold leading-tight transition-colors ${unlocked ? "group-hover:text-primary" : "text-amber-700 dark:text-amber-500"}`}>{exam.title}</p>
              </div>
              <div className="shrink-0">
                {unlocked ? (
                  <Button size="sm" className="group-hover:bg-primary/90">Start</Button>
                ) : (
                  <Button size="sm" variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-500 gap-1">
                    <Lock className="h-3.5 w-3.5" />Locked
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 min-w-0 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <p className="text-[10px] font-mono uppercase">{exam.course?.name || "Public"}</p>
                <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /><span>{exam.duration_minutes} min</span></div>
                <div className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /><span>{exam.questions_count?.[0]?.count || 0} Q</span></div>
                <Badge variant="outline" className="text-blue-500 border-blue-200 text-[10px] px-1.5 py-0">Readymade</Badge>
                {!unlocked && <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5 py-0 gap-0.5"><Lock className="h-2.5 w-2.5" />Premium</Badge>}
              </div>
              <div className="shrink-0 flex items-center gap-1">
                {unlocked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-blue-600"
                    disabled={downloadingId === exam.id}
                    onClick={(e) => handleDownloadPdf(e, exam)}
                  >
                    <FileDown className="h-3.5 w-3.5 mr-1" />
                    {downloadingId === exam.id ? "..." : "PDF"}
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary"
                    onClick={(e) => { e.stopPropagation(); setSplittingExam(exam); }}
                  >
                    Split
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
          {unlocked && (
            <div className="px-4 pb-2 -mt-1" onClick={(e) => e.stopPropagation()}>
              <SplitExamDropdown parentId={exam.id} navigate={navigate} isAdmin={isAdmin} />
            </div>
          )}
        </Card>
      );
    })}
  </div>
  );
};


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
