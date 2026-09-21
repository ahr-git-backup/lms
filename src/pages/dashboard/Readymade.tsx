import { useState, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import MathText from "@/components/MathText";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ExamForm } from "@/components/admin/ExamForm";
import { ArrowLeft, Trophy, Clock, CheckCircle, ChevronRight, Search, ChevronLeft, LayoutTemplate, X, Lock, Sparkles, FileDown, Plus, Pencil, Trash2, History, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openSolvePdf } from "@/lib/solvePdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useNavigate, useNavigationType, useParams } from "react-router-dom";
import { setExamSourceList } from "@/lib/examSourceTracker";
import { useAuth } from "@/contexts/AuthContext";
import { CourseItemsManagerDialog } from "@/components/admin/CourseItemsManagerDialog";
import { generateAndCacheExplanationWithMeta } from "@/components/exam/AiMcqHelper";
import { SpFinalManager } from "@/components/admin/SpFinalManager";
import { ModelTestManager } from "@/components/admin/ModelTestManager";
import { ChapterSortDialog } from "@/components/admin/ChapterSortDialog";
import { SubjectSortDialog } from "@/components/admin/SubjectSortDialog";
import ErrorBoundary from "@/components/ErrorBoundary";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import { PayDueDialog } from "@/components/PayDueDialog";

const PAGE_SIZE = 15;

// QuizBot base URL and shared secret for the /api/lms-send-channel endpoint
// (sends an exam's questions as Telegram polls via the bot's existing /csv
// pipeline). The secret must match QuizBot's LMS_API_SECRET env var.
const QUIZBOT_API_BASE = "https://quizbot.pages.dev";
const QUIZBOT_API_SECRET = "001b72896f99e070168d2e48a8c4710b";

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
// Sentinel used for "this subject has no chapters" — lets the same drill-down
// state (`selectedChapter`) represent both a real chapter name and the
// chapterless case, so downstream Board/SubChapter/Exam queries reuse one code path.
const NO_CHAPTER = "__NO_CHAPTER__";

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
const PremiumLockDialog = ({ exam, onClose, navigate, overdueInfo }: { exam: any; onClose: () => void; navigate: any; overdueInfo?: { id: string; dueAmount: number; dueDate: string; amountPaid: number } | null }) => {
  const courseId = exam?.course_id;
  const [payDueOpen, setPayDueOpen] = useState(false);
  if (overdueInfo) {
    return (
      <Dialog open={!!exam} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-center">বকেয়া পেমেন্টের কারণে অ্যাক্সেস বন্ধ</DialogTitle>
            <DialogDescription className="text-center">
              এই কোর্সের বাকি টাকা পরিশোধের নির্ধারিত তারিখ পার হয়ে গেছে।
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-red-500/30 bg-red-50/50 dark:bg-red-950/20 p-3 text-sm space-y-1.5">
            <p className="flex justify-between"><span className="text-muted-foreground">বাকি টাকা:</span><span className="font-semibold text-red-700 dark:text-red-400">৳{overdueInfo.dueAmount - overdueInfo.amountPaid}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">দেওয়ার শেষ তারিখ ছিল:</span><span className="font-semibold text-red-700 dark:text-red-400">{new Date(overdueInfo.dueDate).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" })}</span></p>
          </div>
          <p className="text-xs text-center text-muted-foreground">বাকি টাকা পরিশোধ করলেই আবার সব এক্সেস চালু হয়ে যাবে।</p>
          <div className="flex flex-col gap-2 mt-1">
            <Button className="w-full" onClick={() => setPayDueOpen(true)}>বাকি টাকা পরিশোধ করুন</Button>
            <WhatsAppSupportButton message="আমার কোর্সের বাকি টাকা নিয়ে সমস্যা আছে।" className="w-full" />
          </div>
          <PayDueDialog
            open={payDueOpen}
            onClose={() => setPayDueOpen(false)}
            paymentRequestId={overdueInfo.id}
            remainingDue={overdueInfo.dueAmount - overdueInfo.amountPaid}
          />
        </DialogContent>
      </Dialog>
    );
  }
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
  // Purely visual: which zone pill was tapped most recently, for a brief
  // pressed/active highlight since these pills now scroll-to-zone instead
  // of toggling a filter.
  const [activeZonePill, setActiveZonePill] = useState<string | null>(null);
  // Tracks the zone element + its removal timer currently mid-flash, so a
  // second pill tap cancels the previous zone's blink immediately instead
  // of two zones blinking at once.
  const flashingZoneRef = useRef<{ el: HTMLElement; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [addQuestionCategory, setAddQuestionCategory] = useState<string | null>(null);
  const [spFinalManagerOpen, setSpFinalManagerOpen] = useState(false);
  const [modelTestManagerOpen, setModelTestManagerOpen] = useState(false);
  const [modelTestModePanelOpen, setModelTestModePanelOpen] = useState(false);
  const { data: modelTestModes } = useQuery({
    queryKey: ["model-test-modes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("model_test_modes").select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as { mode_key: string; label: string }[];
    },
    enabled: modelTestModePanelOpen,
  });
  const [startingModelTest, setStartingModelTest] = useState(false);
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
    <div className="space-y-2 readymade-page -mx-4 px-1.5 sm:mx-0 sm:px-0">
      <ErrorBoundary label="Readymade header">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Readymade Exam</h1>
        <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={() => navigate("/dashboard/readymade/history")}>
          <History className="h-3.5 w-3.5" /> Your History
        </Button>
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
          <button
            type="button"
            onClick={() => { try { sessionStorage.removeItem("customExamBuilderState"); } catch { /* ignore */ } navigate("/dashboard/readymade/custom-exam"); }}
            className="rounded-xl border-2 border-border hover:border-primary/40 p-3 text-center transition-all"
          >
            <Sparkles className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-semibold leading-tight">এক্সাম বানাও</p>
          </button>
          <button
            type="button"
            onClick={() => { if (isAdmin) { setSpFinalManagerOpen(true); } else { navigate("/dashboard/readymade/subject-paper-final"); } }}
            className="rounded-xl border-2 p-3 text-center transition-all border-border hover:border-primary/40"
          >
            <LayoutTemplate className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-semibold leading-tight">সাবজেক্ট/পেপার ফাইনাল</p>
          </button>
          <button
            type="button"
            disabled={startingModelTest}
            onClick={() => {
              if (isAdmin) { setModelTestManagerOpen(true); return; }
              setModelTestModePanelOpen(true);
            }}
            className="rounded-xl border-2 p-3 text-center transition-all border-border hover:border-primary/40 disabled:opacity-60"
          >
            <FileDown className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-semibold leading-tight">মডেল টেস্ট বানাও</p>
          </button>
        </div>
      )}

      {isAdmin && <SpFinalManager open={spFinalManagerOpen} onOpenChange={setSpFinalManagerOpen} />}
      {isAdmin && <ModelTestManager open={modelTestManagerOpen} onOpenChange={setModelTestManagerOpen} />}

      <Dialog open={modelTestModePanelOpen} onOpenChange={(o) => { if (!startingModelTest) setModelTestModePanelOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>মডেল টেস্ট — মেডিকেল</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">Difficulty মোড বেছে নিন</p>
          <div className="grid grid-cols-1 gap-3">
            {modelTestModes?.map((m) => (
              <Button
                key={m.mode_key}
                variant="outline"
                disabled={startingModelTest}
                className="h-auto py-3 justify-between"
                onClick={async () => {
                  setStartingModelTest(true);
                  try {
                    const { data: examId, error } = await supabase.rpc("create_model_test_exam", { p_mode: m.mode_key });
                    if (error) throw error;
                    setModelTestModePanelOpen(false);
                    navigate(`/dashboard/take-exam/${examId}`);
                  } catch (err: any) {
                    toast({ title: "শুরু করা যায়নি", description: err?.message || "আবার চেষ্টা করুন।", variant: "destructive" });
                  } finally {
                    setStartingModelTest(false);
                  }
                }}
              >
                <span className="font-semibold">{m.label}</span>
                {startingModelTest && <Loader2 className="h-4 w-4 animate-spin" />}
              </Button>
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
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <Button
            variant={selectedParentTopics.length === 0 ? "default" : "secondary"}
            size="sm"
            className="rounded-full shadow-sm text-[11px] sm:text-xs min-h-7 sm:min-h-8 h-auto px-2 py-1 hover:scale-105 transition-transform whitespace-normal break-words text-center leading-tight"
            onClick={() => { setPage(0); setSelectedParentTopics([]); setSelectedBoards([]); }}
          >
            All
          </Button>
          {parentTopics.map(topic => (
            <Button
              key={topic.value}
              variant={activeZonePill === topic.value ? "default" : "secondary"}
              size="sm"
              className={`rounded-full shadow-sm text-[11px] sm:text-xs h-auto min-h-7 sm:min-h-8 py-1 px-2 hover:scale-105 active:scale-95 transition-transform leading-tight whitespace-normal break-words text-center ${activeZonePill === topic.value ? "ring-2 ring-primary/40" : ""}`}
              onClick={() => {
                // Visual click feedback (pill turns active/green briefly).
                setActiveZonePill(topic.value);
                setTimeout(() => setActiveZonePill(prev => (prev === topic.value ? null : prev)), 1200);
                // Scroll smoothly to this zone's section instead of hard-filtering.
                const el = document.getElementById(`zone-${encodeURIComponent(topic.value)}`);
                if (el) {
                  // Only the most-recently-tapped zone should blink — cancel
                  // any zone still mid-flash from an earlier tap first.
                  if (flashingZoneRef.current) {
                    clearTimeout(flashingZoneRef.current.timer);
                    flashingZoneRef.current.el.classList.remove("zone-flash");
                  }
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  // Force reflow so re-clicking the same zone restarts the
                  // animation instead of no-op'ing (class already present).
                  void el.offsetWidth;
                  el.classList.add("zone-flash");
                  const timer = setTimeout(() => {
                    el.classList.remove("zone-flash");
                    if (flashingZoneRef.current?.el === el) flashingZoneRef.current = null;
                  }, 5000);
                  flashingZoneRef.current = { el, timer };
                }
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
          boardFilter={selectedBoardStep}
          parentTopicsFilter={selectedParentTopics}
          boardsFilter={selectedBoards}
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

  // Overdue-due-payment students are excluded from enrolledIds here — they
  // still see the exam card (course shows in the list normally) but the
  // "Start" button/access checks (isExamUnlocked) treat them as not enrolled,
  // same as PremiumLockDialog for an unpaid student.
  const enrolledIds: string[] = enrollments?.filter((e: any) => !e.is_payment_overdue).map((e: any) => e.course_id) || [];
  const fullAccessCourseIds: string[] = enrollments?.filter((e: any) => !e.is_payment_overdue && e.course?.readymade_full_access).map((e: any) => e.course_id) || [];
  const getOverdueInfo = (courseId: string | undefined) => {
    if (!courseId) return null;
    const e = enrollments?.find((en: any) => en.course_id === courseId && en.is_payment_overdue);
    return e?.overdue_info || null;
  };

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
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 2 * 60 * 1000,
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
    queryKey: ["readymade-exams-subjects", enrolledIds.join(','), selectedParentTopics, selectedBoards, fullAccessCourseIds.join(','), subChapterGrants ? subChapterGrants.size : 0],
    queryFn: async () => {
      const data = await fetchAllRows<{ subject: any; course_id: string | null; shared_course_ids: string[] | null; readymade_course_ids: string[] | null; chapter: string | null; readymade_sub_chapter: string | null; is_visible_on_free: boolean | null; readymade_topic: string | null }>((from, to) => {
        let query = supabase.from("exams").select("subject, course_id, shared_course_ids, readymade_course_ids, chapter, readymade_sub_chapter, is_visible_on_free, readymade_topic")
          .eq("is_readymade", true).eq("is_published", true).range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        return query;
      });
      const unique = new Set<string>();
      const subjectCourseIds: Record<string, Set<string>> = {};
      const unlockMap: Record<string, boolean> = {};
      // Track which parent-topic "zone" each subject belongs to, in first-seen
      // order, so the subject grid can be grouped/sectioned by zone.
      const subjectZones: Record<string, string> = {};
      const zoneOrder: string[] = [];
      data.forEach((row: any) => {
        const subs: string[] = Array.isArray(row.subject) ? row.subject : (typeof row.subject === 'string' ? [row.subject] : []);
        const zone: string = row.readymade_topic || "";
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
          if (zone && !subjectZones[s]) {
            subjectZones[s] = zone;
            if (!zoneOrder.includes(zone)) zoneOrder.push(zone);
          }
        });
      });
      const { data: settingsData } = await supabase.from("app_settings").select("value").eq("key", "subject_order_global").maybeSingle();
      const savedOrder: string[] = settingsData?.value ? (settingsData.value as string[]) : [];
      const { data: hiddenData } = await supabase.from("app_settings").select("value").eq("key", "subject_hidden_global").maybeSingle();
      const hiddenList: string[] = hiddenData?.value ? (hiddenData.value as string[]) : [];
      const hiddenSet = new Set<string>(hiddenList);
      // Admin-configured zone display order and row-clustering (which zones
      // sit side-by-side), set via Manage Subject Position -> Zone Layout.
      const [{ data: zoneOrderRow }, { data: zoneRowsRow }] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "readymade_zone_order_global").maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "readymade_zone_rows_global").maybeSingle(),
      ]);
      const savedZoneOrder: string[] = zoneOrderRow?.value ? (zoneOrderRow.value as string[]) : [];
      const savedZoneRows: string[][] = zoneRowsRow?.value ? (zoneRowsRow.value as string[][]) : [];
      // Students never see hidden subjects. Admins see everything (hidden ones
      // dimmed, with a toggle) so they can find and unhide a subject again.
      const allSubjects = Array.from(unique);
      const visible = isAdmin ? allSubjects : allSubjects.filter((s) => !hiddenSet.has(s));
      const sortedSubjects = visible.sort((a, b) => {
        const uA = unlockMap[a] || false, uB = unlockMap[b] || false;
        if (uA !== uB) return uA ? -1 : 1; // Unlocked subjects float to the top.
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        return a.localeCompare(b);
      });
      // Group subjects by zone (parent topic). Zone display order follows the
      // admin-saved zone order when present, falling back to first-seen order;
      // any zone not in the saved order is appended at the end (before "").
      const orderedZones = savedZoneOrder.length > 0
        ? [...savedZoneOrder.filter(z => zoneOrder.includes(z)), ...zoneOrder.filter(z => !savedZoneOrder.includes(z))]
        : zoneOrder;
      const zoneGroups: { zone: string; subjects: string[] }[] = [];
      const zonesInUse = [...orderedZones, ""];
      zonesInUse.forEach(zone => {
        const inZone = sortedSubjects.filter(s => (subjectZones[s] || "") === zone);
        if (inZone.length > 0) zoneGroups.push({ zone, subjects: inZone });
      });
      const courseIdsBySubject: Record<string, string[]> = {};
      Object.entries(subjectCourseIds).forEach(([s, ids]) => { courseIdsBySubject[s] = Array.from(ids); });
      return { subjects: sortedSubjects, zoneGroups, zoneRows: savedZoneRows, courseIdsBySubject, unlockMap, hiddenSet };
    },
    enabled: !selectedSubject && !searchQuery
  });

  const subjects = subjectsResult?.subjects;
  const subjectZoneGroups = subjectsResult?.zoneGroups || [];
  const subjectZoneRows = subjectsResult?.zoneRows || [];
  const hiddenSubjects = subjectsResult?.hiddenSet || new Set<string>();
  const isSubjectUnlocked = (subject: string): boolean => {
    if (isAdmin) return true;
    return !!subjectsResult?.unlockMap?.[subject];
  };

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
    queryKey: ["readymade-exams-chapters", selectedSubject, enrolledIds.join(','), selectedParentTopics, selectedBoards, fullAccessCourseIds.join(','), subChapterGrants ? subChapterGrants.size : 0],
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
      const examCountMap: Record<string, number> = {};
      const settingsKey = `chapter_order_global_${selectedSubject}`;
      const { data: sd } = await supabase.from("app_settings").select("value").eq("key", settingsKey).maybeSingle();
      const savedOrder: string[] = sd?.value ? (sd.value as string[]) : [];
      data.forEach((row: any) => {
        if (row.chapter) {
          unique.add(row.chapter);
          examCountMap[row.chapter] = (examCountMap[row.chapter] || 0) + 1;
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
        const uA = unlockMap[a] || false, uB = unlockMap[b] || false;
        if (uA !== uB) return uA ? -1 : 1; // Unlocked chapters float to the top.
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        const oA = orderMap.get(a) || 0, oB = orderMap.get(b) || 0;
        if (oA !== oB) return oB - oA;
        return a.localeCompare(b);
      });
      return { chapters, unlockMap, examCountMap };
    },
    enabled: !!selectedSubject && !selectedChapter && !searchQuery
  });
  const chapters = chaptersResult?.chapters;
  const chapterUnlockMap = chaptersResult?.unlockMap || {};
  const chapterExamCountMap = chaptersResult?.examCountMap || {};

  useEffect(() => { if (chapters) setCurrentChaptersList(chapters); }, [chapters, setCurrentChaptersList]);
  useEffect(() => { if (subjects) setCurrentSubjectsList(subjects); }, [subjects, setCurrentSubjectsList]);
  // Subject has no chapters at all — skip straight past the chapter grid to
  // whichever next step actually has content (boards → sub-chapters → exams),
  // exactly like the existing board/sub-chapter auto-skip below. Must run
  // unconditionally (before any early `return`) to keep hook order stable.
  useEffect(() => {
    if (selectedSubject && !selectedChapter && !loadingChapters && chapters && chapters.length === 0) {
      setSelectedChapter(NO_CHAPTER);
    }
  }, [selectedSubject, selectedChapter, loadingChapters, chapters, setSelectedChapter]);

  // Per-chapter MCQ counts now come from the same get_readymade_mcq_counts
  // RPC call above (chapterMcqCounts), no separate query needed.

  // --- OVERALL STATS (Total Exams / User Attempted / Total MCQs) ---
  const { data: overallStats } = useQuery({
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
  const { data: chapterBoardsResult, isLoading: loadingChapterBoards } = useQuery({
    queryKey: ["readymade-exams-chapter-boards", selectedSubject, selectedChapter, enrolledIds.join(','), selectedParentTopics, selectedBoards],
    queryFn: async () => {
      if (!selectedSubject || !selectedChapter) return [];
      const data = await fetchAllRows<{ readymade_category: string | null }>((from, to) => {
        let query = supabase.from("exams")
          .select("readymade_category")
          .eq("is_readymade", true).eq("is_published", true)
          .contains("subject", [selectedSubject])
          [selectedChapter === NO_CHAPTER ? "is" : "eq"]("chapter", selectedChapter === NO_CHAPTER ? null : selectedChapter)
          .not("readymade_category", "is", null)
          .range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
        if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        return query;
      });
      const unique = new Set<string>();
      const examCountMap: Record<string, number> = {};
      data.forEach((row: any) => {
        if (row.readymade_category) {
          unique.add(row.readymade_category);
          examCountMap[row.readymade_category] = (examCountMap[row.readymade_category] || 0) + 1;
        }
      });
      const settingsKey = `board_order_global_${selectedSubject}_${selectedChapter}`;
      const { data: sd } = await supabase.from("app_settings").select("value").eq("key", settingsKey).maybeSingle();
      const savedOrder: string[] = sd?.value ? (sd.value as string[]) : [];
      const boards = Array.from(unique).sort((a, b) => {
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        return a.localeCompare(b);
      });
      return { boards, examCountMap };
    },
    enabled: !!selectedSubject && !!selectedChapter && !selectedBoardStep && !searchQuery
  });
  const chapterBoards = chapterBoardsResult?.boards;
  const boardExamCountMap = chapterBoardsResult?.examCountMap || {};

  // --- LEVEL 3: SUB-CHAPTERS (readymade_sub_chapter) ---
  const { data: subChaptersResult, isLoading: loadingSubChapters } = useQuery({
    queryKey: ["readymade-exams-subchapters", selectedSubject, selectedChapter, selectedBoardStep, enrolledIds.join(','), selectedParentTopics, selectedBoards, fullAccessCourseIds.join(','), subChapterGrants ? subChapterGrants.size : 0],
    queryFn: async () => {
      if (!selectedSubject || !selectedChapter) return { subChapters: [], unlockMap: {} as Record<string, boolean> };
      const data = await fetchAllRows<{ readymade_sub_chapter: string | null; course_id: string | null; shared_course_ids: string[] | null; readymade_course_ids: string[] | null }>((from, to) => {
        let query = supabase.from("exams")
          .select("readymade_sub_chapter, course_id, shared_course_ids, readymade_course_ids")
          .eq("is_readymade", true).eq("is_published", true)
          .contains("subject", [selectedSubject])
          [selectedChapter === NO_CHAPTER ? "is" : "eq"]("chapter", selectedChapter === NO_CHAPTER ? null : selectedChapter)
          .not("readymade_sub_chapter", "is", null)
          .range(from, to);
        if (selectedParentTopics?.length > 0) query = query.in("readymade_topic", selectedParentTopics);
      if (selectedBoards?.length > 0) query = query.in("readymade_category", selectedBoards);
        if (selectedBoardStep) query = query.eq("readymade_category", selectedBoardStep);
        return query;
      });
      const unique = new Set<string>();
      const unlockMap: Record<string, boolean> = {};
      const examCountMap: Record<string, number> = {};
      data.forEach((row: any) => {
        if (row.readymade_sub_chapter) {
          unique.add(row.readymade_sub_chapter);
          examCountMap[row.readymade_sub_chapter] = (examCountMap[row.readymade_sub_chapter] || 0) + 1;
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
        const uA = unlockMap[a] || false, uB = unlockMap[b] || false;
        if (uA !== uB) return uA ? -1 : 1; // Unlocked sub-chapters float to the top.
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        return a.localeCompare(b);
      });
      return { subChapters, unlockMap, examCountMap };
    },
    enabled: !!selectedSubject && !!selectedChapter && !selectedSubChapter && !searchQuery
      && (!!selectedBoardStep || chapterBoards?.length === 0)
  });
  const subChapters = subChaptersResult?.subChapters;
  useEffect(() => { if (chapterBoards) setCurrentBoardsList(chapterBoards); }, [chapterBoards, setCurrentBoardsList]);
  useEffect(() => { if (subChapters) setCurrentSubChaptersList(subChapters); }, [subChapters, setCurrentSubChaptersList]);
  const subChapterUnlockMap = subChaptersResult?.unlockMap || {};
  const subChapterExamCountMap = subChaptersResult?.examCountMap || {};

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
        .contains("subject", [selectedSubject])
        [selectedChapter === NO_CHAPTER ? "is" : "eq"]("chapter", selectedChapter === NO_CHAPTER ? null : selectedChapter)
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
    return <div className="space-y-3"><PremiumLockDialog exam={lockedExam} onClose={() => setLockedExam(null)} navigate={navigate} overdueInfo={getOverdueInfo(lockedExam?.course_id)} /><ExamGrid exams={exams} navigate={navigate} enrolledIds={enrolledIds} fullAccessCourseIds={fullAccessCourseIds} subChapterGrants={subChapterGrants} onLockedClick={setLockedExam} isAdmin={isAdmin} /></div>;
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
        <PremiumLockDialog exam={lockedExam} onClose={() => setLockedExam(null)} navigate={navigate} overdueInfo={getOverdueInfo(lockedExam?.course_id)} />
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-2 flex flex-col items-center text-center gap-0.5">
              <span className="text-[10px] text-muted-foreground leading-tight">Total Exams</span>
              <span className="text-base font-bold text-blue-600 leading-tight">{overallStats ? overallStats.totalExams : "—"}</span>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-2 flex flex-col items-center text-center gap-0.5">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 leading-tight">দিয়েছো: {overallStats ? overallStats.attemptedCount : "—"} টি</span>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 leading-tight">বাকি: {overallStats ? overallStats.remaining : "—"} টি</span>
            </CardContent>
          </Card>
          <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-2 flex flex-col items-center text-center gap-0.5">
              <span className="text-[10px] text-muted-foreground leading-tight">Total MCQ</span>
              <span className="text-base font-bold text-amber-600 leading-tight">{overallStats ? overallStats.totalMcqs : "—"}</span>
            </CardContent>
          </Card>
        </div>
        {(() => {
          const renderSubjectCard = (subject: string, compact = false) => {
            const unlocked = isSubjectUnlocked(subject);
            const isHidden = hiddenSubjects.has(subject);
            return (
              <Card
                key={subject}
                className={`relative overflow-hidden transition-all cursor-pointer border-2 border-primary/60 hover:border-primary shadow-sm hover:shadow-md h-full w-full flex flex-col bg-secondary ${!unlocked ? "opacity-80" : ""} ${isHidden ? "opacity-50 border-dashed" : ""}`}
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
                <CardContent className={`${compact ? "px-1.5 py-2 sm:px-4 sm:py-4" : "px-3 py-3 sm:px-4 sm:py-4"} flex-1 flex flex-col justify-center`}>
                  <div className="flex items-center justify-between mb-1 gap-1">
                    <span className={`${compact ? "text-[9px] sm:text-xs" : "text-[10px] sm:text-xs"} font-medium text-muted-foreground`}>Subject</span>
                    {loadingMcqCounts ? (
                      <span className="shrink-0 h-4 w-10 bg-muted animate-pulse rounded-full" />
                    ) : typeof subjectMcqCounts?.[subject] === "number" ? (
                      <span className={`${compact ? "text-[7px] sm:text-[10px] px-1 sm:px-1.5" : "text-[9px] sm:text-[10px] px-1.5"} shrink-0 font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 py-0.5 rounded-full whitespace-nowrap`}>
                        {subjectMcqCounts[subject]} MCQ
                      </span>
                    ) : (
                      <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </div>
                  <div className={`${compact ? "text-sm sm:text-xl" : "text-base sm:text-xl"} font-bold leading-tight whitespace-pre-line break-words ${unlocked ? "text-primary dark:text-white" : "text-muted-foreground"}`}>{subject}</div>
                  {isAdmin && isHidden && (
                    <div className="text-[9px] font-medium text-muted-foreground mt-0.5">Hidden from students</div>
                  )}
                </CardContent>
              </Card>
            );
          };

          const hasZones = subjectZoneGroups.length > 1 || (subjectZoneGroups.length === 1 && subjectZoneGroups[0].zone !== "");
          if (!hasZones) {
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                {subjects.map(renderSubjectCard)}
              </div>
            );
          }

          // Cluster zones into rows using the admin-configured row-groups
          // (Manage Subject Position -> Zone Layout). A zone not listed in
          // any saved row-group renders as its own full-width section.
          type Cluster = { kind: "row"; groups: typeof subjectZoneGroups } | { kind: "normal"; group: typeof subjectZoneGroups[number] };
          const clusters: Cluster[] = [];
          const consumedZones = new Set<string>();
          subjectZoneGroups.forEach((g) => {
            if (!g.zone || consumedZones.has(g.zone)) return;
            const rowDef = subjectZoneRows.find((row) => row.includes(g.zone));
            if (rowDef && rowDef.length > 1) {
              const groupsInRow = rowDef
                .map((z) => subjectZoneGroups.find((gg) => gg.zone === z))
                .filter((gg): gg is typeof subjectZoneGroups[number] => !!gg);
              if (groupsInRow.length > 1) {
                clusters.push({ kind: "row", groups: groupsInRow });
                groupsInRow.forEach((gg) => consumedZones.add(gg.zone));
                return;
              }
            }
            clusters.push({ kind: "normal", group: g });
            consumedZones.add(g.zone);
          });
          // Zones with no readymade_topic ("") always render standalone, in order.
          subjectZoneGroups.filter((g) => !g.zone).forEach((g) => clusters.push({ kind: "normal", group: g }));

          const renderZoneBox = (zone: string, zoneSubjects: string[], extraClass = "", compactGrid = false) => (
            <div
              key={zone || "__none__"}
              id={zone ? `zone-${encodeURIComponent(zone)}` : undefined}
              className={`rounded-xl border transition-colors duration-300 h-full flex flex-col w-full ${zone ? `border-2 border-red-500/50 shadow-sm ${compactGrid ? "p-1 sm:p-3" : "p-1.5 sm:p-3"}` : "border-transparent"} ${extraClass}`}
            >
              {zone && (
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[11px] sm:text-xs font-semibold text-white px-2.5 py-1 rounded-full bg-red-600 border border-red-700 whitespace-nowrap">
                    {zone}
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
              )}
              <div className={`grid items-stretch flex-1 gap-1 sm:gap-4 ${
                compactGrid || zoneSubjects.length === 1
                  ? "grid-cols-1"
                  : zoneSubjects.length === 3
                    ? "grid-cols-3"
                    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
              } ${!compactGrid && zoneSubjects.length === 2 ? "!grid-cols-2" : ""}`}>
                {zoneSubjects.map((s, si) => {
                  const n = zoneSubjects.length;
                  const cols = 2; // mobile columns for 4+
                  const lastAlone = !compactGrid && n > 3 && n % cols === 1 && si === n - 1;
                  return (
                    <div key={s} className={`flex min-w-0 ${lastAlone ? "col-span-2 sm:col-span-1" : ""}`}>
                      {renderSubjectCard(s, zoneSubjects.length === 3 || compactGrid)}
                    </div>
                  );
                })}
              </div>
            </div>
          );

          return (
            <div className="space-y-2">
              {clusters.map((c, ci) => {
                if (c.kind === "normal") {
                  return renderZoneBox(c.group.zone, c.group.subjects);
                }
                return (
                  <div key={`row-${ci}`} className="grid grid-cols-2 items-stretch gap-0.5 sm:gap-2 rounded-xl border-2 border-red-500/50 shadow-sm overflow-hidden">
                    {c.groups.map((g, gi) => (
                      <div key={g.zone} className="min-w-0 relative flex">
                        {renderZoneBox(g.zone, g.subjects, "border-none rounded-none h-full", true)}
                        {gi > 0 && (
                          <div className="absolute left-0 top-2 bottom-2 w-px bg-border" />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    );
  }

  // LEVEL 2: Chapter selection

  if (!selectedChapter) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedSubject(null)} className="pl-0 h-8"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects</Button>
        <h2 className="text-base font-bold whitespace-pre-line">{selectedSubject}</h2>
        {loadingChapters || (chapters && chapters.length === 0) ? <div className="text-muted-foreground">Loading chapters...</div>
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
                        <span className="shrink-0 text-[9px] sm:text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {chapterMcqCounts[chapter]} MCQ
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-xs text-primary font-medium mt-1 flex items-center">
                      View{typeof chapterExamCountMap[chapter] === "number" ? ` (${chapterExamCountMap[chapter]})` : ""} Exams <ChevronRight className="h-3 w-3 ml-1" />
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
      </div>
    );
  }

  const backFromChapter = () => {
    if (selectedChapter === NO_CHAPTER) setSelectedSubject(null);
    else setSelectedChapter(null);
  };

  // LEVEL 2.5: Board/Category selection — only shown if this chapter has boards
  if (!selectedBoardStep && chapterBoards && chapterBoards.length > 0) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={backFromChapter} className="pl-0 h-8"><ArrowLeft className="mr-2 h-4 w-4" /> {selectedChapter === NO_CHAPTER ? "Back to Subjects" : "Back to Chapters"}</Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{selectedSubject}</span>{selectedChapter !== NO_CHAPTER && (<><ChevronRight className="h-3 w-3" /><span>{selectedChapter}</span></>)}
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
                      <span className="shrink-0 text-[9px] sm:text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {boardMcqCounts[`${selectedChapter}||${board}`]} MCQ
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-xs text-primary font-medium mt-1 flex items-center">
                    View{typeof boardExamCountMap[board] === "number" ? ` (${boardExamCountMap[board]})` : ""} <ChevronRight className="h-3 w-3 ml-1" />
                  </div>
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
          else backFromChapter();
        }} className="pl-0 h-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> {selectedBoardStep ? "Back to Boards" : selectedChapter === NO_CHAPTER ? "Back to Subjects" : "Back to Chapters"}
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>{selectedSubject}</span>{selectedChapter !== NO_CHAPTER && (<><ChevronRight className="h-3 w-3" /><span>{selectedChapter}</span></>)}
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
                      <span className="shrink-0 text-[9px] sm:text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {scCount} MCQ
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-xs text-primary font-medium mt-1 flex items-center">
                    View{typeof subChapterExamCountMap[sc] === "number" ? ` (${subChapterExamCountMap[sc]})` : ""} Exams <ChevronRight className="h-3 w-3 ml-1" />
                  </div>
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
      <PremiumLockDialog exam={lockedExam} onClose={() => setLockedExam(null)} navigate={navigate} overdueInfo={getOverdueInfo(lockedExam?.course_id)} />
      <Button variant="ghost" size="sm" onClick={() => {
        if (selectedSubChapter && subChapters && subChapters.length > 0) setSelectedSubChapter(null);
        else if (selectedBoardStep && chapterBoards && chapterBoards.length > 0) setSelectedBoardStep(null);
        else backFromChapter();
      }} className="pl-0 h-8">
        <ArrowLeft className="mr-2 h-4 w-4" /> {selectedSubChapter ? "Back to Sessions" : selectedBoardStep ? "Back to Boards" : selectedChapter === NO_CHAPTER ? "Back to Subjects" : "Back to Chapters"}
      </Button>
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>{selectedSubject}</span>
          {selectedChapter !== NO_CHAPTER && (<><ChevronRight className="h-3 w-3" /><span>{selectedChapter}</span></>)}
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
const SplitExamToggle = ({ parentId, isAdmin, open, setOpen }: { parentId: string; isAdmin: boolean; open: boolean; setOpen: (v: boolean) => void }) => {
  const { data: splits, isLoading } = useQuery({
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
  });

  // Only show this toggle when the exam has actually been split.
  if (!isLoading && (!splits || splits.length === 0)) {
    return null;
  }
  if (isLoading) return null;

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-primary"
      onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
    >
      {open ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      <span className="ml-1">ভেঙে ভেঙে পরীক্ষা দাও</span>
    </Button>
  );
};

const SplitExamPanel = ({ parentId, navigate, isAdmin, listPath = "/dashboard/readymade", examPath = "/dashboard/take-exam" }: { parentId: string; navigate: any; isAdmin: boolean; listPath?: string; examPath?: string }) => {
  const { toast } = useToast();
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
    <div className="w-full space-y-1 border-l-2 border-primary/20 pl-2">
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
              setExamSourceList(s.id, listPath);
              navigate(`${examPath}/${s.id}`);
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
  );
};

// Shows "পুরো এক্সাম" + each distinct question-topic for an exam; picking one
// navigates to take-exam with ?topic= to restrict the question pool.
export const TopicPickerToggle = ({ examId, open, setOpen }: { examId: string; open: boolean; setOpen: (v: boolean) => void }) => {
  const { data: topics, isLoading } = useQuery({
    queryKey: ["exam-topics", examId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_exam_topics", { p_exam_id: examId });
      if (error) throw error;
      return (data || []) as { topic: string; mcq_count: number }[];
    },
  });

  // No per-question topics set for this exam — don't render the toggle at all.
  if (!isLoading && (!topics || topics.length === 0)) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2.5 text-[11px] font-bold bg-red-600 hover:bg-red-700 active:bg-red-700 focus:bg-red-600 text-white hover:text-white active:text-white focus:text-white focus-visible:text-white focus-visible:ring-0 rounded-full shadow-sm relative overflow-hidden animate-pulse"
      onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
    >
      <span className="absolute inset-0 rounded-full ring-2 ring-red-400/60 animate-ping pointer-events-none" />
      {open ? <ChevronLeft className="h-3.5 w-3.5 relative z-10" /> : <ChevronRight className="h-3.5 w-3.5 relative z-10" />}
      <span className="ml-1 relative z-10">টপিক ভিত্তিক পরীক্ষা</span>
    </Button>
  );
};

export const TopicPickerPanel = ({ examId, exam, navigate, isAdmin, openPracticeSheetPicker, listPath = "/dashboard/readymade", examPath = "/dashboard/take-exam" }: { examId: string; exam: any; navigate: any; isAdmin?: boolean; openPracticeSheetPicker: (e: React.MouseEvent, exam: any, topicFilter?: { topic: string; subtopic?: string }) => void; listPath?: string; examPath?: string }) => {
  // get_exam_topic_tree returns one row per (topic, subtopic) pair --
  // subtopic is null/"" for topics with no subtopics. Grouped client-side
  // into topic -> [subtopics] so a topic with subtopics expands into a
  // dropdown instead of navigating straight to take-exam.
  const { data: rows, isLoading } = useQuery({
    queryKey: ["exam-topic-tree", examId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_exam_topic_tree", { p_exam_id: examId });
      if (error) throw error;
      return (data || []) as { topic: string; subtopic: string | null; mcq_count: number; first_index: number }[];
    },
  });
  const [manageTopic, setManageTopic] = useState<string | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  const goTopic = (topic: string, subtopic?: string) => {
    setExamSourceList(examId, listPath);
    const params = new URLSearchParams({ topic });
    if (subtopic) params.set("subtopic", subtopic);
    navigate(`${examPath}/${examId}?${params.toString()}`);
  };

  // Group rows by topic, preserving first-appearance order (rows already
  // arrive ordered by first_index from the RPC).
  const topicGroups: { topic: string; mcq_count: number; subtopics: { subtopic: string; mcq_count: number }[] }[] = [];
  for (const r of rows || []) {
    let g = topicGroups.find(g => g.topic === r.topic);
    if (!g) {
      g = { topic: r.topic, mcq_count: 0, subtopics: [] };
      topicGroups.push(g);
    }
    g.mcq_count += r.mcq_count;
    if (r.subtopic) g.subtopics.push({ subtopic: r.subtopic, mcq_count: r.mcq_count });
  }

  return (
    <div className="w-full space-y-1 border-l-2 border-primary/20 pl-2">
      {isLoading ? (
        <div className="text-[11px] text-muted-foreground">Loading...</div>
      ) : topicGroups.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">No topics yet.</div>
      ) : (
        topicGroups.map((g) => (
          <div key={g.topic}>
            <div
              className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 cursor-pointer hover:bg-muted"
              onClick={() => g.subtopics.length > 0 ? setExpandedTopic(expandedTopic === g.topic ? null : g.topic) : goTopic(g.topic)}
            >
              <span className="text-xs font-medium flex items-center gap-1">
                {g.subtopics.length > 0 && (
                  expandedTopic === g.topic
                    ? <ChevronLeft className="h-3 w-3" />
                    : <ChevronRight className="h-3 w-3" />
                )}
                {g.topic} <span className="text-[10px] text-muted-foreground">({g.mcq_count} Q)</span>
              </span>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                    onClick={(e) => { e.stopPropagation(); setManageTopic(g.topic); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[9px] bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={(e) => openPracticeSheetPicker(e, exam, { topic: g.topic })}
                >
                  Sheet
                </Button>
                {g.subtopics.length === 0 && (
                  <Button size="sm" className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white">Start</Button>
                )}
              </div>
            </div>
            {g.subtopics.length > 0 && expandedTopic === g.topic && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-primary/10 pl-2">
                <div
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1 cursor-pointer hover:bg-muted"
                  onClick={() => goTopic(g.topic)}
                >
                  <span className="text-[11px]">সম্পূর্ণ {g.topic} <span className="text-[10px] text-muted-foreground">({g.mcq_count} Q)</span></span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1.5 text-[9px] bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={(e) => openPracticeSheetPicker(e, exam, { topic: g.topic })}
                    >
                      Sheet
                    </Button>
                    <Button size="sm" className="h-5 px-2 text-[9px] bg-blue-600 hover:bg-blue-700 text-white">Start</Button>
                  </div>
                </div>
                {g.subtopics.map((s) => (
                  <div
                    key={s.subtopic}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1 cursor-pointer hover:bg-muted"
                    onClick={() => goTopic(g.topic, s.subtopic)}
                  >
                    <span className="text-[11px]">{s.subtopic} <span className="text-[10px] text-muted-foreground">({s.mcq_count} Q)</span></span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[9px] bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={(e) => openPracticeSheetPicker(e, exam, { topic: g.topic, subtopic: s.subtopic })}
                      >
                        Sheet
                      </Button>
                      <Button size="sm" className="h-5 px-2 text-[9px] bg-blue-600 hover:bg-blue-700 text-white">Start</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
      {manageTopic && (
        <TopicManageDialog examId={examId} topic={manageTopic} onClose={() => setManageTopic(null)} />
      )}
    </div>
  );
};

// Admin-only, opened via pencil icon on a topic row: rename topic, edit/delete
// individual MCQs, add a new MCQ to the topic, or delete the whole topic.
const TopicManageDialog = ({ examId, topic, onClose }: { examId: string; topic: string; onClose: () => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [topicName, setTopicName] = useState(topic);
  const [renaming, setRenaming] = useState(false);
  const [editingQ, setEditingQ] = useState<any | null>(null);
  const [deletingDialogOpen, setDeletingDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: questions, isLoading, refetch } = useQuery({
    queryKey: ["topic-manage-questions", examId, topic],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_questions")
        .select("id, question_index, question_text, option_a, option_b, option_c, option_d, option_e, correct_option, topic")
        .eq("exam_id", examId)
        .eq("topic", topic)
        .order("question_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["exam-topics", examId] });
    queryClient.invalidateQueries({ queryKey: ["topic-manage-questions", examId] });
  };

  const handleRename = async () => {
    const newName = topicName.trim();
    if (!newName || newName === topic || !questions) return;
    setRenaming(true);
    try {
      const { error } = await supabase.from("exam_questions").update({ topic: newName }).eq("exam_id", examId).eq("topic", topic);
      if (error) throw error;
      invalidateAll();
      toast({ title: "Topic নাম আপডেট হয়েছে" });
      onClose();
    } catch (err: any) {
      toast({ title: "Rename করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteMcq = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("exam_questions").delete().eq("id", id);
      if (error) throw error;
      invalidateAll();
      refetch();
      toast({ title: "MCQ ডিলিট হয়েছে" });
    } catch (err: any) {
      toast({ title: "ডিলিট করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTopic = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("exam_questions").delete().eq("exam_id", examId).eq("topic", topic);
      if (error) throw error;
      invalidateAll();
      toast({ title: "Topic সম্পূর্ণ ডিলিট হয়েছে" });
      onClose();
    } catch (err: any) {
      toast({ title: "ডিলিট করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleAddMcq = async () => {
    try {
      const { data: maxRow } = await supabase
        .from("exam_questions")
        .select("question_index")
        .eq("exam_id", examId)
        .order("question_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextIndex = (maxRow?.question_index || 0) + 1;
      const { data, error } = await supabase
        .from("exam_questions")
        .insert({
          exam_id: examId,
          topic,
          question_index: nextIndex,
          question_text: "নতুন প্রশ্ন লিখুন",
          option_a: "Option A",
          option_b: "Option B",
          option_c: "Option C",
          option_d: "Option D",
          correct_option: "A",
        })
        .select()
        .single();
      if (error) throw error;
      invalidateAll();
      refetch();
      setEditingQ(data);
      toast({ title: "নতুন MCQ যোগ হয়েছে, এডিট করুন" });
    } catch (err: any) {
      toast({ title: "MCQ যোগ করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Topic ম্যানেজ করুন</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <Input
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
            className="h-8 text-xs flex-1 rounded-full px-3"
            placeholder="Topic নাম"
          />
          <Button size="sm" className="h-8 text-xs rounded-full" disabled={renaming || !topicName.trim() || topicName.trim() === topic} onClick={handleRename}>
            {renaming ? "..." : "নাম আপডেট"}
          </Button>
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <span className="text-xs text-muted-foreground">{questions?.length || 0} টি MCQ</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs rounded-full" onClick={handleAddMcq}>
              <Plus className="h-3.5 w-3.5 mr-1" /> নতুন MCQ
            </Button>
            {!deletingDialogOpen ? (
              <Button size="sm" variant="destructive" className="h-8 text-xs rounded-full" onClick={() => setDeletingDialogOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> পুরো Topic ডিলিট
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-destructive">নিশ্চিত?</span>
                <Button size="sm" variant="destructive" className="h-8 text-xs rounded-full" disabled={busy} onClick={handleDeleteTopic}>হ্যাঁ</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs rounded-full" onClick={() => setDeletingDialogOpen(false)}>না</Button>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="space-y-3 py-2">
            {(questions || []).map((q: any) => (
              <div key={q.id} className="p-3 rounded-xl border border-border/60 bg-card">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-muted-foreground">Q{q.question_index}</span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingQ(q)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" disabled={busy} onClick={() => handleDeleteMcq(q.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm font-medium mb-2"><MathText text={q.question_text} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(['a', 'b', 'c', 'd', 'e'] as const).map((k) => {
                    const val = q[`option_${k}`];
                    if (!val) return null;
                    const letter = k.toUpperCase();
                    return (
                      <div key={k} className={`p-2 rounded border ${q.correct_option === letter ? 'bg-green-100/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-muted/30'}`}>
                        <span className="font-semibold mr-2">{letter}.</span>
                        <MathText text={val} inline />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-border/60 sticky bottom-0 bg-background">
          <Button variant="outline" className="flex-1" onClick={onClose}>বন্ধ করুন</Button>
        </div>

        {editingQ && (
          <McqEditDialog
            question={editingQ}
            onClose={() => setEditingQ(null)}
            onSaved={() => { invalidateAll(); refetch(); setEditingQ(null); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

// Simple inline editor for a single MCQ's text/options/correct answer.
const McqEditDialog = ({ question, onClose, onSaved }: { question: any; onClose: () => void; onSaved: () => void }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    question_text: question.question_text || "",
    option_a: question.option_a || "",
    option_b: question.option_b || "",
    option_c: question.option_c || "",
    option_d: question.option_d || "",
    option_e: question.option_e || "",
    correct_option: question.correct_option || "A",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("exam_questions").update(form).eq("id", question.id);
      if (error) throw error;
      toast({ title: "MCQ আপডেট হয়েছে" });
      onSaved();
    } catch (err: any) {
      toast({ title: "সেভ করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>MCQ এডিট করুন</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <textarea
            className="w-full text-sm p-2 rounded border border-border/60 bg-background min-h-[70px]"
            value={form.question_text}
            onChange={(e) => setForm({ ...form, question_text: e.target.value })}
            placeholder="প্রশ্ন"
          />
          {(['a', 'b', 'c', 'd', 'e'] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-xs font-semibold w-5">{k.toUpperCase()}.</span>
              <Input
                className="h-8 text-xs flex-1"
                value={(form as any)[`option_${k}`]}
                onChange={(e) => setForm({ ...form, [`option_${k}`]: e.target.value })}
                placeholder={`Option ${k.toUpperCase()}`}
              />
              <Button
                type="button"
                size="sm"
                variant={form.correct_option === k.toUpperCase() ? "default" : "outline"}
                className="h-8 px-2 text-[10px]"
                onClick={() => setForm({ ...form, correct_option: k.toUpperCase() })}
              >
                সঠিক
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2 border-t border-border/60">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>বাতিল</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? "সেভ হচ্ছে..." : "সেভ করুন"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Admin-only inline dialog on the Readymade card: shows all MCQs of the exam
// (full question + options) with a range/checkbox bar to assign `topic`
// directly, without opening the full ExamCreator page.
const TopicAddDialog = ({ exam, onClose }: { exam: any; onClose: () => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rangeTopic, setRangeTopic] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [checkboxMode, setCheckboxMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localTopics, setLocalTopics] = useState<Record<string, string | null>>({});

  const { data: questions, isLoading } = useQuery({
    queryKey: ["topic-add-questions", exam.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_questions")
        .select("id, question_index, question_text, option_a, option_b, option_c, option_d, option_e, correct_option, topic")
        .eq("exam_id", exam.id)
        .order("question_index", { ascending: true });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const initial: Record<string, string | null> = {};
      (data || []).forEach((q: any) => { initial[q.id] = q.topic || null; });
      setLocalTopics(initial);
      return data || [];
    },
  });

  const applyRange = () => {
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10);
    if (!rangeTopic.trim() || isNaN(from) || isNaN(to) || from < 1 || to < from || !questions) return;
    const next = { ...localTopics };
    questions.forEach((q: any) => {
      if (q.question_index >= from && q.question_index <= to) {
        next[q.id] = rangeTopic.trim();
      }
    });
    setLocalTopics(next);
    setRangeFrom("");
    setRangeTo("");
    toast({ title: `Q${from}-${to} কে "${rangeTopic.trim()}" টপিক দেওয়া হয়েছে` });
  };

  const applyChecked = () => {
    if (!rangeTopic.trim() || checked.size === 0) return;
    const next = { ...localTopics };
    checked.forEach((id) => { next[id] = rangeTopic.trim(); });
    setLocalTopics(next);
    setChecked(new Set());
    toast({ title: `${checked.size} টি প্রশ্নে "${rangeTopic.trim()}" টপিক দেওয়া হয়েছে` });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(localTopics);
      for (const [id, topic] of entries) {
        const { error } = await supabase.from("exam_questions").update({ topic: topic || null }).eq("id", id);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["exam-topics", exam.id] });
      toast({ title: "Topic সেভ হয়েছে" });
      onClose();
    } catch (err: any) {
      toast({ title: "সেভ করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const distinctTopics = Array.from(new Set(Object.values(localTopics).filter(Boolean))) as string[];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Topic ভাগ করুন — {exam.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pb-2 border-b border-border/60">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={rangeTopic}
              onChange={e => setRangeTopic(e.target.value)}
              placeholder="Topic নাম"
              className="h-8 text-xs w-40 rounded-full px-3"
            />
            <Input
              type="number"
              value={rangeFrom}
              onChange={e => setRangeFrom(e.target.value)}
              placeholder="Q# From"
              className="h-8 text-xs w-24 rounded-full px-3"
            />
            <Input
              type="number"
              value={rangeTo}
              onChange={e => setRangeTo(e.target.value)}
              placeholder="Q# To"
              className="h-8 text-xs w-24 rounded-full px-3"
            />
            <Button size="sm" className="h-8 text-xs rounded-full" disabled={!rangeTopic.trim() || !rangeFrom || !rangeTo} onClick={applyRange}>
              Range Apply
            </Button>
            <Button
              size="sm"
              variant={checkboxMode ? "default" : "outline"}
              className="h-8 text-xs rounded-full"
              onClick={() => { setCheckboxMode(v => !v); setChecked(new Set()); }}
            >
              {checkboxMode ? "Checkbox মোড বন্ধ করুন" : "Checkbox দিয়ে বাছাই করুন"}
            </Button>
            {checkboxMode && (
              <Button size="sm" className="h-8 text-xs rounded-full" disabled={!rangeTopic.trim() || checked.size === 0} onClick={applyChecked}>
                Selected ({checked.size}) এ Apply করুন
              </Button>
            )}
          </div>
          {distinctTopics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {distinctTopics.map((t) => (
                <span key={t} className="text-[10px] bg-secondary/60 text-secondary-foreground px-2 py-0.5 rounded-full">
                  {t} · {Object.values(localTopics).filter(v => v === t).length} MCQ
                </span>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="space-y-3 py-2">
            {(questions || []).map((q: any) => (
              <div
                key={q.id}
                className={`p-3 rounded-xl border ${checkboxMode && checked.has(q.id) ? 'border-primary/60 bg-primary/5' : 'border-border/60 bg-card'}`}
                onClick={() => {
                  if (!checkboxMode) return;
                  setChecked(prev => {
                    const next = new Set(prev);
                    if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                    return next;
                  });
                }}
              >
                <div className="flex items-start gap-2 mb-2">
                  {checkboxMode && (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked.has(q.id)}
                      onChange={() => {
                        setChecked(prev => {
                          const next = new Set(prev);
                          if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                          return next;
                        });
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-muted-foreground">Q{q.question_index}</span>
                      {localTopics[q.id] && (
                        <span className="text-[10px] bg-secondary/60 text-secondary-foreground px-2 py-0.5 rounded-full">{localTopics[q.id]}</span>
                      )}
                    </div>
                    <div className="text-sm font-medium"><MathText text={q.question_text} /></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pl-0 sm:pl-6">
                  {(['a', 'b', 'c', 'd', 'e'] as const).map((k) => {
                    const val = q[`option_${k}`];
                    if (!val) return null;
                    const letter = k.toUpperCase();
                    return (
                      <div key={k} className={`p-2 rounded border ${q.correct_option === letter ? 'bg-green-100/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-muted/30'}`}>
                        <span className="font-semibold mr-2">{letter}.</span>
                        <MathText text={val} inline />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-border/60 sticky bottom-0 bg-background">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>বাতিল</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving || isLoading}>{saving ? "সেভ হচ্ছে..." : "সেভ করুন"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ExamGrid = ({ exams, navigate, enrolledIds = [], fullAccessCourseIds = [], subChapterGrants = new Set<string>(), onLockedClick, isAdmin = false, listPath = "/dashboard/readymade", examPath = "/dashboard/take-exam" }: { exams: any[], navigate: any, enrolledIds?: string[], fullAccessCourseIds?: string[], subChapterGrants?: Set<string>, onLockedClick?: (exam: any) => void, isAdmin?: boolean, listPath?: string, examPath?: string }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [topicAddExam, setTopicAddExam] = useState<any | null>(null);
  // Which exam has its split/topic panel open, and which of the two panels
  // (mutually exclusive per exam) is showing.
  const [openPanelExamId, setOpenPanelExamId] = useState<string | null>(null);
  const [openPanelType, setOpenPanelType] = useState<"split" | "topic" | null>(null);
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Admin: delete a whole exam (confirm dialog); deleted ids are hidden immediately.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deleteExamTarget, setDeleteExamTarget] = useState<any | null>(null);
  const [deletingExam, setDeletingExam] = useState(false);
  const [deletedExamIds, setDeletedExamIds] = useState<Set<string>>(new Set());
  const deleteQueryClient = useQueryClient();
  const confirmDeleteExam = async () => {
    if (!isAdmin || !deleteExamTarget) return;
    setDeletingExam(true);
    try {
      // Soft delete (hides from students, keeps attempts/history). Hard delete would cascade-wipe every user's attempts.
      const { error } = await (supabase as any).rpc("soft_delete_exam", { p_exam_id: deleteExamTarget.id });
      if (error) throw error;
      setDeletedExamIds((prev) => new Set(prev).add(deleteExamTarget.id));
      deleteQueryClient.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] ?? "").startsWith("readymade-") });
      toast({ title: "Exam ডিলিট হয়েছে" });
      setDeleteExamTarget(null);
    } catch (err: any) {
      toast({ title: "Delete ব্যর্থ", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setDeletingExam(false);
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [splittingExam, setSplittingExam] = useState<any | null>(null);

  // Send-to-Telegram-channel (via QuizBot /csv pipeline) dialog state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sendingExam, setSendingExam] = useState<any | null>(null);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkSelectedExamIds, setBulkSelectedExamIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; examTitle: string } | null>(null);
  const [bulkSendExams, setBulkSendExams] = useState<any[] | null>(null);
  const [bulkPostMode, setBulkPostMode] = useState<"single" | "separate">("single");
  const [sendSavedChannelId, setSendSavedChannelId] = useState<string>(""); // telegram_channels.id, or "custom" (legacy) or "__new__"
  const [sendChannelId, setSendChannelId] = useState("");
  const [sendThreadId, setSendThreadId] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [savingNewChannel, setSavingNewChannel] = useState(false);
  const sendQueryClient = useQueryClient();
  const [sendSplitMode, setSendSplitMode] = useState<"auto" | "all" | "batch">("auto"); // auto = topic-wise if topics exist
  const [sendMode, setSendMode] = useState<"all" | "links_only" | "poll_quiz_pdf">("all"); // all = polls+PDF+summary (present system); links_only = single post, no polls sent, just per-topic Poll Practice/Quiz Solve/Website Exam links; poll_quiz_pdf = same single-post style but only Poll Practice/Quiz Solve/Premium PDF links, no Website Exam link anywhere
  const [sendBatchSize, setSendBatchSize] = useState("25");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendJobStatus, setSendJobStatus] = useState<{ status: string; sent_total?: number; total?: number; batches_done?: number; batches_total?: number; error?: string | null } | null>(null);

  // Per-exam running-job tracking, keyed by exam.id — drives the inline
  // progress bar + Stop button on each card. Survives page reload because
  // on mount we ask the bot server (which owns the job, runs it in the
  // background regardless of this tab) whether a job is still active for
  // each visible exam.
  type CardJob = { jobId: string; pct: number; sentTotal: number; total: number; status: string };
  const [cardJobs, setCardJobs] = useState<Record<string, CardJob>>({});
  const cardJobsRef = useRef<Record<string, CardJob>>({});
  cardJobsRef.current = cardJobs;

  const pollCardJob = (examId: string, jobId: string) => {
    const tick = async () => {
      try {
        const r = await fetch(`${QUIZBOT_API_BASE}/api/lms-send-channel/status/${jobId}`);
        const text = await r.text();
        let j: any;
        try { j = JSON.parse(text); } catch { return; }
        if (!j || j.error) return;
        setCardJobs((prev) => ({
          ...prev,
          [examId]: { jobId, pct: j.pct || 0, sentTotal: j.sent_total || 0, total: j.total || 0, status: j.status },
        }));
        if (j.status === "done" || j.status === "error" || j.status === "cancelled") {
          clearInterval(timer);
          setTimeout(() => {
            setCardJobs((prev) => {
              const next = { ...prev };
              delete next[examId];
              return next;
            });
          }, j.status === "done" ? 2500 : 5000);
        }
      } catch { /* transient network hiccup — keep polling */ }
    };
    const timer = setInterval(tick, 2000);
    tick();
  };

  // On mount, check every visible exam for a still-running job (covers page
  // reload / reopening the app while a send is in progress on the server).
  useEffect(() => {
    if (!isAdmin || !exams?.length) return;
    let cancelled = false;
    (async () => {
      for (const exam of exams) {
        if (cancelled) return;
        try {
          const r = await fetch(`${QUIZBOT_API_BASE}/api/lms-send-channel/active-by-exam/${exam.id}`);
          const text = await r.text();
          let j: any;
          try { j = JSON.parse(text); } catch { continue; }
          if (j?.job_id && !cardJobsRef.current[exam.id]) {
            pollCardJob(exam.id, j.job_id);
          }
        } catch { /* ignore — proxy/bot may be briefly unreachable */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, exams?.map((e: any) => e.id).join(",")]);

  const handleStopCardJob = async (examId: string) => {
    const job = cardJobsRef.current[examId];
    if (!job) return;
    try {
      await fetch(`${QUIZBOT_API_BASE}/api/lms-send-channel/cancel/${job.jobId}`, { method: "POST" });
    } catch { /* best-effort */ }
  };

  const { data: savedChannels } = useQuery({
    queryKey: ["telegram-channels-send-dialog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_channels")
        .select("id, name, chat_id, thread_id")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const openSendDialog = (e: React.MouseEvent, exam: any) => {
    e.stopPropagation();
    setBulkSendExams(null);
    setSendingExam(exam);
    setSendSavedChannelId("");
    setSendChannelId("");
    setSendThreadId("");
    setSendSplitMode("auto");
    setSendMode("all");
    setSendBatchSize("25");
    setSendJobStatus(null);
    setNewChannelName("");
  };

  const handleSelectSavedChannel = (id: string) => {
    setSendSavedChannelId(id);
    setNewChannelName("");
    if (id === "custom" || id === "__new__") {
      setSendChannelId("");
      setSendThreadId("");
      return;
    }
    const ch = savedChannels?.find((c: any) => c.id === id);
    if (ch) {
      setSendChannelId(ch.chat_id || "");
      setSendThreadId(""); // thread_id সেভ করা হয় না — প্রতিবার নতুন করে লিখতে হবে
    }
  };

  const handleSaveNewChannel = async () => {
    if (!newChannelName.trim() || !sendChannelId.trim()) {
      toast({ title: "নাম ও Chat ID দুটোই দরকার", variant: "destructive" });
      return;
    }
    setSavingNewChannel(true);
    try {
      const { data, error } = await supabase
        .from("telegram_channels")
        .insert({
          name: newChannelName.trim(),
          chat_id: sendChannelId.trim(),
          thread_id: null, // thread_id সেভ করা হয় না — পাঠানোর সময় প্রতিবার আলাদা করে লিখতে হয়
          is_active: true,
        })
        .select("id, name, chat_id, thread_id")
        .single();
      if (error) throw error;
      await sendQueryClient.invalidateQueries({ queryKey: ["telegram-channels-send-dialog"] });
      setSendSavedChannelId(data.id);
      setNewChannelName("");
      toast({ title: "নতুন channel সেভ হয়েছে" });
    } catch (err: any) {
      toast({ title: "সেভ করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSavingNewChannel(false);
    }
  };

  const handleSendToChannel = async () => {
    if (!sendingExam || !sendChannelId.trim()) {
      toast({ title: "Channel ID প্রয়োজন", variant: "destructive" });
      return;
    }
    setSendBusy(true);
    setSendJobStatus({ status: "queued" });
    try {
      const { data: questions, error } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("exam_id", sendingExam.id)
        .order("question_index", { ascending: true });
      if (error) throw error;
      if (!questions || questions.length === 0) {
        toast({ title: "কোনো প্রশ্ন নেই", variant: "destructive" });
        setSendBusy(false);
        return;
      }

      const toMcq = (q: any) => ({
        question: q.question_text || "",
        options: [q.option_a || "", q.option_b || "", q.option_c || "", q.option_d || ""],
        answer: String(q.correct_option || "A").toUpperCase(),
        explanation: q.explanation || "",
      });

      const hasTopics = questions.some((q: any) => (q.topic || "").trim());

      // Build the topic/batch split — same shapes QuizBot's /topic (topic-wise)
      // and /csvS (fixed batch-size) commands produce.
      let batches: { topic: string; mcqs: any[] }[];
      if (sendSplitMode === "auto" && hasTopics) {
        const order: string[] = [];
        const groups = new Map<string, any[]>();
        for (const q of questions) {
          const t = (q.topic || "").trim() || sendingExam.title;
          if (!groups.has(t)) { groups.set(t, []); order.push(t); }
          groups.get(t)!.push(toMcq(q));
        }
        batches = order.map((t) => ({ topic: t, mcqs: groups.get(t)! }));
      } else if (sendSplitMode === "batch") {
        const size = Math.max(1, parseInt(sendBatchSize, 10) || 25);
        const all = questions.map(toMcq);
        batches = [];
        for (let i = 0; i < all.length; i += size) {
          const partNo = Math.floor(i / size) + 1;
          batches.push({ topic: `${sendingExam.title} (Part-${String(partNo).padStart(2, "0")})`, mcqs: all.slice(i, i + size) });
        }
      } else {
        batches = [{ topic: sendingExam.title, mcqs: questions.map(toMcq) }];
      }

      const res = await fetch(`${QUIZBOT_API_BASE}/api/lms-send-channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: QUIZBOT_API_SECRET,
          channel_id: sendChannelId.trim(),
          thread_id: sendThreadId.trim() ? Number(sendThreadId.trim()) : null,
          batches,
          exam_id: sendingExam.id,
          exam_title: sendingExam.title || "",
          subject: Array.isArray(sendingExam.subject) ? (sendingExam.subject[0] || "") : (sendingExam.subject || ""),
          chapter: sendingExam.chapter || "",
          links_only: sendMode === "links_only" || sendMode === "poll_quiz_pdf",
          links_variant: sendMode === "poll_quiz_pdf" ? "poll_quiz_pdf" : "full",
        }),
      });
      const rawText = await res.text();
      let json: any;
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new Error(
          `Bot server থেকে সাড়া মেলেনি (HTTP ${res.status}). হয়তো bot ঘুমিয়ে আছে বা রিস্টার্ট হচ্ছে — কিছুক্ষণ পর আবার চেষ্টা করুন।`
        );
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Send request failed");
      }

      // Both modes now run as a background job on the same proven
      // /api/lms-send-channel path — links_only just finishes fast (one
      // message, no poll loop) but still goes through the same job
      // status/progress/cancel machinery as the normal mode.
      const jobId = json.job_id as string;
      setSendJobStatus({ status: "running", sent_total: 0, total: questions.length, batches_done: 0, batches_total: batches.length });
      pollCardJob(sendingExam.id, jobId);
      // Dialog can close now — the job runs on the bot server independent of
      // this tab; progress/stop continue on the exam card itself.
      setSendBusy(false);
      setSendJobStatus(null);
      setSendingExam(null);
      toast({ title: "পাঠানো শুরু হয়েছে", description: "কার্ডের নিচে প্রগ্রেস দেখা যাবে — ব্রাউজার বন্ধ করলেও পাঠানো চলতে থাকবে।" });
    } catch (err: any) {
      toast({ title: "পাঠানো যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
      setSendBusy(false);
      setSendJobStatus(null);
    }
  };

  const buildBatchesForExam = (exam: any, questions: any[]) => {
    const toMcq = (q: any) => ({
      question: q.question_text || "",
      options: [q.option_a || "", q.option_b || "", q.option_c || "", q.option_d || ""],
      answer: String(q.correct_option || "A").toUpperCase(),
      explanation: q.explanation || "",
    });
    const hasTopics = questions.some((q: any) => (q.topic || "").trim());
    let batches: { topic: string; mcqs: any[] }[];
    if (sendSplitMode === "auto" && hasTopics) {
      const order: string[] = [];
      const groups = new Map<string, any[]>();
      for (const q of questions) {
        const t = (q.topic || "").trim() || exam.title;
        if (!groups.has(t)) { groups.set(t, []); order.push(t); }
        groups.get(t)!.push(toMcq(q));
      }
      batches = order.map((t) => ({ topic: t, mcqs: groups.get(t)! }));
    } else if (sendSplitMode === "batch") {
      const size = Math.max(1, parseInt(sendBatchSize, 10) || 25);
      const all = questions.map(toMcq);
      batches = [];
      for (let i = 0; i < all.length; i += size) {
        const partNo = Math.floor(i / size) + 1;
        batches.push({ topic: `${exam.title} (Part-${String(partNo).padStart(2, "0")})`, mcqs: all.slice(i, i + size) });
      }
    } else {
      batches = [{ topic: exam.title, mcqs: questions.map(toMcq) }];
    }
    return batches;
  };

  // Send several exams to the same channel/thread in one go — same
  // /api/lms-send-channel job system as the single-exam send, just looped.
  // Each exam gets its own background job and its own card progress bar
  // (via pollCardJob), so they all send in parallel independent of each
  // other; only the request-firing loop itself runs sequentially so we
  // don't hammer the bot with N simultaneous Supabase+Telegram calls.
  const handleSendMultipleToChannel = async (exams: any[]) => {
    if (!exams.length || !sendChannelId.trim()) {
      toast({ title: "Channel ID প্রয়োজন", variant: "destructive" });
      return;
    }
    setBulkSending(true);

    if (bulkPostMode === "single") {
      // One combined Telegram message for every selected exam.
      try {
        setBulkProgress({ current: 1, total: exams.length, examTitle: "সব এক্সামের প্রশ্ন লোড হচ্ছে..." });
        const examGroups: { exam_title: string; subject: string; chapter?: string; batches: any[] }[] = [];
        for (let i = 0; i < exams.length; i++) {
          const exam = exams[i];
          setBulkProgress({ current: i + 1, total: exams.length, examTitle: exam.title || "" });
          const { data: questions, error } = await supabase
            .from("exam_questions")
            .select("*")
            .eq("exam_id", exam.id)
            .order("question_index", { ascending: true });
          if (error) throw error;
          if (!questions || questions.length === 0) continue;
          examGroups.push({
            exam_title: exam.title || "",
            subject: Array.isArray(exam.subject) ? (exam.subject[0] || "") : (exam.subject || ""),
            chapter: exam.chapter || "",
            batches: buildBatchesForExam(exam, questions),
          });
        }
        if (!examGroups.length) throw new Error("কোনো প্রশ্ন পাওয়া যায়নি");

        const res = await fetch(`${QUIZBOT_API_BASE}/api/lms-send-channel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: QUIZBOT_API_SECRET,
            channel_id: sendChannelId.trim(),
            thread_id: sendThreadId.trim() ? Number(sendThreadId.trim()) : null,
            exam_groups: examGroups,
            links_only: true, // single-post mode is links-only by nature
          }),
        });
        const rawText = await res.text();
        let json: any;
        try { json = JSON.parse(rawText); } catch { throw new Error(`HTTP ${res.status}`); }
        if (!res.ok || !json.ok) throw new Error(json.error || "failed");
        // No single card to attach progress to (spans several exams) —
        // just confirm it was queued; it finishes in a couple seconds since
        // it's one message send, not a poll loop.
        toast({ title: "পাঠানো হয়েছে", description: `${examGroups.length}টি এক্সাম এক পোস্টে পাঠানো হয়েছে।` });
      } catch (err: any) {
        toast({ title: "পাঠানো যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
      }
      setBulkSending(false);
      setBulkProgress(null);
      setBulkSelectMode(false);
      setBulkSelectedExamIds(new Set());
      setBulkSendExams(null);
      setSendingExam(null);
      return;
    }

    // Separate post per exam (previous behaviour).
    let okCount = 0, failCount = 0;
    for (let i = 0; i < exams.length; i++) {
      const exam = exams[i];
      setBulkProgress({ current: i + 1, total: exams.length, examTitle: exam.title || "" });
      try {
        const { data: questions, error } = await supabase
          .from("exam_questions")
          .select("*")
          .eq("exam_id", exam.id)
          .order("question_index", { ascending: true });
        if (error) throw error;
        if (!questions || questions.length === 0) { failCount++; continue; }

        const batches = buildBatchesForExam(exam, questions);
        const res = await fetch(`${QUIZBOT_API_BASE}/api/lms-send-channel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: QUIZBOT_API_SECRET,
            channel_id: sendChannelId.trim(),
            thread_id: sendThreadId.trim() ? Number(sendThreadId.trim()) : null,
            batches,
            exam_id: exam.id,
            exam_title: exam.title || "",
            subject: Array.isArray(exam.subject) ? (exam.subject[0] || "") : (exam.subject || ""),
            chapter: exam.chapter || "",
            links_only: sendMode === "links_only" || sendMode === "poll_quiz_pdf",
            links_variant: sendMode === "poll_quiz_pdf" ? "poll_quiz_pdf" : "full",
          }),
        });
        const rawText = await res.text();
        let json: any;
        try { json = JSON.parse(rawText); } catch {
          throw new Error(`HTTP ${res.status}`);
        }
        if (!res.ok || !json.ok) throw new Error(json.error || "failed");
        pollCardJob(exam.id, json.job_id as string);
        okCount++;
      } catch (err) {
        failCount++;
      }
    }
    setBulkSending(false);
    setBulkProgress(null);
    setBulkSelectMode(false);
    setBulkSelectedExamIds(new Set());
    setBulkSendExams(null);
    setSendingExam(null);
    toast({
      title: "বাল্ক পাঠানো শুরু হয়েছে",
      description: `${okCount}টি এক্সাম পাঠানো শুরু হয়েছে${failCount ? `, ${failCount}টি ব্যর্থ` : ""} — প্রতিটার প্রগ্রেস তার নিজের কার্ডে দেখা যাবে।`,
    });
  };

  const [sheetExam, setSheetExam] = useState<any | null>(null);
  const [sheetHasPattern, setSheetHasPattern] = useState<boolean>(true);
  const [sheetChecking, setSheetChecking] = useState(false);
  const [sheetTopicFilter, setSheetTopicFilter] = useState<{ topic: string; subtopic?: string } | null>(null);

  // AI Tag bulk explanation generation state.
  const [aiRun, setAiRun] = useState<{ scope: "single" | "all"; examTitle: string; total: number; done: number; skipped: number; failed: number; cancelled: boolean; currentProvider: string | null; startedAt: number } | null>(null);
  const aiCancelRef = useRef(false);
  const [aiElapsedMs, setAiElapsedMs] = useState(0);

  useEffect(() => {
    if (!aiRun || aiRun.done >= aiRun.total) return;
    const interval = setInterval(() => setAiElapsedMs(Date.now() - aiRun.startedAt), 250);
    return () => clearInterval(interval);
  }, [aiRun]);

  const formatElapsed = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m > 0 ? `${m}মি ${s}সে` : `${s}সে`;
  };

  const runAiTagForQuestions = async (questionRows: any[], scope: "single" | "all", examTitle: string) => {
    aiCancelRef.current = false;
    const startedAt = Date.now();
    setAiElapsedMs(0);
    setAiRun({ scope, examTitle, total: questionRows.length, done: 0, skipped: 0, failed: 0, cancelled: false, currentProvider: null, startedAt });
    for (const q of questionRows) {
      if (aiCancelRef.current) {
        setAiRun((prev) => prev ? { ...prev, cancelled: true } : prev);
        break;
      }
      if (q.explanation && String(q.explanation).trim().length > 0) {
        setAiRun((prev) => prev ? { ...prev, done: prev.done + 1, skipped: prev.skipped + 1 } : prev);
        continue;
      }
      try {
        const { provider } = await generateAndCacheExplanationWithMeta(
          {
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_option: q.correct_option,
          },
          q.id,
          true // geminiOnly — AI Tag explanations must come from Gemini only
        );
        setAiRun((prev) => prev ? { ...prev, done: prev.done + 1, currentProvider: provider || prev.currentProvider } : prev);
      } catch {
        setAiRun((prev) => prev ? { ...prev, done: prev.done + 1, failed: prev.failed + 1 } : prev);
      }
    }
  };

  const handleAiTagSingle = async (e: React.MouseEvent, exam: any) => {
    e.stopPropagation();
    try {
      const { data, error } = await supabase.rpc("get_exam_questions_practice", { p_exam_id: exam.id });
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) {
        toast({ title: "কোনো প্রশ্ন নেই", variant: "destructive" });
        return;
      }
      await runAiTagForQuestions(rows, "single", exam.title);
    } catch (err: any) {
      toast({ title: "শুরু করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  const handleAiTagAll = async () => {
    try {
      const allRows: any[] = [];
      for (const exam of exams) {
        const { data, error } = await supabase.rpc("get_exam_questions_practice", { p_exam_id: exam.id });
        if (error) continue;
        allRows.push(...(data || []));
      }
      if (allRows.length === 0) {
        toast({ title: "কোনো প্রশ্ন নেই", variant: "destructive" });
        return;
      }
      await runAiTagForQuestions(allRows, "all", `${exams.length}টি Exam`);
    } catch (err: any) {
      toast({ title: "শুরু করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  const handleDownloadCsv = async (e: React.MouseEvent, exam: any) => {
    e.stopPropagation();
    try {
      const { data: questions, error } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("exam_id", exam.id)
        .order("question_index", { ascending: true });

      if (error) throw error;
      if (!questions || questions.length === 0) {
        toast({ title: "কোনো প্রশ্ন নেই", variant: "destructive" });
        return;
      }

      const rows = questions.map((q: any) => {
        const answerLetter = String(q.correct_option || "").toUpperCase();
        const answerNum =
          answerLetter === "A" ? "1" :
          answerLetter === "B" ? "2" :
          answerLetter === "C" ? "3" :
          answerLetter === "D" ? "4" :
          answerLetter === "E" ? "5" : "";
        return {
          questions: q.question_text || "",
          option1: q.option_a || "",
          option2: q.option_b || "",
          option3: q.option_c || "",
          option4: q.option_d || "",
          option5: q.option_e || "",
          answer: answerNum,
          explanation: q.explanation || "",
          type: "1",
          section: "1",
        };
      });

      const csv = Papa.unparse(rows, {
        columns: ["questions", "option1", "option2", "option3", "option4", "option5", "answer", "explanation", "type", "section"],
      });

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", (exam.title || "quiz") + ".csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({ title: "CSV Downloaded", description: `Exported ${questions.length} questions.` });
    } catch (err: any) {
      toast({ title: "CSV Download Failed", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  // NOTE: requires >=2 roman-numeral markers in sequence to avoid false-
  // positives on ordinary text — same fix as TakeExam.tsx's isImageOrPatternQuestion.
  const isImageOrPatternQ = (q: any) => {
    const fields = [q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e];
    const combined = fields.filter(Boolean).join(" ");
    if (/<img/i.test(combined)) return true;
    const romanMarkers = combined.match(/\((i{1,3}|iv|vi{0,1})\)|\b(i{1,3}|iv|vi{0,1})[.)]/gi) || [];
    if (romanMarkers.length >= 2) return true;
    return false;
  };

  const openPracticeSheetPicker = async (e: React.MouseEvent, exam: any, topicFilter?: { topic: string; subtopic?: string }) => {
    e.stopPropagation();
    setSheetExam(exam);
    setSheetTopicFilter(topicFilter || null);
    setSheetChecking(true);
    try {
      const { data, error } = await supabase.rpc("get_exam_questions_practice", { p_exam_id: exam.id });
      if (error) throw error;
      let rows = data || [];
      if (topicFilter) {
        rows = rows.filter((q: any) =>
          q.topic === topicFilter.topic && (!topicFilter.subtopic || q.subtopic === topicFilter.subtopic)
        );
      }
      setSheetHasPattern(rows.some((q: any) => isImageOrPatternQ(q)));
    } catch {
      setSheetHasPattern(true);
    } finally {
      setSheetChecking(false);
    }
  };

  const handleDownloadPdf = async (style: "style1" | "style2" | "style3" | "style4", withPattern: boolean, hideExplanation = false) => {
    const exam = sheetExam;
    if (!exam || downloadingId) return;
    const topicFilter = sheetTopicFilter;
    setSheetExam(null);
    setSheetTopicFilter(null);
    setDownloadingId(exam.id);
    try {
      const { data, error } = await supabase.rpc("get_exam_questions_practice", { p_exam_id: exam.id });
      if (error) throw error;
      let scoped = data || [];
      if (topicFilter) {
        scoped = scoped.filter((q: any) =>
          q.topic === topicFilter.topic && (!topicFilter.subtopic || q.subtopic === topicFilter.subtopic)
        );
      }
      if (scoped.length === 0) {
        toast({ title: "No questions found", description: "This exam has no questions to export.", variant: "destructive" });
        return;
      }
      const filtered = withPattern ? scoped : scoped.filter((q: any) => !isImageOrPatternQ(q));
      if (filtered.length === 0) {
        toast({ title: "No questions found", description: "উদ্দীপক/চিত্র ছাড়া কোনো প্রশ্ন নেই।", variant: "destructive" });
        return;
      }
      openSolvePdf({
        examName: topicFilter ? `${exam.title} — ${topicFilter.subtopic || topicFilter.topic}` : exam.title,
        style,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        questions: filtered.map((q: any) => ({
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          option_e: q.option_e,
          correct_option: q.correct_option,
          user_answer: null,
          explanation: hideExplanation ? null : q.explanation,
          topic: q.topic || null,
          subtopic: q.subtopic || null,
        })),
        totalMarks: filtered.length,
      });
    } catch (err: any) {
      toast({ title: "PDF তৈরি করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
    <AlertDialog open={!!deleteExamTarget} onOpenChange={(v) => { if (!v && !deletingExam) setDeleteExamTarget(null); }}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>এই Exam ডিলিট করবেন?</AlertDialogTitle>
          <AlertDialogDescription>
            "{deleteExamTarget?.title}" ইউজারদের কাছ থেকে লুকিয়ে যাবে (Exams Manager → History থেকে Restore করা যাবে)। ইউজারদের attempt/history মুছবে না।
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletingExam}>বাতিল</AlertDialogCancel>
          <AlertDialogAction
            disabled={deletingExam}
            className="bg-red-600 hover:bg-red-700"
            onClick={(e) => { e.preventDefault(); void confirmDeleteExam(); }}
          >
            {deletingExam ? "ডিলিট হচ্ছে..." : "ডিলিট"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {splittingExam && <SplitExamDialog exam={splittingExam} onClose={() => setSplittingExam(null)} />}
    {topicAddExam && <TopicAddDialog exam={topicAddExam} onClose={() => setTopicAddExam(null)} />}
    <Dialog open={!!sendingExam} onOpenChange={(v) => { if (!v && !sendBusy) setSendingExam(null); }}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Telegram চ্যানেলে পাঠান</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">পাঠানোর ধরন</label>
            <Select value={sendMode} onValueChange={(v) => setSendMode(v as any)} disabled={sendBusy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব (Poll + PDF + Summary — বর্তমান পদ্ধতি)</SelectItem>
                <SelectItem value="links_only">শুধু Poll Practice, Quiz Solve, Website Exam লিংক (এক পোস্টে)</SelectItem>
                <SelectItem value="poll_quiz_pdf">শুধু Poll + Quiz + PDF (Website লিংক ছাড়া)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Saved Channel</label>
            <Select value={sendSavedChannelId} onValueChange={handleSelectSavedChannel} disabled={sendBusy}>
              <SelectTrigger>
                <SelectValue placeholder="একটা channel বেছে নাও অথবা নতুন লিখো" />
              </SelectTrigger>
              <SelectContent>
                {savedChannels?.map((ch: any) => (
                  <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                ))}
                <SelectItem value="__new__">+ নতুন channel যোগ করো</SelectItem>
                <SelectItem value="custom">নতুন / সরাসরি ID লিখো (সেভ ছাড়া)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sendSavedChannelId === "__new__" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">নতুন Channel-এর নাম</label>
              <Input
                placeholder="যেমন: HSC Batch 27 Group"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                disabled={sendBusy || savingNewChannel}
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Channel/Group Chat ID</label>
            <Input
              placeholder="-100xxxxxxxxxx"
              value={sendChannelId}
              onChange={(e) => setSendChannelId(e.target.value)}
              disabled={sendBusy}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Thread/Topic ID (group-এর topic হলে, নাহলে খালি রাখো — এটা সেভ হয় না, প্রতিবার লিখতে হবে)</label>
            <Input
              placeholder="ঐচ্ছিক"
              value={sendThreadId}
              onChange={(e) => setSendThreadId(e.target.value)}
              disabled={sendBusy}
            />
          </div>
          {sendSavedChannelId === "__new__" && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSaveNewChannel}
              disabled={savingNewChannel || sendBusy || !newChannelName.trim() || !sendChannelId.trim()}
            >
              {savingNewChannel ? "সেভ হচ্ছে..." : "এই নামে সেভ করো"}
            </Button>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">ভাগ করার নিয়ম</label>
            <Select value={sendSplitMode} onValueChange={(v) => setSendSplitMode(v as any)} disabled={sendBusy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (topic থাকলে topic-wise, নাহলে সব একসাথে)</SelectItem>
                <SelectItem value="all">সব একসাথে (এক batch)</SelectItem>
                <SelectItem value="batch">নির্দিষ্ট সংখ্যা দিয়ে ভাগ করো</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sendSplitMode === "batch" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">প্রতি batch-এ কয়টা প্রশ্ন</label>
              <Input
                type="number"
                min={1}
                value={sendBatchSize}
                onChange={(e) => setSendBatchSize(e.target.value)}
                disabled={sendBusy}
              />
            </div>
          )}
          {sendJobStatus && (
            <div className="text-xs text-muted-foreground">
              {sendJobStatus.status === "error"
                ? `ব্যর্থ: ${sendJobStatus.error || "Unknown error"}`
                : sendJobStatus.status === "done"
                ? `সম্পন্ন — ${sendJobStatus.sent_total ?? sendJobStatus.total ?? ""} টি প্রশ্ন পাঠানো হয়েছে (${sendJobStatus.batches_done ?? "?"}/${sendJobStatus.batches_total ?? "?"} batch)।`
                : `পাঠানো হচ্ছে... batch ${sendJobStatus.batches_done ?? 0}/${sendJobStatus.batches_total ?? "?"}`}
            </div>
          )}
          {bulkSendExams && bulkSendExams.length > 1 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">পোস্ট করার ধরন</label>
              <Select value={bulkPostMode} onValueChange={(v) => setBulkPostMode(v as any)} disabled={bulkSending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">এক পোস্টে (সব {bulkSendExams.length}টি এক্সাম একসাথে)</SelectItem>
                  <SelectItem value="separate">আলাদা পোস্টে (প্রতিটি এক্সাম আলাদা মেসেজ)</SelectItem>
                </SelectContent>
              </Select>
              {bulkPostMode === "separate" && (
                <p className="text-xs text-muted-foreground">প্রতিটির প্রগ্রেস তার নিজের কার্ডে দেখা যাবে।</p>
              )}
            </div>
          )}
          {bulkProgress && (
            <p className="text-xs text-muted-foreground">পাঠানো হচ্ছে: {bulkProgress.current}/{bulkProgress.total} — {bulkProgress.examTitle}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" disabled={sendBusy || bulkSending} onClick={() => { setSendingExam(null); setBulkSendExams(null); }}>বাতিল</Button>
            <Button
              size="sm"
              disabled={sendBusy || bulkSending}
              onClick={() => bulkSendExams ? handleSendMultipleToChannel(bulkSendExams) : handleSendToChannel()}
            >
              {(sendBusy || bulkSending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (bulkSendExams ? `${bulkSendExams.length}টি পাঠাও` : "পাঠাও")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {isAdmin && exams.length > 0 && (
      <div className="col-span-1 lg:col-span-2 flex justify-end gap-2">
        <Button
          size="sm"
          variant={bulkSelectMode ? "default" : "outline"}
          className="h-7 px-2 text-[11px] gap-1"
          onClick={() => { setBulkSelectMode((v) => !v); setBulkSelectedExamIds(new Set()); }}
        >
          📤 {bulkSelectMode ? "বাছাই বাতিল" : "একাধিক এক্সাম পাঠাও"}
        </Button>
        {bulkSelectMode && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] gap-1"
            onClick={() => {
              // Same order the cards render in — unlocked exams first, same as the list below.
              const ordered = [...exams].sort((a: any, b: any) => {
                const uA = isExamUnlocked(a, enrolledIds, fullAccessCourseIds, subChapterGrants);
                const uB = isExamUnlocked(b, enrolledIds, fullAccessCourseIds, subChapterGrants);
                if (uA === uB) return 0;
                return uA ? -1 : 1;
              });
              setBulkSelectedExamIds(new Set(ordered.map((e: any) => e.id)));
            }}
          >
            ✅ সব বাছাই করো ({exams.length})
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px] text-violet-600 border-violet-300 hover:text-violet-700 gap-1"
          onClick={handleAiTagAll}
        >
          <Sparkles className="h-3 w-3" /> AI Tag — All ({exams.length}টি Exam)
        </Button>
      </div>
    )}
    {isAdmin && bulkSelectMode && bulkSelectedExamIds.size > 0 && (
      <div className="col-span-1 lg:col-span-2 sticky bottom-2 z-20 flex items-center justify-between gap-2 rounded-lg border bg-background/95 backdrop-blur px-3 py-2 shadow-md">
        <span className="text-xs font-medium">{bulkSelectedExamIds.size}টি এক্সাম বাছাই করা হয়েছে</span>
        <Button
          size="sm"
          onClick={() => {
            const orderedAll = [...exams].sort((a: any, b: any) => {
              const uA = isExamUnlocked(a, enrolledIds, fullAccessCourseIds, subChapterGrants);
              const uB = isExamUnlocked(b, enrolledIds, fullAccessCourseIds, subChapterGrants);
              if (uA === uB) return 0;
              return uA ? -1 : 1;
            });
            const selected = orderedAll.filter((e: any) => bulkSelectedExamIds.has(e.id));
            setBulkSendExams(selected);
            setBulkPostMode("single");
            setSendingExam(selected[0]);
            setSendSavedChannelId("");
            setSendChannelId("");
            setSendThreadId("");
            setSendSplitMode("auto");
            setSendMode("all");
            setSendBatchSize("25");
            setSendJobStatus(null);
            setNewChannelName("");
          }}
        >
          চ্যানেলে পাঠাও
        </Button>
      </div>
    )}
    <Dialog open={!!aiRun} onOpenChange={(o) => { if (!o) { aiCancelRef.current = true; setAiRun(null); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-violet-600" /> AI ব্যাখ্যা তৈরি হচ্ছে</DialogTitle>
        </DialogHeader>
        {aiRun && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{aiRun.examTitle}</p>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-violet-600 h-2 transition-all"
                style={{ width: `${aiRun.total ? Math.round((aiRun.done / aiRun.total) * 100) : 0}%` }}
              />
            </div>
            <p className="text-sm">
              {aiRun.done}/{aiRun.total} সম্পন্ন
              {aiRun.skipped > 0 && ` · ${aiRun.skipped}টি আগে থেকেই ছিল`}
              {aiRun.failed > 0 && ` · ${aiRun.failed}টি ব্যর্থ`}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>AI: <span className="font-medium text-foreground">{aiRun.currentProvider || "..."}</span></span>
              <span>সময়: <span className="font-medium text-foreground">{formatElapsed(aiElapsedMs)}</span></span>
            </div>
            {aiRun.done >= aiRun.total ? (
              <Button size="sm" className="w-full" onClick={() => setAiRun(null)}>
                {aiRun.cancelled ? "বন্ধ করা হয়েছে" : "সম্পন্ন — বন্ধ করুন"}
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="w-full" onClick={() => { aiCancelRef.current = true; }}>
                থামান
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    <Dialog open={!!sheetExam} onOpenChange={(o) => { if (!o) { setSheetExam(null); setSheetTopicFilter(null); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Practice Sheet স্টাইল বেছে নিন</DialogTitle>
          {sheetTopicFilter && (
            <p className="text-xs text-muted-foreground">শুধু: {sheetTopicFilter.subtopic || sheetTopicFilter.topic}</p>
          )}
        </DialogHeader>
        <div className="space-y-4">
          {sheetChecking ? (
            <div className="text-center py-6 text-sm text-muted-foreground">Loading...</div>
          ) : (
          <>
          <div>
            <p className="text-sm font-semibold mb-2">Revision Style <span className="text-xs font-normal text-muted-foreground">[প্রশ্ন,উত্তর,ব্যাখ্যা একই সাথে]</span></p>
            <div className="space-y-2">
              {sheetHasPattern ? (
                <>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">উদ্দীপক/চিত্র সহ <span className="text-muted-foreground">[Board/Varsity Pattern]</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="justify-center h-auto py-2" onClick={() => handleDownloadPdf("style1", true, false)}>
                        ব্যাখ্যাসহ
                      </Button>
                      <Button variant="outline" className="justify-center h-auto py-2" onClick={() => handleDownloadPdf("style1", true, true)}>
                        ব্যাখ্যা ছাড়া
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">উদ্দীপক/চিত্র ছাড়া <span className="text-muted-foreground">[Medical Pattern]</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="justify-center h-auto py-2" onClick={() => handleDownloadPdf("style1", false, false)}>
                        ব্যাখ্যাসহ
                      </Button>
                      <Button variant="outline" className="justify-center h-auto py-2" onClick={() => handleDownloadPdf("style1", false, true)}>
                        ব্যাখ্যা ছাড়া
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="justify-center h-auto py-2" onClick={() => handleDownloadPdf("style1", true, false)}>
                    ব্যাখ্যাসহ
                  </Button>
                  <Button variant="outline" className="justify-center h-auto py-2" onClick={() => handleDownloadPdf("style1", true, true)}>
                    ব্যাখ্যা ছাড়া
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Practice Style <span className="text-xs font-normal text-muted-foreground">[প্রশ্নের শেষে উত্তর+ব্যাখ্যা]</span></p>
            <div className="grid grid-cols-1 gap-2">
              {sheetHasPattern ? (
                <>
                  <Button variant="outline" className="justify-start h-auto py-2" onClick={() => handleDownloadPdf("style2", true)}>
                    উদ্দীপক/চিত্র সহ <span className="text-xs text-muted-foreground ml-1">[Board/Varsity Pattern]</span>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-2" onClick={() => handleDownloadPdf("style2", false)}>
                    উদ্দীপক/চিত্র ছাড়া <span className="text-xs text-muted-foreground ml-1">[Medical Pattern]</span>
                  </Button>
                </>
              ) : (
                <Button variant="outline" className="justify-start h-auto py-2" onClick={() => handleDownloadPdf("style2", true)}>
                  Practice Style
                </Button>
              )}
            </div>
          </div>
          {isAdmin && (
          <div>
            <p className="text-sm font-semibold mb-2">Compact Style <span className="text-xs font-normal text-muted-foreground">[৩ কলাম, প্রতি পেজে ৫০টি প্রশ্ন]</span></p>
            <div className="grid grid-cols-1 gap-2">
              {sheetHasPattern ? (
                <>
                  <Button variant="outline" className="justify-start h-auto py-2" onClick={() => handleDownloadPdf("style3", true)}>
                    উদ্দীপক/চিত্র সহ <span className="text-xs text-muted-foreground ml-1">[Board/Varsity Pattern]</span>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-2" onClick={() => handleDownloadPdf("style3", false)}>
                    উদ্দীপক/চিত্র ছাড়া <span className="text-xs text-muted-foreground ml-1">[Medical Pattern]</span>
                  </Button>
                </>
              ) : (
                <Button variant="outline" className="justify-start h-auto py-2" onClick={() => handleDownloadPdf("style3", true)}>
                  Compact Style
                </Button>
              )}
            </div>
          </div>
          )}
          {isAdmin && (
          <div>
            <p className="text-sm font-semibold mb-2">OMR Style <span className="text-xs font-normal text-muted-foreground">[ল্যান্ডস্কেপ, ১ম পেজে OMR শিট + ৩৬টি প্রশ্ন]</span></p>
            <div className="grid grid-cols-1 gap-2">
              {sheetHasPattern ? (
                <>
                  <Button variant="outline" className="justify-start h-auto py-2" onClick={() => handleDownloadPdf("style4", true)}>
                    উদ্দীপক/চিত্র সহ <span className="text-xs text-muted-foreground ml-1">[Board/Varsity Pattern]</span>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-2" onClick={() => handleDownloadPdf("style4", false)}>
                    উদ্দীপক/চিত্র ছাড়া <span className="text-xs text-muted-foreground ml-1">[Medical Pattern]</span>
                  </Button>
                </>
              ) : (
                <Button variant="outline" className="justify-start h-auto py-2" onClick={() => handleDownloadPdf("style4", true)}>
                  OMR Style
                </Button>
              )}
            </div>
          </div>
          )}
          </>
          )}
        </div>
      </DialogContent>
    </Dialog>
    {[...exams].filter((x) => !deletedExamIds.has(x.id)).sort((a, b) => {
      const uA = isExamUnlocked(a, enrolledIds, fullAccessCourseIds, subChapterGrants);
      const uB = isExamUnlocked(b, enrolledIds, fullAccessCourseIds, subChapterGrants);
      if (uA === uB) return 0;
      return uA ? -1 : 1; // Unlocked exams first, locked ones pushed below.
    }).map((exam) => {
      const unlocked = isExamUnlocked(exam, enrolledIds, fullAccessCourseIds, subChapterGrants);
      return (
        <Card key={exam.id} className={`relative cursor-pointer transition-all hover:shadow-md group ${unlocked ? "hover:border-primary/50" : "border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10"}`}
          onClick={() => {
            if (isAdmin && bulkSelectMode) {
              setBulkSelectedExamIds((prev) => {
                const next = new Set(prev);
                if (next.has(exam.id)) next.delete(exam.id); else next.add(exam.id);
                return next;
              });
              return;
            }
            if (!unlocked) { onLockedClick?.(exam); return; }
            setExamSourceList(exam.id, listPath);
            navigate(`${examPath}/${exam.id}`);
          }}>
          {isAdmin && bulkSelectMode && (
            <div className="absolute top-1.5 left-1.5 z-10">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={bulkSelectedExamIds.has(exam.id)}
                onChange={() => {}}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
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
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <div className="flex-1 min-w-0 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <p className="text-[10px] font-mono uppercase">{exam.course?.name || "Public"}</p>
                <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /><span>{exam.duration_minutes} min</span></div>
                <div className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /><span>{exam.questions_count?.[0]?.count || 0} Q</span></div>
                <Badge variant="outline" className="text-blue-500 border-blue-200 text-[10px] px-1.5 py-0">Readymade</Badge>
                {!unlocked && <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5 py-0 gap-0.5"><Lock className="h-2.5 w-2.5" />Premium</Badge>}
              </div>
              {unlocked && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] bg-blue-500 hover:bg-blue-600 text-white hover:text-white shrink-0"
                  disabled={downloadingId === exam.id}
                  onClick={(e) => openPracticeSheetPicker(e, exam)}
                >
                  {downloadingId === exam.id ? "..." : "Practice Sheet"}
                </Button>
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1 mt-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                  onClick={(e) => handleDownloadCsv(e, exam)}
                  title="CSV ডাউনলোড করুন"
                >
                  <FileDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary"
                  onClick={(e) => { e.stopPropagation(); setSplittingExam(exam); }}
                >
                  Split
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary"
                  onClick={(e) => { e.stopPropagation(); setTopicAddExam(exam); }}
                >
                  Topic Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-sky-600"
                  onClick={(e) => openSendDialog(e, exam)}
                  title="Telegram চ্যানেলে পাঠান"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-violet-600 hover:text-violet-700 gap-1"
                  onClick={(e) => handleAiTagSingle(e, exam)}
                >
                  <Sparkles className="h-3 w-3" /> AI Tag
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 ml-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={(e) => { e.stopPropagation(); setDeleteExamTarget(exam); }}
                  title="Delete exam"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            {cardJobs[exam.id] && (
              <div className="mt-1.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${cardJobs[exam.id].status === "error" ? "bg-red-500" : cardJobs[exam.id].status === "cancelled" ? "bg-amber-500" : "bg-sky-500"}`}
                    style={{ width: `${cardJobs[exam.id].pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-1">
                  {cardJobs[exam.id].status === "done" ? <><CheckCircle className="h-3 w-3" /> সম্পন্ন</>
                    : cardJobs[exam.id].status === "error" ? "ব্যর্থ"
                    : cardJobs[exam.id].status === "cancelled" ? "থামানো হয়েছে"
                    : `পাঠানো হচ্ছে ${cardJobs[exam.id].sentTotal}/${cardJobs[exam.id].total}`}
                </span>
                {(cardJobs[exam.id].status === "queued" || cardJobs[exam.id].status === "running") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 shrink-0"
                    onClick={() => handleStopCardJob(exam.id)}
                  >
                    Stop
                  </Button>
                )}
              </div>
            )}
          </CardContent>
          {unlocked && (
            <div className="px-4 pb-3 -mt-1 w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-1 w-full">
                <TopicPickerToggle
                  examId={exam.id}
                  open={openPanelExamId === exam.id && openPanelType === "topic"}
                  setOpen={(v) => {
                    if (v) { setOpenPanelExamId(exam.id); setOpenPanelType("topic"); }
                    else { setOpenPanelExamId(null); setOpenPanelType(null); }
                  }}
                />
                <SplitExamToggle
                  parentId={exam.id}
                  isAdmin={isAdmin}
                  open={openPanelExamId === exam.id && openPanelType === "split"}
                  setOpen={(v) => {
                    if (v) { setOpenPanelExamId(exam.id); setOpenPanelType("split"); }
                    else { setOpenPanelExamId(null); setOpenPanelType(null); }
                  }}
                />
              </div>
              {openPanelExamId === exam.id && openPanelType === "topic" && (
                <div className="mt-1 w-full">
                  <TopicPickerPanel examId={exam.id} exam={exam} navigate={navigate} isAdmin={isAdmin} openPracticeSheetPicker={openPracticeSheetPicker} listPath={listPath} examPath={examPath} />
                </div>
              )}
              {openPanelExamId === exam.id && openPanelType === "split" && (
                <div className="mt-1 w-full">
                  <SplitExamPanel parentId={exam.id} navigate={navigate} isAdmin={isAdmin} listPath={listPath} examPath={examPath} />
                </div>
              )}
            </div>
          )}
        </Card>
      );
    })}
  </div>
  );
};


export default Readymade;
