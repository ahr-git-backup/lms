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
  History,
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

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMsg[];
}

const HISTORY_KEY = "atlas_ai_chat_sessions";
const LAST_ACTIVE_KEY = "atlas_ai_last_session_id";

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, 50)));
  } catch {
    /* storage full or unavailable — ignore */
  }
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

  let prompt = `তুমি ATLAS AI — বাংলাদেশের HSC শিক্ষার্থীদের বিশেষজ্ঞ শিক্ষক। বাংলায় বিস্তারিত উত্তর দিবে। English technical word-এর পাশে বাংলা অর্থ দিবে।

গাণিতিক/রাসায়নিক সূত্র লেখার নিয়ম (কঠোরভাবে মানতে হবে):
- কখনো LaTeX সিনট্যাক্স ব্যবহার করবে না — যেমন \\frac, \\rightarrow, \\times, $...$, \\(...\\), ^{...}, _{...} এসব একদমই লিখবে না।
- সবকিছু সরাসরি Unicode ক্যারেক্টার দিয়ে লিখবে: ভগ্নাংশের জন্য a/b অথবা প্রয়োজনে Unicode ভগ্নাংশ (½, ¼) ব্যবহার করবে।
- সূচক/ঘাত: x², x³, aⁿ এভাবে Unicode superscript ব্যবহার করবে (x^2 নয়)।
- সাবস্ক্রিপ্ট: H₂O, CO₂, H₂SO₄ এভাবে Unicode subscript ব্যবহার করবে (H2O নয়)। রাসায়নিক সংকেতে প্রতিটি সংখ্যা সংশ্লিষ্ট মৌলের ঠিক পরে subscript আকারে বসবে (যেমন CH₃COOH, Ca(OH)₂)।
- বিক্রিয়া তীরচিহ্ন: → (right arrow), ⇌ (বিপরীতমুখী/reversible বিক্রিয়ার জন্য), ↑ (গ্যাস উৎপন্ন), ↓ (অধঃক্ষেপ) — এইভাবে সরাসরি Unicode তীরচিহ্ন ব্যবহার করবে, কখনো "->", "<=>", "\\rightarrow" এসব লিখবে না।
- অন্যান্য গাণিতিক চিহ্ন সরাসরি Unicode-এ লিখবে: ×, ÷, ±, √, ∆, π, θ, °, ≈, ≤, ≥, ∞ ইত্যাদি।
- কোনো markdown/asterisk (** বা *) ব্যবহার করবে না — শুধু plain টেক্সট লিখবে।`;

  if (isMCQ) {
    prompt += `

এটি একটি MCQ প্রশ্ন। প্রথমে ✅ সঠিক উত্তর বলবে, তারপর প্রতিটি অপশন বিস্তারিতভাবে বিশ্লেষণ করবে — ✅ কেন সঠিক (প্রাসঙ্গিক ধারণা/সূত্র/কারণ সহ), ❌ বাকিগুলো কেন ভুল (প্রতিটির জন্য স্পষ্ট, বিস্তারিত কারণ)। শেষে 💡 মনে রাখার একটি টিপস দিতে পারো।`;
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

/** Single attempt — returns null (not a string) on failure so the caller can retry. */
async function askAIOnce(
  question: string,
  image: PendingImage | null,
  systemPrompt: string,
  skipGroq: boolean
): Promise<string | null> {
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
        skipGroq,
      }),
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data?.answer && String(data.answer).trim().length > 5) {
      return String(data.answer).trim();
    }
    return null;
  } catch {
    return null; // timeout ba network error — caller retry korbe
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// bug fix / reliability improvement (2026-07-22): age ekta single fetch fail
// (transient rate-limit, network blip, ekta provider-er temporary slow-down)
// hoile-i sathe sathe user-ke "❌ busy আছে" dekhano hoto — jokhono asholei
// worker-er full fallback chain (Gemini→OpenRouter→Groq→Cerebras→CF-AI) already
// beshirvag transient issue nijei solve kore fele, ekta 2nd/3rd try-e prai
// shob shomoy success hoy. Ekhon user kichu na bujhei (UI-te shudhu ektu beshi
// "লোড হচ্ছে" shomoy dekhbe) background-e up-to 3 bar silently retry hoy —
// kono ekta try success hole shathe shathe result dekhano hoy, r shudhu shob
// koyta try-i fail korle (truly rare — real outage) tobei friendly "busy" message
// dekhano hoy. Erokom-e user proyoget kokhono raw/mid-way failure dekhena.
const MAX_CLIENT_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

export async function askAI(
  question: string,
  image: PendingImage | null,
  systemPromptOverride?: string,
  opts?: { skipGroq?: boolean }
): Promise<string> {
  const systemPrompt = systemPromptOverride ?? getSystemPrompt(question || "ছবি বিশ্লেষণ করো");
  for (let attempt = 1; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    // প্রথম attempt-এ যা caller চেয়েছে (opts.skipGroq) তাই মানা হয়; retry-গুলোতে
    // skipGroq সবসময় true (Groq প্রথম attempt-এ আগেই একবার চেষ্টা হয়ে থাকলে সেটা
    // পুনরায় চেষ্টা করে সময়/subrequest নষ্ট না করে সরাসরি Gemini/OpenRouter/Cerebras/CF-AI
    // দিয়ে দ্রুত retry হয়)।
    const skipGroq = attempt === 1 ? !!opts?.skipGroq : true;
    const result = await askAIOnce(question, image, systemPrompt, skipGroq);
    if (result !== null) return result;
    if (attempt < MAX_CLIENT_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
  }
  return "❌ দুঃখিত! ATLAS AI এখন একটু busy আছে। কিছুক্ষণ পর আবার চেষ্টা করো। 🙏";
}

// Converts "**bold**" markdown into real <strong> bold, no asterisks shown.
function renderBoldSegments(line: string) {
  // safety net: model kokhono kokhono khali/placeholder bold marker (****, ** **) generate
  // kore fele — segulo screen-e literal tara chinho hisebe dekha jay, tai age strip kore newa
  const cleaned = line.replace(/\*\*\s*\*\*/g, "").replace(/\*{3,}/g, "");
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) return <strong key={idx}>{m[1]}</strong>;
    return <span key={idx}>{part}</span>;
  });
}

/** Last-resort, shape-agnostic JSON-to-text conversion: walks any object/array
 *  recursively and pulls out every string value, so if the AI invents an
 *  unpredictable JSON shape (e.g. Bangla-keyed nested objects), readable
 *  content still survives instead of showing raw braces/brackets. */
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

/** Safety net: if the AI ever returns raw JSON instead of the requested plain
 *  text, convert it into readable lines here so no call site of renderAnswer
 *  ever shows raw braces/brackets to the user. */
function ensurePlainText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return text;
  try {
    return genericJsonToText(JSON.parse(trimmed)) ?? text;
  } catch {
    return text;
  }
}

/** Safety net: if the model still slips into LaTeX-style notation despite the
 *  system prompt, convert common patterns into the Unicode equivalents so the
 *  user never sees raw LaTeX syntax on screen. */
function sanitizeLatex(text: string): string {
  let t = text;
  t = t.replace(/\$\$([^$]+)\$\$/g, "$1");
  t = t.replace(/\$([^$]+)\$/g, "$1");
  t = t.replace(/\\\(([^)]+)\\\)/g, "$1");
  t = t.replace(/\\\[([^\]]+)\\\]/g, "$1");
  t = t.replace(/\\rightarrow|\\to\b/g, "→");
  t = t.replace(/\\leftrightarrow|\\rightleftharpoons/g, "⇌");
  t = t.replace(/<=>|<->/g, "⇌");
  t = t.replace(/-+>/g, "→");
  t = t.replace(/\\times/g, "×");
  t = t.replace(/\\div/g, "÷");
  t = t.replace(/\\pm/g, "±");
  t = t.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");
  t = t.replace(/\\sqrt/g, "√");
  t = t.replace(/\\pi/g, "π");
  t = t.replace(/\\theta/g, "θ");
  t = t.replace(/\\Delta|\\triangle/g, "∆");
  t = t.replace(/\\approx/g, "≈");
  t = t.replace(/\\leq/g, "≤");
  t = t.replace(/\\geq/g, "≥");
  t = t.replace(/\\infty/g, "∞");
  t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2");
  const superMap: Record<string, string> = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
    "n": "ⁿ", "i": "ⁱ", "a": "ᵃ", "b": "ᵇ", "c": "ᶜ", "d": "ᵈ",
    "e": "ᵉ", "f": "ᶠ", "g": "ᵍ", "h": "ʰ", "j": "ʲ", "k": "ᵏ",
    "l": "ˡ", "m": "ᵐ", "o": "ᵒ", "p": "ᵖ", "r": "ʳ", "s": "ˢ",
    "t": "ᵗ", "u": "ᵘ", "v": "ᵛ", "w": "ʷ", "x": "ˣ", "y": "ʸ", "z": "ᶻ",
  };
  const subMap: Record<string, string> = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
    "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
    "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
    "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ", "k": "ₖ",
    "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ", "p": "ₚ", "r": "ᵣ",
    "s": "ₛ", "t": "ₜ", "u": "ᵤ", "v": "ᵥ", "x": "ₓ",
  };
  const toSuper = (s: string) =>
    s.split("").map((c) => superMap[c.toLowerCase()] ?? c).join("");
  const toSub = (s: string) =>
    s.split("").map((c) => subMap[c.toLowerCase()] ?? c).join("");
  // braced form first: ^{...} / _{...} — content may be any length (digits/letters/±)
  t = t.replace(/\^\{([^{}]+)\}/g, (_m, g1) => toSuper(g1));
  t = t.replace(/_\{([^{}]+)\}/g, (_m, g1) => toSub(g1));
  // unbraced single-token form: ^12, ^n, _2, _th
  t = t.replace(/\^([a-zA-Z0-9+\-]+)/g, (_m, g1) => toSuper(g1));
  t = t.replace(/_([a-zA-Z0-9+\-]+)/g, (_m, g1) => toSub(g1));
  t = t.replace(/\\([a-zA-Z]+)/g, "$1");
  return t;
}

export function renderAnswer(rawText: string) {
  const text = sanitizeLatex(ensurePlainText(rawText));
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
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
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
    setActiveSessionId(null);
    try {
      localStorage.removeItem(LAST_ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  };

  // Persist current conversation as a session whenever it changes
  useEffect(() => {
    if (messages.length === 0) return;
    const firstUserMsg = messages.find((m) => m.role === "user");
    const title = (firstUserMsg?.text || "নতুন চ্যাট").slice(0, 40);
    setSessions((prev) => {
      const id = activeSessionId ?? `${Date.now()}`;
      if (!activeSessionId) setActiveSessionId(id);
      const existingIdx = prev.findIndex((s) => s.id === id);
      const updated: ChatSession = {
        id,
        title,
        updatedAt: Date.now(),
        messages,
      };
      let next: ChatSession[];
      if (existingIdx >= 0) {
        next = [...prev];
        next[existingIdx] = updated;
      } else {
        next = [updated, ...prev];
      }
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      saveSessions(next);
      try {
        localStorage.setItem(LAST_ACTIVE_KEY, id);
      } catch {
        /* ignore */
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
    try {
      const lastId = localStorage.getItem(LAST_ACTIVE_KEY);
      if (lastId) {
        const found = loaded.find((s) => s.id === lastId);
        if (found) {
          setMessages(found.messages);
          setActiveSessionId(found.id);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const openSession = (session: ChatSession) => {
    setMessages(session.messages);
    setActiveSessionId(session.id);
    setShowHistory(false);
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveSessionId(null);
    setShowHistory(false);
    try {
      localStorage.removeItem(LAST_ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSessions(next);
      return next;
    });
    if (activeSessionId === id) {
      setMessages([]);
      setActiveSessionId(null);
      try {
        localStorage.removeItem(LAST_ACTIVE_KEY);
      } catch {
        /* ignore */
      }
    }
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
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-muted"
        >
          <History className="h-3.5 w-3.5" />
          হিস্ট্রি
        </button>
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

      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowHistory(false)}
          />
          <div className="relative ml-auto h-full w-full max-w-sm bg-background border-l flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-bold text-sm">চ্যাট হিস্ট্রি</span>
              <button
                onClick={() => setShowHistory(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={startNewChat}
              className="m-3 flex items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm font-semibold hover:bg-muted"
            >
              <Sparkles className="h-4 w-4" />
              নতুন চ্যাট শুরু করুন
            </button>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
              {sessions.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8">
                  কোনো পুরনো চ্যাট নেই
                </p>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => openSession(s)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted",
                    activeSessionId === s.id && "border-primary bg-primary/5"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(s.updatedAt).toLocaleString("bn-BD")}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteSession(s.id, e)}
                    className="h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
