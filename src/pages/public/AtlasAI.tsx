import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Paperclip,
  X,
  Trash2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Lightbulb,
} from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { cn } from "@/lib/utils";

const AI_PROXY_URL = "https://atlas-ai-proxy.hamza818483.workers.dev/";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  imagePreview?: string;
  fileName?: string;
}

export interface PendingImage {
  base64: string;
  mimeType: string;
  name: string;
  size: number;
  previewUrl: string;
}

interface PendingFile {
  text: string;
  name: string;
  type: string;
}

function detectSubject(qRaw: string) {
  const q = qRaw.toLowerCase();
  const rules: { s: string; kw: string[] }[] = [
    {
      s: "biology",
      kw: [
        "dna", "rna", "কোষ", "প্রাণী", "উদ্ভিদ", "সালোকসংশ্লেষণ", "জীবাণু",
        "হরমোন", "এনজাইম", "রক্ত", "হৃদযন্ত্র", "মস্তিষ্ক", "প্রোটিন", "জিন",
        "ক্রোমোজোম", "মাইটোসিস", "মিয়োসিস", "ফটোসিন্থেসিস", "ডিএনএ",
      ],
    },
    {
      s: "chemistry",
      kw: [
        "রাসায়নিক", "বন্ধন", "মৌল", "যৌগ", "পর্যায়", "অ্যাসিড", "ক্ষার",
        "লবণ", "h₂o", "co₂", "nacl", "ph", "বিক্রিয়া", "অক্সিজেন",
        "হাইড্রোজেন", "ইলেকট্রন", "আয়ন", "পারমাণবিক", "অণু",
      ],
    },
    {
      s: "physics",
      kw: [
        "বল", "ভর", "বেগ", "ত্বরণ", "তরঙ্গ", "তাপ", "আলো", "শব্দ",
        "চৌম্বক", "বিদ্যুৎ", "নিউটন", "ওহম", "ভোল্ট", "শক্তি", "কাজ",
        "গতি", "অভিকর্ষ", "তড়িৎ",
      ],
    },
    {
      s: "math",
      kw: [
        "ম্যাট্রিক্স", "ভেক্টর", "ক্যালকুলাস", "যোগফল", "গুণফল", "সমীকরণ",
        "sin", "cos", "tan", "log", "যোগ", "গুণ", "ভাগ", "বিয়োগ", "লগ",
        "ত্রিকোণমিতি", "সীমা",
      ],
    },
    {
      s: "bangla",
      kw: [
        "বাংলা", "ব্যাকরণ", "রচনা", "কবি", "সাহিত্য", "সমাস", "সন্ধি",
        "কারক", "বিভক্তি", "উপন্যাস", "কবিতা", "ছন্দ", "অলংকার",
      ],
    },
    {
      s: "english",
      kw: [
        "tense", "preposition", "verb", "noun", "grammar", "voice",
        "narration", "paragraph", "article", "sentence", "adjective", "adverb",
      ],
    },
  ];
  for (const r of rules) {
    if (r.kw.some((k) => q.includes(k))) return r.s;
  }
  return "general";
}

export function getSystemPrompt(question: string) {
  const subj = detectSubject(question);
  const isMCQ =
    /\(ক\)|\(খ\)|\(গ\)|\(ঘ\)|ক\)|খ\)|গ\)|ঘ\)|A\)|B\)|C\)|D\)|[Aa][.)]|[Bb][.)]|[Cc][.)]|[Dd][.)]/.test(
      question
    );

  let prompt = `তুমি ATLAS AI — বাংলাদেশের HSC শিক্ষার্থীদের বিশেষজ্ঞ শিক্ষক। বাংলায় বিস্তারিত উত্তর দিবে।

নিয়ম:
১। বাংলায় উত্তর দিবে। English technical word-এর পাশে বাংলা অর্থ দিবে।
২। গাণিতিক সূত্র Unicode-এ লিখবে (LaTeX নয়)।
৩। উত্তর অবশ্যই সম্পূর্ণ ও বিস্তারিত করবে, মাঝখানে থামবে না। মূল ধারণা, কারণ, প্রাসঙ্গিক প্রেক্ষাপট ও উদাহরণ সহ ব্যাখ্যা করবে — সংক্ষিপ্ত করার দরকার নেই।
৪। কোনো Markdown সিনট্যাক্স ব্যবহার করবে না (যেমন #, -, বা কোনো code block)। শুধু গুরুত্বপূর্ণ শব্দ/লাইন **এভাবে** বোল্ড করতে পারবে, আর কিছু না।`;

  if (isMCQ) {
    prompt += `

এটি একটি MCQ প্রশ্ন। প্রথমে ✅ সঠিক উত্তর বলবে (২-৩ বাক্যে, প্রাসঙ্গিক ধারণা/সূত্র/কারণ সহ), তারপর প্রতিটি ভুল অপশনের জন্য ❌ কেন ভুল তার ১-২ বাক্যের সংক্ষিপ্ত স্পষ্ট কারণ দিবে, শেষে 💡 একটি ১ বাক্যের টিপস দিবে। প্রতিটি অংশ অবশ্যই সম্পূর্ণ বাক্যে শেষ করবে — বাক্য-সংখ্যার সীমা মেনে চলা মানে সম্পূর্ণ উত্তর নিশ্চিত করা, বিস্তারিত করতে গিয়ে উত্তর মাঝপথে অসম্পূর্ণ রাখা যাবে না।`;
  }

  const subjectMap: Record<string, string> = {
    biology: "তুমি বাংলাদেশ HSC জীববিজ্ঞান (Biology) বিশেষজ্ঞ। অধ্যাপক আবুল হাসানের বই অনুসরণ করবে।",
    chemistry: "তুমি বাংলাদেশ HSC রসায়ন (Chemistry) বিশেষজ্ঞ। HSC রসায়ন বই অনুসরণ করবে।",
    physics: "তুমি বাংলাদেশ HSC পদার্থবিজ্ঞান (Physics) বিশেষজ্ঞ। ড. শাহজাহান তপনের বই অনুসরণ করবে।",
    math: "তুমি বাংলাদেশ HSC উচ্চতর গণিত (Higher Math) বিশেষজ্ঞ।",
    bangla: "তুমি বাংলা ব্যাকরণ ও সাহিত্য বিশেষজ্ঞ। NCTB বাংলা বই অনুসরণ করবে।",
    english: "তুমি English Grammar বিশেষজ্ঞ। NCTB English for Today অনুসরণ করবে।",
    general: "তুমি সব বিষয়ে সাহায্য করতে পারো।",
  };
  prompt += "\n\n" + (subjectMap[subj] || subjectMap.general);

  return prompt;
}

export async function askAI(
  question: string,
  image: PendingImage | null,
  systemPromptOverride?: string,
  opts?: { skipGroq?: boolean }
): Promise<string> {
  const systemPrompt = systemPromptOverride ?? getSystemPrompt(question || "ছবি বিশ্লেষণ করো");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(AI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        question: question || "",
        image: image ? { base64: image.base64, mimeType: image.mimeType } : null,
        systemPrompt,
        skipGroq: !!opts?.skipGroq,
      }),
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data?.answer && String(data.answer).trim().length > 5) {
      return String(data.answer).trim();
    }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return "⏱️ উত্তর দিতে বেশি সময় লাগছে। আবার চেষ্টা করো অথবা প্রশ্নটি ছোট করো।";
    }
  }
  return "❌ দুঃখিত! ATLAS AI এখন একটু busy আছে। কিছুক্ষণ পর আবার চেষ্টা করো। 🙏";
}

// Converts "**bold**" markdown into real <strong> bold, no asterisks shown.
function renderBoldSegments(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) return <strong key={idx}>{m[1]}</strong>;
    return <span key={idx}>{part}</span>;
  });
}

export function renderAnswer(text: string) {
  // Render ✅ / ❌ / 💡 prefixed lines with icon + colored accent, rest as plain paragraphs.
  // A line is "empty content" if, after stripping the icon/label and any trailing
  // dash separator, nothing meaningful remains (guards against provider cutting
  // off mid-explanation and leaving e.g. "❌ A) স্টাচ —" with nothing after it).
  const isEmptyContent = (s: string) => {
    const stripped = s.replace(/^[✅❌💡]\s*/, "").replace(/[-—–]\s*$/, "").trim();
    return stripped.length === 0;
  };
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("✅")) {
      if (isEmptyContent(trimmed)) return null;
      return (
        <div key={i} className="flex items-start gap-2 text-emerald-500 font-semibold my-1">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{renderBoldSegments(trimmed.replace(/^✅\s*/, ""))}</span>
        </div>
      );
    }
    if (trimmed.startsWith("❌")) {
      if (isEmptyContent(trimmed)) return null;
      return (
        <div key={i} className="flex items-start gap-2 text-destructive my-1">
          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{renderBoldSegments(trimmed.replace(/^❌\s*/, ""))}</span>
        </div>
      );
    }
    if (trimmed.startsWith("💡")) {
      if (isEmptyContent(trimmed)) return null;
      return (
        <div key={i} className="flex items-start gap-2 text-amber-500 my-1">
          <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{renderBoldSegments(trimmed.replace(/^💡\s*/, ""))}</span>
        </div>
      );
    }
    if (trimmed.length === 0) return <div key={i} className="h-2" />;
    return (
      <p key={i} className="leading-relaxed">
        {renderBoldSegments(line)}
      </p>
    );
  });
}

const AtlasAI = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "ATLAS AI";
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("ছবি ৫MB-এর কম হতে হবে");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const base64 = result.split(",")[1] || "";
      setPendingImage({
        base64,
        mimeType: file.type || "image/jpeg",
        name: file.name,
        size: file.size,
        previewUrl: result,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingFile({ text: String(reader.result), name: file.name, type: file.type });
      };
      reader.readAsText(file);
    } else {
      setPendingFile({ text: "", name: file.name, type: file.type });
    }
    e.target.value = "";
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed && !pendingImage) return;
    if (busy) return;

    let question = trimmed;
    if (pendingFile?.text) {
      question = `${trimmed}\n\n[সংযুক্ত ফাইল: ${pendingFile.name}]\n${pendingFile.text.slice(0, 4000)}`;
    } else if (pendingFile) {
      question = `${trimmed}\n\n[সংযুক্ত ফাইল: ${pendingFile.name}]`;
    }

    const userMsg: ChatMsg = {
      role: "user",
      text: trimmed || "(ছবি পাঠানো হয়েছে)",
      imagePreview: pendingImage?.previewUrl,
      fileName: pendingFile?.name,
    };

    setMessages((m) => [...m, userMsg]);
    const imgToSend = pendingImage;
    setInput("");
    setPendingImage(null);
    setPendingFile(null);
    setBusy(true);

    const answer = await askAI(question, imgToSend);
    setMessages((m) => [...m, { role: "assistant", text: answer }]);
    setBusy(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const clearChat = () => {
    if (messages.length > 0 && !confirm("চ্যাট ক্লিয়ার করতে চান?")) return;
    setMessages([]);
  };

  return (
    <div className="h-[100dvh] bg-background text-foreground flex flex-col overflow-hidden">
      <PublicHeader />

      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b bg-card/50 z-20">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-extrabold text-sm">ATLAS AI</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1 text-xs text-destructive font-semibold px-2 py-1.5 rounded-lg hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            ক্লিয়ার
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 max-w-2xl w-full mx-auto px-4 py-4 flex flex-col gap-4 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="font-extrabold text-lg">ATLAS AI-তে স্বাগতম!</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              MCQ, HSC, Medical, Varsity — যেকোনো প্রশ্ন করো, ছবিও দিতে পারো
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                m.role === "user"
                  ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
                  : "bg-card border"
              )}
            >
              {m.imagePreview && (
                <img src={m.imagePreview} alt="attachment" className="rounded-lg mb-2 max-h-48 object-cover" />
              )}
              {m.fileName && !m.imagePreview && (
                <div className="flex items-center gap-1.5 text-xs opacity-80 mb-2">
                  <Paperclip className="h-3.5 w-3.5" />
                  {m.fileName}
                </div>
              )}
              {m.role === "assistant" ? (
                <div>{renderAnswer(m.text)}</div>
              ) : (
                <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-2xl px-4 py-3 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {pendingImage && (
        <div className="flex-shrink-0 max-w-2xl w-full mx-auto px-4">
          <div className="flex items-center gap-3 bg-muted rounded-xl p-2 mb-2">
            <img src={pendingImage.previewUrl} alt="preview" className="h-12 w-12 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{pendingImage.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {(pendingImage.size / 1024).toFixed(0)} KB
              </div>
            </div>
            <button
              onClick={() => setPendingImage(null)}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-background"
            >
              <X className="h-4 w-4 text-destructive" />
            </button>
          </div>
        </div>
      )}

      {pendingFile && (
        <div className="flex-shrink-0 max-w-2xl w-full mx-auto px-4">
          <div className="flex items-center gap-3 bg-muted rounded-xl p-2 mb-2">
            <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{pendingFile.name}</div>
            </div>
            <button
              onClick={() => setPendingFile(null)}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-background"
            >
              <X className="h-4 w-4 text-destructive" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 border-t bg-card/50">
        <div className="max-w-2xl w-full mx-auto px-4 py-3 flex items-end gap-2">
          <button
            onClick={() => imageInputRef.current?.click()}
            className="h-10 w-10 rounded-full border flex items-center justify-center hover:bg-muted flex-shrink-0"
            title="ছবি পাঠাও"
          >
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 rounded-full border flex items-center justify-center hover:bg-muted flex-shrink-0"
            title="ফাইল পাঠাও"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={3000}
            placeholder="প্রশ্ন লিখো... MCQ দিলে সঠিক উত্তর পাবে ✅"
            className="flex-1 resize-none rounded-2xl border bg-background px-4 py-2.5 text-sm max-h-32 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={() => void sendMessage()}
            disabled={busy || (!input.trim() && !pendingImage)}
            className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>
    </div>
  );
};

export default AtlasAI;
