import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Send, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { askAI, renderAnswer, containsSexualContentRequest } from "@/pages/public/AtlasAI";
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
  ai_explanation?: string | null; // pre-cached explanation, if the row already carries it
}

const LABELS = ["A", "B", "C", "D"] as const;

/** systemPrompt for MCQ AI calls — kept minimal on purpose. AtlasApp (same AI
 *  proxy, same models) uses just this one line and gets clean plain-text
 *  answers reliably; a longer list of strict "never do X" rules was found to
 *  make some Groq models drift into inventing JSON instead of following them. */
const MCQ_SYSTEM_PROMPT = `তুমি ATLAS APP-এর বিশেষজ্ঞ শিক্ষক। বাংলায় বিস্তারিত উত্তর দিবে।`;

function getOptions(q: McqLike) {
  return [q.option_a, q.option_b, q.option_c, q.option_d].filter(
    (o): o is string => !!o && o !== "—"
  );
}

function buildFullMcqBlock(q: McqLike) {
  const opts = getOptions(q);
  const correctIdx = LABELS.indexOf((q.correct_option || "A") as any);
  let block = `প্রশ্ন: ${q.question_text}\n`;
  opts.forEach((opt, i) => {
    block += `${LABELS[i]}) ${opt}\n`;
  });
  block += `সঠিক উত্তর: ${LABELS[correctIdx]}) ${opts[correctIdx] || ""}`;
  return block;
}

function buildExplainPrompt(q: McqLike) {
  const mcqBlock = buildFullMcqBlock(q);
  const correctIdx = LABELS.indexOf((q.correct_option || "A") as any);
  const opts = getOptions(q);
  const wrongLabels = LABELS.slice(0, opts.length).filter((_, i) => i !== correctIdx);
  return `নিচের সম্পূর্ণ MCQ-টি (প্রশ্ন ও সবগুলো অপশন একসাথে) পড়ে সংক্ষিপ্ত ও নির্ভুল ব্যাখ্যা দাও:\n\n${mcqBlock}\n\nনিয়ম:\n১. মূল ফোকাস থাকবে সঠিক উত্তরে — ✅ ${LABELS[correctIdx]}) কেন সঠিক তা পাঠ্যবই-ভিত্তিক সঠিক তথ্য দিয়ে ৩-৪ লাইনে স্পষ্টভাবে লিখো, এবং প্রাসঙ্গিক একটু অতিরিক্ত তথ্য বা related concept যোগ করো যা শিক্ষার্থীর বোঝা ও পরীক্ষার জন্য কাজে লাগবে (অপ্রাসঙ্গিক কিছু নয়)। গুরুত্বপূর্ণ টার্ম থাকলে দুটো তারা চিহ্নের মাঝে বসাবে (যেমন রক্তকণিকা), খালি তারা চিহ্ন কখনো লিখবে না।\n২. বাকি অপশনগুলো (${wrongLabels.join(", ")}) কেন ভুল — প্রতিটির জন্য মাত্র ১ লাইনে সংক্ষেপে কারণ লিখো, বিস্তারিত ব্যাখ্যা নয়।\n৩. অতিরিক্ত ভূমিকা, পুনরাবৃত্তি বা সাধারণ টিপস যোগ করবে না — শুধু উপরের দুই অংশ, একদম To the point।`;
}

/** Best-effort repair for JSON truncated mid-string/mid-object (common when a
 *  provider's forced JSON mode hits its output limit before finishing). */
function repairTruncatedJson(s: string): string {
  let out = s;
  // Odd number of unescaped quotes -> an open string was cut off; close it.
  const quoteCount = (out.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 === 1) out += '"';
  // Balance any open brackets/braces.
  const opens = (out.match(/[{[]/g) || []).length;
  const closes = (out.match(/[}\]]/g) || []).length;
  for (let i = 0; i < opens - closes; i++) {
    const lastOpen = Math.max(out.lastIndexOf("{"), out.lastIndexOf("["));
    out += out.lastIndexOf("{") === lastOpen ? "}" : "]";
  }
  return out;
}

/** Last-resort extraction when JSON can't be parsed/repaired at all: pull out
 *  any "option"/"reason"-style string values so at least the content survives
 *  as plain text instead of showing nothing or raw braces. */
function extractReadableFallback(raw: string): string | null {
  const matches = [...raw.matchAll(/"(?:option|reason|question)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) =>
    m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim()
  );
  return matches.length ? matches.join("\n\n") : null;
}

/** Last-resort, shape-agnostic JSON-to-text conversion: walks any object/array
 *  recursively and pulls out every string value, skipping structural keys.
 *  Used when the AI invents a JSON shape we don't have a specific parser for
 *  (e.g. Bangla-keyed nested objects) so at least readable content survives. */
function genericJsonToText(parsed: any): string | null {
  const lines: string[] = [];
  const seen = new Set<string>();
  const visit = (val: any) => {
    if (val == null) return;
    if (typeof val === "string") {
      const s = val.trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        lines.push(s);
      }
      return;
    }
    if (Array.isArray(val)) {
      val.forEach(visit);
      return;
    }
    if (typeof val === "object") {
      Object.values(val).forEach(visit);
    }
  };
  visit(parsed);
  return lines.length ? lines.join("\n\n") : null;
}

/** If the AI proxy ever returns raw JSON (e.g. [{question, options:[{option,correct,reason}]}])
 *  instead of following the plain-text instruction, convert it into our ✅/❌/💡 format here so
 *  the UI never shows raw braces/brackets. Returns the original text untouched if it isn't JSON. */
function normalizeAiAnswer(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    // Safety net: strip stray markdown heading hashes (##, ###...) the model
    // may emit despite the plain-text instruction, so cached text stays clean.
    return raw.replace(/^\s*#{1,6}\s*/gm, "");
  }

  const toLines = (parsedIn: any): string | null => {
    const parsed = Array.isArray(parsedIn) ? parsedIn : [parsedIn];
    const lines: string[] = [];
    for (const item of parsed) {
      const opts = Array.isArray(item?.options) ? item.options : [];
      const correctOpt = opts.find((o: any) => o?.correct === true);
      if (correctOpt) {
        lines.push(`✅ **${correctOpt.option ?? ""}** — ${correctOpt.reason ?? ""}`.trim());
      }
      for (const o of opts) {
        if (o === correctOpt) continue;
        lines.push("");
        lines.push(`❌ **${o?.option ?? ""}** — ${o?.reason ?? ""}`.trim());
      }
    }
    return lines.length ? lines.join("\n") : null;
  };

  try {
    const parsed = JSON.parse(trimmed);
    return toLines(parsed) ?? genericJsonToText(parsed) ?? raw;
  } catch {
    // Try repairing a truncated response before giving up.
    try {
      const parsed = JSON.parse(repairTruncatedJson(trimmed));
      return toLines(parsed) ?? genericJsonToText(parsed) ?? raw;
    } catch {
      return extractReadableFallback(trimmed) ?? raw;
    }
  }
}

/** Read the cached explanation for a question directly from exam_questions (single row, fast). */
async function readCachedExplanation(questionId: string): Promise<string | null> {
  const { data, error } = await (supabase.rpc as any)("get_cached_ai_explanation", {
    p_question_id: questionId,
  });
  if (error || !data) return null;
  return normalizeAiAnswer(data as string);
}

const AI_FAILURE_MARKERS = ["❌", "⏱️"];

function isFailureResponse(text: string) {
  return AI_FAILURE_MARKERS.some((m) => text.startsWith(m));
}

/** Generate via AI then persist to the shared cache so every future viewer gets an instant read. */
async function generateAndCacheExplanation(q: McqLike, questionId?: string): Promise<string> {
  const raw = await askAI(buildExplainPrompt(q), null, MCQ_SYSTEM_PROMPT);
  const answer = normalizeAiAnswer(raw);
  if (questionId && !isFailureResponse(answer)) {
    // Fire-and-forget: don't block the UI on the cache write.
    // Never cache a failure/busy message — only real explanations should be cached forever.
    (supabase.rpc as any)("save_ai_explanation", {
      p_question_id: questionId,
      p_explanation: answer,
    }).then(() => {});
  }
  return answer;
}

/**
 * Silently pre-generate + cache explanations for a batch of questions that
 * don't have one yet. Call this once when a review/result page mounts, so
 * that by the time a user clicks "ব্যাখ্যা" it's very likely already cached.
 * Safe to call repeatedly; skips already-cached questions and runs in the
 * background without blocking any UI.
 */
export function prewarmExplanations(qs: (McqLike & { id?: string })[]) {
  const targets = qs.filter((q) => q.id && !q.ai_explanation);
  if (targets.length === 0) return;
  // Stagger slightly to avoid hammering the AI proxy all at once.
  targets.forEach((q, i) => {
    setTimeout(() => {
      generateAndCacheExplanation(q, q.id).catch(() => {});
    }, i * 400);
  });
}

/** Inline dropdown "AI ব্যাখ্যা" box — click to load/expand. Uses cached explanation when available. */
export function AiExplanationBox({ q, questionId }: { q: McqLike; questionId?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(
    q.ai_explanation ? normalizeAiAnswer(q.ai_explanation) : null
  );
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const cached = questionId ? await readCachedExplanation(questionId) : null;
      if (cached) {
        setAnswer(cached);
        return;
      }
      const res = await generateAndCacheExplanation(q, questionId);
      if (isFailureResponse(res)) {
        setError(true);
      } else {
        setAnswer(res);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && answer === null && !loading) {
      load();
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
          <div className="pt-2 pb-2 mb-2 border-b border-primary/10 space-y-1.5">
            <p className="font-semibold">{q.question_text}</p>
            {getOptions(q).map((opt, i) => (
              <p
                key={i}
                className={cn(LABELS[i] === q.correct_option && "text-emerald-500 font-semibold")}
              >
                {LABELS[i]}) {opt}
              </p>
            ))}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> AI বিশ্লেষণ করছে...
            </div>
          ) : error ? (
            <div className="py-2 flex items-center gap-2 text-sm text-destructive">
              <span>ব্যাখ্যা লোড করা যায়নি।</span>
              <button type="button" onClick={load} className="underline font-medium">
                আবার চেষ্টা করুন
              </button>
            </div>
          ) : (
            <div className="pt-2 space-y-2">{answer && renderAnswer(answer)}</div>
          )}
        </div>
      )}
    </div>
  );
}

/** "AI Chat" button + near-fullscreen modal for follow-up Q&A on a specific MCQ. Cache-aware for instant open. */
export function AiChatButton({ q, questionId }: { q: McqLike; questionId?: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; related?: RelatedMcq[] }[]
  >([]);
  const [input, setInput] = useState("");
  const [initialAnswer, setInitialAnswer] = useState<string | null>(
    q.ai_explanation ? normalizeAiAnswer(q.ai_explanation) : null
  );

  const openChat = async () => {
    setModalOpen(true);
    if (initialAnswer !== null) {
      if (messages.length === 0) setMessages([{ role: "assistant", content: initialAnswer }]);
      return;
    }
    if (!loading) {
      setLoading(true);
      const cached = questionId ? await readCachedExplanation(questionId) : null;
      const res = cached ?? (await generateAndCacheExplanation(q, questionId));
      setInitialAnswer(res);
      setMessages([{ role: "assistant", content: res }]);
      setLoading(false);
    }
  };

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
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

    if (containsSexualContentRequest(msg)) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "দুঃখিত, এই ধরনের বিষয়ে আমি সাহায্য করতে পারবো না। এই MCQ সম্পর্কে অন্য কোনো প্রশ্ন থাকলে জিজ্ঞেস করো। 📚",
        },
      ]);
      setLoading(false);
      return;
    }

    const context = `নিচের সম্পূর্ণ MCQ-টি মাথায় রেখে ফলো-আপ প্রশ্নের বিস্তারিত উত্তর দাও:\n\n${buildFullMcqBlock(q)}\n\nফলো-আপ প্রশ্ন: ${msg}\n\n(উপরের প্রশ্ন/অপশনের প্রেক্ষাপট মাথায় রেখে পাঠ্যবই-ভিত্তিক জ্ঞান দিয়ে বিস্তারিতভাবে উত্তর দাও; কোনো নির্দিষ্ট তথ্য নিয়ে সত্যিই অনিশ্চিত হলে বলো। সাদা বাংলা টেক্সটে লিখবে, কখনো JSON/{}/[] ব্যবহার করবে না, উত্তর অসম্পূর্ণ রেখে থামবে না।)`;
    const answer = normalizeAiAnswer(await askAI(context, null, MCQ_SYSTEM_PROMPT));
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
        <DialogContent className="max-w-3xl w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> ATLAS AI Chat
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 p-4">
            <div className="rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
              <strong>প্রশ্ন:</strong> {q.question_text}
              {getOptions(q).map((opt, i) => (
                <div key={i} className={cn(LABELS[i] === q.correct_option && "text-emerald-500 font-semibold")}>
                  {LABELS[i]}) {opt}
                </div>
              ))}
            </div>
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md p-3 text-sm",
                  m.role === "user" ? "bg-primary/10 ml-6 whitespace-pre-wrap" : "bg-secondary/50 mr-2 space-y-2"
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

          <div className="flex gap-2 p-3 border-t">
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
