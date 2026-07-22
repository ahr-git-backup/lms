import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookmarkX, ChevronDown } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface BookmarkedMcq {
  id: number;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  chapter_id: number;
  chapterName: string;
  subjectName: string;
  subjectId: number;
}

const LETTERS = ["A", "B", "C", "D", "E"];

const QuickPracticeBookmarks = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState<Record<string, BookmarkedMcq[]>>({});
  const [openSubject, setOpenSubject] = useState<string | null>(null);

  useEffect(() => {
    document.title = "আমার বুকমার্ক — Atlas";
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: bm } = await supabase.from("qp_bookmarks").select("mcq_id").eq("user_id", user.id);
    const mcqIds = (bm || []).map((b: any) => b.mcq_id);
    if (mcqIds.length === 0) {
      setGrouped({});
      setLoading(false);
      return;
    }

    const { data: mcqs } = await supabase
      .from("qp_mcqs")
      .select("id, question, options, correct_index, explanation, chapter_id")
      .in("id", mcqIds);

    const chapterIds = [...new Set((mcqs || []).map((m: any) => m.chapter_id))];
    const { data: chapters } = await supabase
      .from("qp_chapters")
      .select("id, name, subject_id")
      .in("id", chapterIds);
    const subjectIds = [...new Set((chapters || []).map((c: any) => c.subject_id))];
    const { data: subjects } = await supabase.from("qp_subjects").select("id, name").in("id", subjectIds);

    const subjMap = Object.fromEntries((subjects || []).map((s: any) => [s.id, s.name]));
    const chapMap = Object.fromEntries(
      (chapters || []).map((c: any) => [c.id, { name: c.name, subjectId: c.subject_id }])
    );

    const enriched: BookmarkedMcq[] = (mcqs || []).map((m: any) => {
      const chap = chapMap[m.chapter_id];
      return {
        ...m,
        options: Array.isArray(m.options) ? m.options : [],
        chapterName: chap?.name || "",
        subjectName: chap ? subjMap[chap.subjectId] || "" : "",
        subjectId: chap?.subjectId,
      };
    });

    const byCategory: Record<string, BookmarkedMcq[]> = {};
    for (const m of enriched) {
      const key = m.subjectName || "অন্যান্য";
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(m);
    }
    setGrouped(byCategory);
    const firstKey = Object.keys(byCategory)[0];
    setOpenSubject(firstKey || null);
    setLoading(false);
  };

  const removeBookmark = async (mcqId: number) => {
    if (!user) return;
    await supabase.from("qp_bookmarks").delete().eq("user_id", user.id).eq("mcq_id", mcqId);
    setGrouped((prev) => {
      const next: Record<string, BookmarkedMcq[]> = {};
      for (const [k, arr] of Object.entries(prev)) {
        const filtered = arr.filter((m) => m.id !== mcqId);
        if (filtered.length > 0) next[k] = filtered;
      }
      return next;
    });
  };

  const categories = Object.keys(grouped);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate("/quick-practice")}
            className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-extrabold text-lg">আমার বুকমার্ক</h1>
        </div>

        {loading && <div className="text-center text-muted-foreground py-10">লোড হচ্ছে...</div>}

        {!loading && !user && (
          <div className="text-center text-muted-foreground py-10">বুকমার্ক দেখতে লগইন করুন।</div>
        )}

        {!loading && user && categories.length === 0 && (
          <div className="text-center text-muted-foreground py-10">কোনো বুকমার্ক নেই এখনো।</div>
        )}

        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat} className="rounded-xl border bg-card overflow-hidden">
              <button
                onClick={() => setOpenSubject(openSubject === cat ? null : cat)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <span className="font-extrabold text-sm">
                  📘 {cat} <span className="text-muted-foreground font-semibold">({grouped[cat].length})</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", openSubject === cat && "rotate-180")} />
              </button>

              {openSubject === cat && (
                <div className="px-4 pb-4 space-y-4 border-t pt-3">
                  {grouped[cat].map((m) => (
                    <div key={m.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {m.chapterName}
                        </span>
                        <button
                          onClick={() => removeBookmark(m.id)}
                          className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-destructive/10 text-destructive"
                        >
                          <BookmarkX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-sm font-bold mb-2">{m.question}</p>
                      <div className="flex flex-col gap-1.5">
                        {m.options.map((opt, oi) => (
                          <div
                            key={oi}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs",
                              oi === m.correct_index ? "border-emerald-500 bg-emerald-500/10" : "border-border"
                            )}
                          >
                            <span className="h-5 w-5 rounded-md flex items-center justify-center font-extrabold text-[10px] bg-muted flex-shrink-0">
                              {LETTERS[oi]}
                            </span>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                      {m.explanation && (
                        <div className="mt-2 p-2.5 rounded-lg bg-muted/50 border-l-4 border-primary text-[11px] leading-relaxed">
                          {m.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickPracticeBookmarks;
