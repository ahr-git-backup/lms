import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExamForm } from "@/components/admin/ExamForm";
import { ArrowLeft, Trophy, Clock, CheckCircle, ChevronRight, Search, ChevronLeft, LayoutTemplate, X, Lock, Sparkles, FileDown, Plus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openSolvePdf } from "@/lib/solvePdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useNavigate, useNavigationType, useParams } from "react-router-dom";
import { setExamSourceList } from "@/lib/examSourceTracker";
import { useAuth } from "@/contexts/AuthContext";
import { CourseItemsManagerDialog } from "@/components/admin/CourseItemsManagerDialog";
import { ChapterSortDialog } from "@/components/admin/ChapterSortDialog";
import { SubjectSortDialog } from "@/components/admin/SubjectSortDialog";
import ErrorBoundary from "@/components/ErrorBoundary";

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

// Determine whether a given exam is accessible to the current user, evaluated
// client-side so we can render ALL exams and just lock the ones the user
// doesn't have access to, instead of hiding them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isExamUnlocked = (exam: any, enrolledIds: string[], fullAccessCourseIds: string[] = [], subChapterGrants: Set<string> = new Set()): boolean => {
  if (exam.is_visible_on_free) return true;
  if (enrolledIds.length === 0) return false;
  if (fullAccessCourseIds.length > 0 && fullAccessCourseIds.some((id) => enrolledIds.includes(id))) return true;
  if (exam.course_id && enrolledIds.includes(exam.course_id)) return true;
  if (Array.isArray(exam.shared_course_ids) && exam.shared_course_ids.some((id: string) => enrolledIds.includes(id))) return true;
  if (Array.isArray(exam.readymade_course_ids) && exam.readymade_course_ids.some((id: string) => enrolledIds.includes(id))) return true;
  // Sub-chapter-level grant: matches if ANY enrolled course has granted access
  // to this exam's subject/chapter/sub-chapter combo (future-proof, covers
  // exams added after the grant was made).
  const subs: string[] = Array.isArray(exam.subject) ? exam.subject : (typeof exam.subject === "string" ? [exam.subject] : []);
  const chapter = exam.chapter || "সাধারণ";
  const subChapter = exam.readymade_sub_chapter || "সাধারণ";
  for (const subject of subs) {
    for (const courseId of enrolledIds) {
      if (subChapterGrants.has(`${courseId}|||${subject}|||${chapter}|||${subChapter}`)) return true;
    }
  }
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
  const [selectedBoardStep, setSelectedBoardStep] = useState<string | null>(null);
  const [selectedSubChapter, setSelectedSubChapter] = useState<string | null>(null);
  const [manageType, setManageType] = useState<"classes" | "exams" | null>(null);
  const [manageChapters, setManageChapters] = useState(false);
  const [manageBoards, setManageBoards] = useState(false);
  const [manageSubChapters, setManageSubChapters] = useState(false);
  const [currentChaptersList, setCurrentChaptersList] = useState<string[]>([]);
  const [currentSubjectsList, setCurrentSubjectsList] = useState<string[]>([]);
  const [currentBoardsList, setCurrentBoardsList] = useState<string[]>([]);
  const [currentSubChaptersList, setCurrentSubChaptersList] = useState<string[]>([]);
  const [manageSubjects, setManageSubjects] = useState(false);
  const { data: enrollments, isLoading: loadingEnrollments } = useEnrollments();
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const navigationType = useNavigationType(); // "POP" = browser back/forward, "PUSH"/"REPLACE" = normal link click
  const { categoryName } = useParams<{ categoryName?: string }>();

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedParentTopics, setSelectedParentTopics] = useState<string[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [activeTypePanel, setActiveTypePanel] = useState<"type-based" | "model-test" | null>(null);
  const [addQuestionCategory, setAddQuestionCategory] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lockedExam, setLockedExam] = useState<any | null>(null);

  useEffect(() => {
    if (categoryName) {
      setSelectedBoards([decodeURIComponent(categoryName)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryName]);

  const { data: boards } = useQuery({
    queryKey: ["readymade-boards", selectedParentTopics],
    queryFn: async () => {
      const data = await fetchAllRows<{ readymade_category: string | null }>((from, to) => {
        let query = supabase
          .from("exams")
          .select("readymade_category")
          .eq("is_readymade", true)
          .eq("is_published", true)
          .not("readymade_category", "is", null)
          .range(from, to);
        if (selectedParentTopics.length > 0) query = query.in("readymade_topic", selectedParentTopics);
        return query;
      });
      const unique = new Set<string>();
      data.forEach(row => { if (row.readymade_category) unique.add(row.readymade_category); });
      return Array.from(unique).sort().map(b => ({ label: b, value: b }));
    }
  });

  const { data: parentTopics } = useQuery({
    queryKey: ["readymade-parent-topics"],
    queryFn: async () => {
      const data = await fetchAllRows<{ readymade_topic: string | null }>((from, to) => {
        let query = supabase
          .from("exams")
          .select("readymade_topic")
          .eq("is_readymade", true)
          .eq("is_published", true)
          .not("readymade_topic", "is", null)
          .range(from, to);
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
        if (s.selectedBoardStep) setSelectedBoardStep(s.selectedBoardStep);
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
        selectedSubject, selectedChapter, selectedBoardStep, selectedSubChapter, searchQuery, page, selectedParentTopics, selectedBoards,
      }));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedChapter, selectedBoardStep, selectedSubChapter, searchQuery, page, selectedParentTopics, selectedBoards]);

  useEffect(() => { document.title = "Readymade – Atlas"; }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery) setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const resetToSubject = () => { setSelectedChapter(null); setSelectedBoardStep(null); setSelectedSubChapter(null); };
  const resetToChapter = () => { setSelectedBoardStep(null); setSelectedSubChapter(null); };

  return (
    <div className="space-y-2">
      <ErrorBoundary label="Readymade header">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Readymade Exam</h1>
        <div className="relative">
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
      </ErrorBoundary>

      {categoryName && (
        <div className="flex items-center gap-2 -mt-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 gap-1" onClick={() => navigate("/dashboard/readymade")}>
            <ArrowLeft className="h-4 w-4" /> সব ক্যাটাগরি
          </Button>
          <Badge variant="secondary" className="text-xs">{decodeURIComponent(categoryName)}</Badge>
        </div>
      )}

      {!selectedSubject && !categoryName && (
        <div className="grid grid-cols-3 gap-2">
          {(enrollments?.length || 0) > 0 && (
            <button
              type="button"
              onClick={() => { try { sessionStorage.removeItem("customExamBuilderState"); } catch { /* ignore */ } navigate("/dashboard/readymade/custom-exam"); }}
              className="rounded-xl border-2 border-border hover:border-primary/40 p-3 text-center transition-all"
            >
              <Sparkles className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs font-semibold leading-tight">এক্সাম বানাও</p>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTypePanel(activeTypePanel === "type-based" ? null : "type-based")}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              activeTypePanel === "type-based"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40"
            }`}
          >
            <LayoutTemplate className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-semibold leading-tight">টাইপভিত্তিক এক্সাম</p>
          </button>
          <button
            type="button"
            onClick={() => setActiveTypePanel(activeTypePanel === "model-test" ? null : "model-test")}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              activeTypePanel === "model-test"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40"
            }`}
          >
            <FileDown className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-semibold leading-tight">মডেল টেস্ট বানাও</p>
          </button>
        </div>
      )}

      <Dialog open={activeTypePanel === "type-based"} onOpenChange={(o) => setActiveTypePanel(o ? "type-based" : null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>টাইপভিত্তিক এক্সাম</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {["মেডিকেল স্ট্যান্ডার্ড প্রশ্ন", "সত্য-মিথ্যার প্রশ্ন", "ছকভিত্তিক প্রশ্ন", "ছোট প্রশ্ন-বড় অপশন"].map((label) => (
              <div key={label} className="relative">
                <Button
                  variant={selectedBoards.includes(label) ? "default" : "outline"}
                  size="sm"
                  className="h-auto py-2 text-xs whitespace-pre-line leading-tight w-full"
                  onClick={() => { setActiveTypePanel(null); navigate(`/dashboard/readymade/category/${encodeURIComponent(label)}`); }}
                >
                  {label}
                </Button>
                {isAdmin && (
                  <button
                    type="button"
                    aria-label={`Add question to ${label}`}
                    onClick={(e) => { e.stopPropagation(); setAddQuestionCategory(label); }}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeTypePanel === "model-test"} onOpenChange={(o) => setActiveTypePanel(o ? "model-test" : null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>মডেল টেস্ট বানাও</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            {["Subject Final", "Paper Final", "Full Model Test"].map((label) => (
              <div key={label} className="relative">
                <Button
                  variant={selectedBoards.includes(label) ? "default" : "outline"}
                  size="sm"
                  className="h-auto py-2 text-xs whitespace-pre-line leading-tight w-full"
                  onClick={() => { setActiveTypePanel(null); navigate(`/dashboard/readymade/category/${encodeURIComponent(label)}`); }}
                >
                  {label}
                </Button>
                {isAdmin && (
                  <button
                    type="button"
                    aria-label={`Add question to ${label}`}
                    onClick={(e) => { e.stopPropagation(); setAddQuestionCategory(label); }}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addQuestionCategory} onOpenChange={(o) => { if (!o) setAddQuestionCategory(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{addQuestionCategory} — নতুন এক্সাম যোগ করুন</DialogTitle>
          </DialogHeader>
          {addQuestionCategory && (
            <ExamForm
              exam={{ is_readymade: true, readymade_category: addQuestionCategory }}
              onSuccess={() => setAddQuestionCategory(null)}
              onCancel={() => setAddQuestionCategory(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {!selectedSubject && !categoryName && parentTopics && parentTopics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
          <Button
            variant={selectedParentTopics.length === 0 ? "default" : "secondary"}
            size="sm"
            className="rounded-full shadow-sm text-[11px] sm:text-xs min-h-7 sm:min-h-8 h-auto px-2 py-1 hover:scale-105 transition-transform whitespace-pre-line text-center leading-tight"
            onClick={() => { setPage(0); setSelectedParentTopics([]); setSelectedBoards([]); setActiveTypePanel(null); }}
          >
            All
          </Button>
          {parentTopics.map(topic => (
            <Button
              key={topic.value}
              variant={selectedParentTopics.includes(topic.value) ? "default" : "secondary"}
              size="sm"
              className="rounded-full shadow-sm text-[11px] sm:text-xs h-auto min-h-7 sm:min-h-8 py-1 px-2 hover:scale-105 transition-transform leading-tight whitespace-pre-line text-center"
              onClick={() => {
                setPage(0);
                setSelectedBoards([]);
                setActiveTypePanel(null);
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

      {isAdmin && selectedChapter && !selectedBoardStep && currentBoardsList.length > 0 && (
        <div className="flex gap-2 bg-muted/30 p-2 rounded-lg border">
          <div className="text-xs font-medium mr-auto self-center">Admin:</div>
          <Button variant="outline" size="sm" onClick={() => setManageBoards(true)}>Manage Board/Category Order</Button>
        </div>
      )}

      {isAdmin && selectedChapter && !selectedSubChapter && currentSubChaptersList.length > 0 && (
        <div className="flex gap-2 bg-muted/30 p-2 rounded-lg border">
          <div className="text-xs font-medium mr-auto self-center">Admin:</div>
          <Button variant="outline" size="sm" onClick={() => setManageSubChapters(true)}>Manage Session/Sub-chapter Order</Button>
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
      ) : manageBoards && selectedSubject && selectedChapter ? (
        <ChapterSortDialog
          courseId={enrollments?.[0]?.course_id || null}
          subject={selectedSubject}
          chapters={currentBoardsList}
          contextName="Boards/Categories"
          title={`Organize Boards - ${selectedSubject} / ${selectedChapter}`}
          settingsKey={`board_order_global_${selectedSubject}_${selectedChapter}`}
          extraInvalidateKeys={["readymade-exams-chapter-boards"]}
          onClose={() => setManageBoards(false)}
        />
      ) : manageSubChapters && selectedSubject && selectedChapter ? (
        <ChapterSortDialog
          courseId={enrollments?.[0]?.course_id || null}
          subject={selectedSubject}
          chapters={currentSubChaptersList}
          contextName="Sessions/Sub-chapters"
          title={`Organize Sessions - ${selectedSubject} / ${selectedChapter}${selectedBoardStep ? ` / ${selectedBoardStep}` : ""}`}
          settingsKey={`subchapter_order_global_${selectedSubject}_${selectedChapter}_${selectedBoardStep || ""}`}
          extraInvalidateKeys={["readymade-exams-subchapters"]}
          onClose={() => setManageSubChapters(false)}
        />
      ) : manageSubjects ? (
        <SubjectSortDialog
          onClose={() => setManageSubjects(false)}
        />
      ) : (
        <ErrorBoundary label="Readymade exam browser">
        <ReadymadeExamView
          enrollments={enrollments}
          selectedSubject={selectedSubject}
          setSelectedSubject={(s: string | null) => { setSelectedSubject(s); resetToSubject(); }}
          selectedChapter={selectedChapter}
          setSelectedChapter={(c: string | null) => { setSelectedChapter(c); resetToChapter(); }}
          selectedBoardStep={selectedBoardStep}
          setSelectedBoardStep={setSelectedBoardStep}
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
          setCurrentBoardsList={setCurrentBoardsList}
          setCurrentSubChaptersList={setCurrentSubChaptersList}
          userId={user?.id}
          lockedExam={lockedExam}
          setLockedExam={setLockedExam}
          isAdmin={isAdmin}
          loadingEnrollments={loadingEnrollments}
        />
        </ErrorBoundary>
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReadymadeExamView = ({ enrollments, selectedSubject, setSelectedSubject, selectedChapter, setSelectedChapter, selectedBoardStep, setSelectedBoardStep, selectedSubChapter, setSelectedSubChapter, navigate, searchQuery, page, setPage, selectedParentTopics, selectedBoards, setCurrentChaptersList, setCurrentSubjectsList, setCurrentBoardsList, setCurrentSubChaptersList, userId, lockedExam, setLockedExam, isAdmin, loadingEnrollments }: any) => {

  const enrolledIds: string[] = enrollments?.map((e: any) => e.course_id) || [];
  const fullAccessCourseIds: string[] = enrollments?.filter((e: any) => e.course?.readymade_full_access).map((e: any) => e.course_id) || [];

  const { data: subChapterGrants } = useQuery({
    queryKey: ["course-readymade-subchapter-grants", enrolledIds.join(',')],
    queryFn: async () => {
      if (enrolledIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from("course_readymade_access")
        .select("course_id, subject, chapter, sub_chapter")
        .eq("mode", "readymade")
        .in("course_id", enrolledIds);
      if (error) throw error;
      return new Set((data || []).map((g: any) => `${g.course_id}|||${g.subject}|||${g.chapter}|||${g.sub_chapter}`));
    },
    enabled: enrolledIds.length > 0,
    // Access can be granted by admin at any time while a student already has
    // this page open — keep grants fresh so newly-granted content unlocks
    // without requiring a manual page reload.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // --- SEARCH ---
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["readymade-exams-search", enrolledIds.join(','), searchQuery, selectedParentTopics, selectedBoards],
    queryFn: async () => {
      const safeQuery = searchQuery.replace(/[^\w\s\u0980-\u09FF]/g, "").trim();
      if (!safeQuery) return { data: [], count: 0 };
      const data = await fetchAllRows<any>((from, to) => {
        let query = supabase
          .from("exams")
          .select("*, course:courses(name), questions_count:exam_questions(count)")
          .eq("is_readymade", true).eq("is_published", true)
          .is("parent_exam_id", null)
          .ilike("title", `%${safeQuery}%`)
          .order("sort_order", { ascending: false }).order("created_at", { ascending: false })
          .range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
        if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        return query;
      });
      return { data, count: data.length };
    },
    enabled: !!searchQuery
  });

  // --- LEVEL 1: SUBJECTS ---
  const { data: subjectsResult, isLoading: loadingSubjects } = useQuery({
    queryKey: ["readymade-exams-subjects", enrolledIds.join(','), selectedParentTopics, selectedBoards],
    queryFn: async () => {
      const data = await fetchAllRows<{ subject: any; course_id: string | null; shared_course_ids: string[] | null; readymade_course_ids: string[] | null; chapter: string | null; readymade_sub_chapter: string | null; is_visible_on_free: boolean | null }>((from, to) => {
        let query = supabase.from("exams").select("subject, course_id, shared_course_ids, readymade_course_ids, chapter, readymade_sub_chapter, is_visible_on_free")
          .eq("is_readymade", true).eq("is_published", true).range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        return query;
      });
      const unique = new Set<string>();
      const subjectCourseIds: Record<string, Set<string>> = {};
      const unlockMap: Record<string, boolean> = {};
      data.forEach((row: any) => {
        const subs: string[] = Array.isArray(row.subject) ? row.subject : (typeof row.subject === 'string' ? [row.subject] : []);
        subs.forEach((s: string) => {
          unique.add(s);
          if (!subjectCourseIds[s]) subjectCourseIds[s] = new Set();
          if (row.course_id) subjectCourseIds[s].add(row.course_id);
          if (Array.isArray(row.shared_course_ids)) row.shared_course_ids.forEach((id: string) => subjectCourseIds[s].add(id));
          if (!unlockMap[s]) {
            const rowUnlocked = isExamUnlocked(
              { course_id: row.course_id, shared_course_ids: row.shared_course_ids, readymade_course_ids: row.readymade_course_ids, subject: [s], chapter: row.chapter, readymade_sub_chapter: row.readymade_sub_chapter, is_visible_on_free: row.is_visible_on_free },
              enrolledIds, fullAccessCourseIds, subChapterGrants
            );
            if (rowUnlocked) unlockMap[s] = true;
          }
        });
      });
      const { data: settingsData } = await supabase.from("app_settings").select("value").eq("key", "subject_order_global").maybeSingle();
      const savedOrder: string[] = settingsData?.value ? (settingsData.value as string[]) : [];
      const { data: hiddenData } = await supabase.from("app_settings").select("value").eq("key", "subject_hidden_global").maybeSingle();
      const hiddenList: string[] = hiddenData?.value ? (hiddenData.value as string[]) : [];
      const hiddenSet = new Set<string>(hiddenList);
      // Students never see hidden subjects. Admins see everything (hidden ones
      // dimmed, with a toggle) so they can find and unhide a subject again.
      const allSubjects = Array.from(unique);
      const visible = isAdmin ? allSubjects : allSubjects.filter((s) => !hiddenSet.has(s));
      const sortedSubjects = visible.sort((a, b) => {
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        return a.localeCompare(b);
      });
      const courseIdsBySubject: Record<string, string[]> = {};
      Object.entries(subjectCourseIds).forEach(([s, ids]) => { courseIdsBySubject[s] = Array.from(ids); });
      return { subjects: sortedSubjects, courseIdsBySubject, unlockMap, hiddenSet };
    },
    enabled: !selectedSubject && !searchQuery
  });

  const subjects = subjectsResult?.subjects;
  const hiddenSubjects = subjectsResult?.hiddenSet || new Set<string>();
  const isSubjectUnlocked = (subject: string): boolean => {
    if (isAdmin) return true;
    return !!subjectsResult?.unlockMap?.[subject];
  };

  const queryClient = useQueryClient();
  const toggleSubjectHiddenMutation = useMutation({
    mutationFn: async (subject: string) => {
      const next = new Set(hiddenSubjects);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "subject_hidden_global", value: Array.from(next) }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readymade-exams-subjects"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update visibility", description: err.message, variant: "destructive" });
    },
  });

  // Per-subject MCQ count badge — total questions across all exams in each
  // subject, for the subject-selection cards. Backed by a single server-side
  // aggregation RPC instead of paginating every exam_questions row client-side.
  const { data: mcqCountsData, isLoading: loadingMcqCounts } = useQuery({
    queryKey: ["readymade-mcq-counts", selectedParentTopics, selectedBoards],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_readymade_mcq_counts", {
        p_readymade_topics: selectedParentTopics?.length > 0 ? selectedParentTopics : null,
        p_readymade_categories: selectedBoards?.length > 0 ? selectedBoards : null,
      });
      if (error) throw error;
      return data as { subject_counts: Record<string, number>; chapter_counts: Record<string, number>; subchapter_counts: Record<string, number> };
    },
  });
  const subjectMcqCounts = mcqCountsData?.subject_counts;
  const chapterMcqCounts = mcqCountsData?.chapter_counts;
  const boardMcqCounts = mcqCountsData?.board_counts;
  const subChapterMcqCounts = mcqCountsData?.subchapter_counts;

  // --- LEVEL 2: CHAPTERS ---
  const { data: chaptersResult, isLoading: loadingChapters } = useQuery({
    queryKey: ["readymade-exams-chapters", selectedSubject, enrolledIds.join(','), selectedParentTopics, selectedBoards],
    queryFn: async () => {
      if (!selectedSubject) return { chapters: [], unlockMap: {} as Record<string, boolean> };
      const data = await fetchAllRows<{ chapter: string | null; course_id: string | null; shared_course_ids: string[] | null; readymade_course_ids: string[] | null; readymade_sub_chapter: string | null; sort_order: number | null }>((from, to) => {
        let query = supabase.from("exams").select("chapter, course_id, shared_course_ids, readymade_course_ids, readymade_sub_chapter, sort_order")
          .eq("is_readymade", true).eq("is_published", true).contains("subject", [selectedSubject]).range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        return query;
      });
      const unique = new Set<string>(); const orderMap = new Map<string, number>();
      const unlockMap: Record<string, boolean> = {};
      const settingsKey = `chapter_order_global_${selectedSubject}`;
      const { data: sd } = await supabase.from("app_settings").select("value").eq("key", settingsKey).maybeSingle();
      const savedOrder: string[] = sd?.value ? (sd.value as string[]) : [];
      data.forEach((row: any) => {
        if (row.chapter) {
          unique.add(row.chapter);
          const cur = orderMap.get(row.chapter) || 0;
          if ((row.sort_order || 0) > cur) orderMap.set(row.chapter, row.sort_order || 0);
          if (!unlockMap[row.chapter]) {
            const rowUnlocked = isExamUnlocked(
              { course_id: row.course_id, shared_course_ids: row.shared_course_ids, readymade_course_ids: row.readymade_course_ids, subject: [selectedSubject], chapter: row.chapter, readymade_sub_chapter: row.readymade_sub_chapter, is_visible_on_free: false },
              enrolledIds, fullAccessCourseIds, subChapterGrants
            );
            if (rowUnlocked) unlockMap[row.chapter] = true;
          }
        }
      });
      const chapters = Array.from(unique).sort((a, b) => {
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        const oA = orderMap.get(a) || 0, oB = orderMap.get(b) || 0;
        if (oA !== oB) return oB - oA;
        return a.localeCompare(b);
      });
      return { chapters, unlockMap };
    },
    enabled: !!selectedSubject && !selectedChapter && !searchQuery
  });
  const chapters = chaptersResult?.chapters;
  const chapterUnlockMap = chaptersResult?.unlockMap || {};

  useEffect(() => { if (chapters) setCurrentChaptersList(chapters); }, [chapters, setCurrentChaptersList]);
  useEffect(() => { if (subjects) setCurrentSubjectsList(subjects); }, [subjects, setCurrentSubjectsList]);

  // Per-chapter MCQ counts now come from the same get_readymade_mcq_counts
  // RPC call above (chapterMcqCounts), no separate query needed.

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

  // --- LEVEL 2.5: BOARD/CATEGORY (readymade_category) — optional drill-down step
  // within the selected chapter. Skipped automatically if the chapter has no
  // exams carrying a readymade_category value.
  const { data: chapterBoards, isLoading: loadingChapterBoards } = useQuery({
    queryKey: ["readymade-exams-chapter-boards", selectedSubject, selectedChapter, enrolledIds.join(','), selectedParentTopics, selectedBoards],
    queryFn: async () => {
      if (!selectedSubject || !selectedChapter) return [];
      const data = await fetchAllRows<{ readymade_category: string | null }>((from, to) => {
        let query = supabase.from("exams")
          .select("readymade_category")
          .eq("is_readymade", true).eq("is_published", true)
          .contains("subject", [selectedSubject]).eq("chapter", selectedChapter)
          .not("readymade_category", "is", null)
          .range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
        if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        return query;
      });
      const unique = new Set<string>();
      data.forEach((row: any) => { if (row.readymade_category) unique.add(row.readymade_category); });
      const settingsKey = `board_order_global_${selectedSubject}_${selectedChapter}`;
      const { data: sd } = await supabase.from("app_settings").select("value").eq("key", settingsKey).maybeSingle();
      const savedOrder: string[] = sd?.value ? (sd.value as string[]) : [];
      return Array.from(unique).sort((a, b) => {
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        return a.localeCompare(b);
      });
    },
    enabled: !!selectedSubject && !!selectedChapter && !selectedBoardStep && !searchQuery
  });

  // --- LEVEL 3: SUB-CHAPTERS (readymade_sub_chapter) ---
  const { data: subChaptersResult, isLoading: loadingSubChapters } = useQuery({
    queryKey: ["readymade-exams-subchapters", selectedSubject, selectedChapter, selectedBoardStep, enrolledIds.join(','), selectedParentTopics, selectedBoards],
    queryFn: async () => {
      if (!selectedSubject || !selectedChapter) return { subChapters: [], unlockMap: {} as Record<string, boolean> };
      const data = await fetchAllRows<{ readymade_sub_chapter: string | null; course_id: string | null; shared_course_ids: string[] | null; readymade_course_ids: string[] | null }>((from, to) => {
        let query = supabase.from("exams")
          .select("readymade_sub_chapter, course_id, shared_course_ids, readymade_course_ids")
          .eq("is_readymade", true).eq("is_published", true)
          .contains("subject", [selectedSubject]).eq("chapter", selectedChapter)
          .not("readymade_sub_chapter", "is", null)
          .range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        if (selectedBoardStep) query = query.eq("readymade_category", selectedBoardStep);
        return query;
      });
      const unique = new Set<string>();
      const unlockMap: Record<string, boolean> = {};
      data.forEach((row: any) => {
        if (row.readymade_sub_chapter) {
          unique.add(row.readymade_sub_chapter);
          if (!unlockMap[row.readymade_sub_chapter]) {
            const rowUnlocked = isExamUnlocked(
              { course_id: row.course_id, shared_course_ids: row.shared_course_ids, readymade_course_ids: row.readymade_course_ids, subject: [selectedSubject], chapter: selectedChapter, readymade_sub_chapter: row.readymade_sub_chapter, is_visible_on_free: false },
              enrolledIds, fullAccessCourseIds, subChapterGrants
            );
            if (rowUnlocked) unlockMap[row.readymade_sub_chapter] = true;
          }
        }
      });
      const settingsKey = `subchapter_order_global_${selectedSubject}_${selectedChapter}_${selectedBoardStep || ""}`;
      const { data: sd } = await supabase.from("app_settings").select("value").eq("key", settingsKey).maybeSingle();
      const savedOrder: string[] = sd?.value ? (sd.value as string[]) : [];
      const subChapters = Array.from(unique).sort((a, b) => {
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        return a.localeCompare(b);
      });
      return { subChapters, unlockMap };
    },
    enabled: !!selectedSubject && !!selectedChapter && !selectedSubChapter && !searchQuery
      && (!!selectedBoardStep || chapterBoards?.length === 0)
  });
  const subChapters = subChaptersResult?.subChapters;
  useEffect(() => { if (chapterBoards) setCurrentBoardsList(chapterBoards); }, [chapterBoards, setCurrentBoardsList]);
  useEffect(() => { if (subChapters) setCurrentSubChaptersList(subChapters); }, [subChapters, setCurrentSubChaptersList]);
  const subChapterUnlockMap = subChaptersResult?.unlockMap || {};

  // --- LEVEL 4: EXAMS (filtered by sub-chapter if present, else no sub-chapter filter) ---
  // No .range() here on purpose — user wants every exam in the chapter/session
  // visible on a single page, no "Next page" pagination for this level.
  const { data: examsData, isLoading: loadingExams } = useQuery({
    queryKey: ["readymade-exams-list", selectedSubject, selectedChapter, selectedBoardStep, selectedSubChapter, enrolledIds.join(','), selectedParentTopics, selectedBoards],
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
      if (selectedBoardStep) query = query.eq("readymade_category", selectedBoardStep);
      // If subChapters exist for this chapter, only show exams for the selected sub-chapter
      if (selectedSubChapter) query = query.eq("readymade_sub_chapter", selectedSubChapter);
      const { data, count, error } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!selectedSubject && !!selectedChapter && !searchQuery
      && (!!selectedBoardStep || chapterBoards?.length === 0)
      && (!!selectedSubChapter || subChapters?.length === 0)
  });

  // ---- RENDER ----
  if (searchQuery) {
    if (searching || loadingEnrollments) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>;
    const exams = searchResults?.data || [];
    const count = searchResults?.count || 0;
    if (exams.length === 0) return <div className="text-center py-12 text-muted-foreground">No readymade exams found matching "{searchQuery}".</div>;
    return <div className="space-y-3"><PremiumLockDialog exam={lockedExam} onClose={() => setLockedExam(null)} navigate={navigate} /><ExamGrid exams={exams} navigate={navigate} enrolledIds={enrolledIds} fullAccessCourseIds={fullAccessCourseIds} subChapterGrants={subChapterGrants} onLockedClick={setLockedExam} isAdmin={isAdmin} /></div>;
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
        <PremiumLockDialog exam={lockedExam} onClose={() => setLockedExam(null)} navigate={navigate} />
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
        {subjects.map(subject => {
          const unlocked = isSubjectUnlocked(subject);
          const isHidden = hiddenSubjects.has(subject);
          return (
          <Card
            key={subject}
            className={`relative overflow-hidden transition-all cursor-pointer hover:border-primary/50 hover:shadow-md ${!unlocked ? "opacity-80" : ""} ${isHidden ? "opacity-50 border-dashed" : ""}`}
            onClick={() => setSelectedSubject(subject)}
          >
            {!unlocked && (
              <div className="absolute inset-0 z-[1] flex items-center justify-center overflow-hidden pointer-events-none select-none">
                <span className="text-lg sm:text-xl font-black text-foreground/15 rotate-[-20deg] tracking-widest whitespace-nowrap">LOCKED</span>
              </div>
            )}
            {!unlocked && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toast({ title: "Locked", description: `"${subject}" বিষয়ে আপনার এক্সেস নেই। ভর্তি হলে আনলক হয়ে যাবে।` }); }}
                className="absolute bottom-1.5 right-1.5 z-10 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full p-1"
              >
                <Lock className="h-3 w-3" />
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleSubjectHiddenMutation.mutate(subject); }}
                disabled={toggleSubjectHiddenMutation.isPending}
                className={`absolute top-1.5 right-1.5 z-10 rounded-full p-1 disabled:opacity-50 ${isHidden ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                aria-label={isHidden ? "Show subject to students" : "Hide subject from students"}
              >
                {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            )}
            <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Subject</span>
                {loadingMcqCounts ? (
                  <span className="shrink-0 h-4 w-10 bg-muted animate-pulse rounded-full" />
                ) : typeof subjectMcqCounts?.[subject] === "number" ? (
                  <span className="shrink-0 text-[9px] sm:text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    {subjectMcqCounts[subject]} MCQ
                  </span>
                ) : (
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <div className={`text-base sm:text-xl font-bold leading-tight whitespace-pre-line ${unlocked ? "text-primary" : "text-muted-foreground"}`}>{subject}</div>
              {isAdmin && isHidden && (
                <div className="text-[9px] font-medium text-muted-foreground mt-0.5">Hidden from students</div>
              )}
            </CardContent>
          </Card>
          );
        })}
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
              {chapters.map(chapter => {
                const chapterUnlocked = chapterUnlockMap[chapter];
                return (
                <Card key={chapter} className={`relative cursor-pointer hover:border-primary/50 transition-all hover:shadow-md ${!chapterUnlocked ? "opacity-80" : ""}`} onClick={() => setSelectedChapter(chapter)}>
                  {!chapterUnlocked && (
                    <div className="absolute inset-0 z-[1] flex items-center justify-center overflow-hidden pointer-events-none select-none">
                      <span className="text-lg sm:text-xl font-black text-foreground/15 rotate-[-20deg] tracking-widest whitespace-nowrap">LOCKED</span>
                    </div>
                  )}
                  {!chapterUnlocked && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toast({ title: "Locked", description: `"${chapter}" চ্যাপ্টারে আপনার এক্সেস নেই। ভর্তি হলে আনলক হয়ে যাবে।` }); }}
                      className="absolute bottom-1.5 right-1.5 z-10 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full p-1"
                    >
                      <Lock className="h-3 w-3" />
                    </button>
                  )}
                  <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm sm:text-base font-semibold leading-tight">{chapter}</div>
                      {loadingMcqCounts ? (
                        <span className="shrink-0 h-4 w-10 bg-muted animate-pulse rounded-full" />
                      ) : typeof chapterMcqCounts?.[chapter] === "number" && (
                        <span className="shrink-0 text-[9px] sm:text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {chapterMcqCounts[chapter]} MCQ
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-xs text-primary font-medium mt-1 flex items-center">View Exams <ChevronRight className="h-3 w-3 ml-1" /></div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
      </div>
    );
  }

  // LEVEL 2.5: Board/Category selection — only shown if this chapter has boards
  if (!selectedBoardStep && chapterBoards && chapterBoards.length > 0) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedChapter(null)} className="pl-0 h-8"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Chapters</Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{selectedSubject}</span><ChevronRight className="h-3 w-3" /><span>{selectedChapter}</span>
        </div>
        <h2 className="text-base font-bold">Select Board / Category</h2>
        {loadingChapterBoards ? <div className="text-muted-foreground">Loading boards...</div> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            {chapterBoards.map(board => (
              <Card key={board} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => setSelectedBoardStep(board)}>
                <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm sm:text-base font-semibold leading-tight">{board}</div>
                    {loadingMcqCounts ? (
                      <span className="shrink-0 h-4 w-10 bg-muted animate-pulse rounded-full" />
                    ) : typeof boardMcqCounts?.[`${selectedChapter}||${board}`] === "number" && (
                      <span className="shrink-0 text-[9px] sm:text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {boardMcqCounts[`${selectedChapter}||${board}`]} MCQ
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-xs text-primary font-medium mt-1 flex items-center">View <ChevronRight className="h-3 w-3 ml-1" /></div>
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
        <Button variant="ghost" size="sm" onClick={() => {
          if (selectedBoardStep && chapterBoards && chapterBoards.length > 0) setSelectedBoardStep(null);
          else setSelectedChapter(null);
        }} className="pl-0 h-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> {selectedBoardStep ? "Back to Boards" : "Back to Chapters"}
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>{selectedSubject}</span><ChevronRight className="h-3 w-3" /><span>{selectedChapter}</span>
          {selectedBoardStep && <><ChevronRight className="h-3 w-3" /><span>{selectedBoardStep}</span></>}
        </div>
        <h2 className="text-base font-bold">Select Session / Year</h2>
        {loadingSubChapters ? <div className="text-muted-foreground">Loading sessions...</div> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            {subChapters.map(sc => {
              const scCount = subChapterMcqCounts?.[`${selectedChapter}||${sc}`];
              const scUnlocked = subChapterUnlockMap[sc];
              return (
              <Card key={sc} className={`relative cursor-pointer hover:border-primary/50 transition-all hover:shadow-md ${!scUnlocked ? "opacity-80" : ""}`} onClick={() => setSelectedSubChapter(sc)}>
                {!scUnlocked && (
                  <div className="absolute inset-0 z-[1] flex items-center justify-center overflow-hidden pointer-events-none select-none">
                    <span className="text-lg sm:text-xl font-black text-foreground/15 rotate-[-20deg] tracking-widest whitespace-nowrap">LOCKED</span>
                  </div>
                )}
                {!scUnlocked && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toast({ title: "Locked", description: `"${sc}" সেশনে আপনার এক্সেস নেই। ভর্তি হলে আনলক হয়ে যাবে।` }); }}
                    className="absolute bottom-1.5 right-1.5 z-10 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full p-1"
                  >
                    <Lock className="h-3 w-3" />
                  </button>
                )}
                <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm sm:text-base font-semibold leading-tight">{sc}</div>
                    {loadingMcqCounts ? (
                      <span className="shrink-0 h-4 w-10 bg-muted animate-pulse rounded-full" />
                    ) : typeof scCount === "number" && (
                      <span className="shrink-0 text-[9px] sm:text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {scCount} MCQ
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-xs text-primary font-medium mt-1 flex items-center">View Exams <ChevronRight className="h-3 w-3 ml-1" /></div>
                </CardContent>
              </Card>
              );
            })}
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
        else if (selectedBoardStep && chapterBoards && chapterBoards.length > 0) setSelectedBoardStep(null);
        else setSelectedChapter(null);
      }} className="pl-0 h-8">
        <ArrowLeft className="mr-2 h-4 w-4" /> {selectedSubChapter ? "Back to Sessions" : selectedBoardStep ? "Back to Boards" : "Back to Chapters"}
      </Button>
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>{selectedSubject}</span>
          <ChevronRight className="h-3 w-3" />
          <span>{selectedChapter}</span>
          {selectedBoardStep && <><ChevronRight className="h-3 w-3" /><span>{selectedBoardStep}</span></>}
          {selectedSubChapter && <><ChevronRight className="h-3 w-3" /><span>{selectedSubChapter}</span></>}
        </div>
        <h2 className="text-base font-bold mt-0.5">Available Readymade Exams</h2>
      </div>

      {loadingExams || loadingEnrollments ? (
        <div className="text-muted-foreground">Loading exams...</div>
      ) : !exams || exams.length === 0 ? (
        <div className="text-muted-foreground">No exams found.</div>
      ) : (
        <ExamGrid exams={exams} navigate={navigate} enrolledIds={enrolledIds} fullAccessCourseIds={fullAccessCourseIds} subChapterGrants={subChapterGrants} onLockedClick={setLockedExam} isAdmin={isAdmin} />
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
    // Always check (not just when opened) so we know up front whether this
    // exam has any splits at all — the toggle button itself should only
    // render for exams the admin has actually split.
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

  // Nothing to show — this exam hasn't been split by admin, so don't render
  // the "ভেঙে ভেঙে পরীক্ষা দাও" toggle at all for regular students.
  // Admins still see it (as a loading/empty state) so they know the feature
  // exists and can use the "Split" button to create some.
  if (!isLoading && (!splits || splits.length === 0) && !isAdmin) {
    return null;
  }

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
const ExamGrid = ({ exams, navigate, enrolledIds = [], fullAccessCourseIds = [], subChapterGrants = new Set<string>(), onLockedClick, isAdmin = false }: { exams: any[], navigate: any, enrolledIds?: string[], fullAccessCourseIds?: string[], subChapterGrants?: Set<string>, onLockedClick?: (exam: any) => void, isAdmin?: boolean }) => {
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
      const unlocked = isExamUnlocked(exam, enrolledIds, fullAccessCourseIds, subChapterGrants);
      return (
        <Card key={exam.id} className={`relative cursor-pointer transition-all hover:shadow-md group ${unlocked ? "hover:border-primary/50" : "border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10"}`}
          onClick={() => {
            if (!unlocked) { onLockedClick?.(exam); return; }
            setExamSourceList(exam.id, "/dashboard/readymade");
            navigate(`/dashboard/take-exam/${exam.id}`);
          }}>
          {!unlocked && (
            <div className="absolute inset-0 z-[1] flex items-center justify-center overflow-hidden pointer-events-none select-none">
              <span className="text-xl sm:text-2xl font-black text-muted-foreground/10 rotate-[-20deg] tracking-widest whitespace-nowrap">LOCKED</span>
            </div>
          )}
          {!unlocked && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toast({ title: "Locked", description: `"${exam.title}" পরীক্ষায় আপনার এক্সেস নেই। ভর্তি হলে আনলক হয়ে যাবে।` }); }}
              className="absolute bottom-1.5 right-1.5 z-10 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full p-1"
            >
              <Lock className="h-3 w-3" />
            </button>
          )}
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
                    className="h-7 px-2 text-[11px] bg-blue-500 hover:bg-blue-600 text-white hover:text-white"
                    disabled={downloadingId === exam.id}
                    onClick={(e) => handleDownloadPdf(e, exam)}
                  >
                    {downloadingId === exam.id ? "..." : "Practice Sheet"}
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


export default Readymade;
