import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Send, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const AI_PROXY_URL = "https://atlas-ai-proxy.hamza818483.workers.dev/";

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
  let prompt = `তুমি একজন বিশেষজ্ঞ শিক্ষক। MCQ-টি বিস্তারিতভাবে বাংলায় ব্যাখ্যা করো:\n\nপ্রশ্ন: ${q.question_text}\n\n`;
  opts.forEach((opt, i) => {
    prompt += `${LABELS[i]}) ${opt}\n`;
  });
  prompt += `\nসঠিক উত্তর: ${LABELS[correctIdx]}) ${opts[correctIdx] || ""}\n\n`;
  prompt += `সংক্ষেপে (মোট ১৫০-২০০ শব্দের মধ্যে) বাংলায় ব্যাখ্যা করো:\n১. কেন ${LABELS[correctIdx]} সঠিক\n২. বাকি অপশনগুলো কেন ভুল (১ লাইনে প্রতিটি)\n৩. মনে রাখার একটি ছোট টিপস\n\nসহজ, পরিষ্কার ভাষায়, অপ্রয়োজনীয় বিস্তার এড়িয়ে।`;
  return prompt;
}

async function callAI(prompt: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(AI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        question: prompt,
        image: null,
        systemPrompt: "তুমি একজন বিশেষজ্ঞ শিক্ষক। বাংলায় বিস্তারিত উত্তর দিবে।",
      }),
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data?.success && data?.answer) return String(data.answer).trim();
    if (data?.answer) return String(data.answer).trim();
  } catch {
    // fall through
  }
  return "AI ব্যাখ্যা পাওয়া যায়নি। পরে চেষ্টা করুন।";
}

/** Inline dropdown "AI ব্যাখ্যা" box — click to load/expand. */
export function AiExplanationBox({ q }: { q: McqLike }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && answer === null && !loading) {
      setLoading(true);
      const res = await callAI(buildExplainPrompt(q));
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
          <Sparkles className="h-4 w-4" /> AI ব্যাখ্যা
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
            <div className="whitespace-pre-wrap pt-2">{answer}</div>
          )}
        </div>
      )}
    </div>
  );
}

/** "AI Chat" button + modal for follow-up Q&A on a specific MCQ. */
export function AiChatButton({ q }: { q: McqLike }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [initialAnswer, setInitialAnswer] = useState<string | null>(null);

  const openChat = async () => {
    setModalOpen(true);
    if (initialAnswer === null && !loading) {
      setLoading(true);
      const res = await callAI(buildExplainPrompt(q));
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
    const context = `MCQ: ${q.question_text}\nঅপশনস: ${opts.join(", ")}\n\nফলো-আপ প্রশ্ন: ${msg}`;
    const answer = await callAI(context);
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
              <Sparkles className="h-4 w-4 text-primary" /> AI Chat
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
                  "rounded-md p-3 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary/10 ml-6"
                    : "bg-secondary/50 mr-2"
                )}
              >
                {m.content}
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
