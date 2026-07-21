import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Send, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { askAI, renderAnswer } from "@/pages/public/AtlasAI";
import { supabase } from "@/integrations/supabase/client";

interface RelatedMcq {
  id: string;
  exam_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string | null;
}

const RELATED_MCQ_TRIGGER = /আরো|আরও|related|similar|অন্য.*(mcq|প্রশ্ন)|আরেকটা|more (mcq|question)/i;

function extractSearchTerm(q: McqLike, userMsg: string) {
  // Prefer a meaningful chunk of the user's own follow-up if it's specific enough,
  // else fall back to a keyword slice from the original question text.
  const cleaned = userMsg.replace(RELATED_MCQ_TRIGGER, "").trim();
  if (cleaned.length > 3) return cleaned;
  return q.question_text.slice(0, 40);
}

async function fetchRelatedMcqs(term: string, excludeId?: string): Promise<RelatedMcq[]> {
  const { data, error } = await (supabase.rpc as any)("search_related_mcqs", {
    p_query: term,
    p_exclude_id: excludeId ?? null,
    p_limit: 5,
  });
  if (error || !data) return [];
  return data as RelatedMcq[];
}

interface McqLike {
  question_text: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_option?: string; // "A" | "B" | "C" | "D"
}

const LABELS = ["A", "B", "C", "D"] as const;

function getOptions(q: McqLike) {
  return [q.option_a, q.option_b, q.option_c, q.option_d].filter(
    (o): o is string => !!o && o !== "—"
  );
}

function buildExplainPrompt(q: McqLike) {
  const opts = getOptions(q);
  const correctIdx = LABELS.indexOf((q.correct_option || "A") as any);
  let prompt = `এই MCQ-টি বিস্তারিতভাবে বাংলায় ব্যাখ্যা করো:\n\nপ্রশ্ন: ${q.question_text}\n\n`;
  opts.forEach((opt, i) => {
    prompt += `${LABELS[i]}) ${opt}\n`;
  });
  prompt += `\nসঠিক উত্তর: ${LABELS[correctIdx]}) ${opts[correctIdx] || ""}\n\n`;
  prompt += `সংক্ষেপে ব্যাখ্যা করো:\n১. কেন ${LABELS[correctIdx]} সঠিক\n২. বাকি অপশনগুলো কেন ভুল (১ লাইনে প্রতিটি)\n৩. মনে রাখার একটি ছোট টিপস`;
  return prompt;
}

/** Inline dropdown "AI ব্যাখ্যা" box — click to load/expand. Uses ATLAS AI (askAI). */
export function AiExplanationBox({ q }: { q: McqLike }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && answer === null && !loading) {
      setLoading(true);
      const res = await askAI(buildExplainPrompt(q), null);
      setAnswer(res);
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-primary"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" /> ATLAS AI ব্যাখ্যা
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 text-sm leading-relaxed text-foreground/90 border-t border-primary/10">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> AI বিশ্লেষণ করছে...
            </div>
          ) : (
            <div className="pt-2 space-y-0.5">{answer && renderAnswer(answer)}</div>
          )}
        </div>
      )}
    </div>
  );
}

/** "AI Chat" button + modal for follow-up Q&A on a specific MCQ. Uses ATLAS AI (askAI). */
export function AiChatButton({ q, questionId }: { q: McqLike; questionId?: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; related?: RelatedMcq[] }[]
  >([]);
  const [input, setInput] = useState("");
  const [initialAnswer, setInitialAnswer] = useState<string | null>(null);

  const openChat = async () => {
    setModalOpen(true);
    if (initialAnswer === null && !loading) {
      setLoading(true);
      const res = await askAI(buildExplainPrompt(q), null);
      setInitialAnswer(res);
      setMessages([{ role: "assistant", content: res }]);
      setLoading(false);
    }
  };

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    const opts = getOptions(q);
    const nextMessages = [...messages, { role: "user" as const, content: msg }];
    setMessages(nextMessages);
    setLoading(true);

    if (RELATED_MCQ_TRIGGER.test(msg)) {
      const term = extractSearchTerm(q, msg);
      const related = await fetchRelatedMcqs(term, questionId);
      const note = related.length
        ? `${related.length}টি সম্পর্কিত MCQ পাওয়া গেছে, নিচে দেখো।`
        : "দুঃখিত, এই মুহূর্তে সম্পর্কিত কোনো MCQ খুঁজে পাওয়া যায়নি।";
      setMessages([...nextMessages, { role: "assistant", content: note, related }]);
      setLoading(false);
      return;
    }

    const context = `MCQ: ${q.question_text}\nঅপশনস: ${opts.join(", ")}\n\nফলো-আপ প্রশ্ন: ${msg}`;
    const answer = await askAI(context, null);
    setMessages([...nextMessages, { role: "assistant", content: answer }]);
    setLoading(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openChat}
        className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
      >
        <Sparkles className="h-3.5 w-3.5" /> AI Chat
      </Button>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> ATLAS AI Chat
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            <div className="rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
              <strong>প্রশ্ন:</strong> {q.question_text}
            </div>
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md p-3 text-sm",
                  m.role === "user" ? "bg-primary/10 ml-6 whitespace-pre-wrap" : "bg-secondary/50 mr-2 space-y-0.5"
                )}
              >
                {m.role === "assistant" ? renderAnswer(m.content) : m.content}
                {m.related && m.related.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {m.related.map((r) => (
                      <div key={r.id} className="rounded-md border bg-background p-2.5 text-xs">
                        <div className="font-medium mb-1.5">{r.question_text}</div>
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                          {(["A", "B", "C", "D"] as const).map((k) => {
                            const val = (r as any)[`option_${k.toLowerCase()}`];
                            const isCorrect = r.correct_option === k;
                            return val ? (
                              <span key={k} className={cn(isCorrect && "text-emerald-500 font-semibold")}>
                                {k}) {val}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> উত্তর আসছে...
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="আরো জিজ্ঞেস করুন..."
              disabled={loading}
            />
            <Button type="button" onClick={send} disabled={loading} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
