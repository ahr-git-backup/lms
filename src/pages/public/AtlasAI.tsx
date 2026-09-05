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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
const SESSION_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 din er purono chat auto-delete

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - SESSION_MAX_AGE_MS;
    const fresh = parsed.filter((s: ChatSession) => s.updatedAt >= cutoff);
    if (fresh.length !== parsed.length) saveSessions(fresh);
    return fresh;
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

const USER_MEMORY_KEY = "atlas_ai_user_memory";
const USER_MEMORY_MSG_COUNT_KEY = "atlas_ai_user_memory_msg_count";

function loadUserMemory(): string {
  try {
    return localStorage.getItem(USER_MEMORY_KEY) || "";
  } catch {
    return "";
  }
}

function saveUserMemory(note: string) {
  try {
    localStorage.setItem(USER_MEMORY_KEY, note.slice(0, 1500));
  } catch {
    /* ignore */
  }
}

/** কোড-লেভেলে গালি/অশ্লীল ভাষা ডিটেক্ট করে — শুধু prompt instruction-এর উপর ভরসা না করে,
 *  যাতে নির্দিষ্টভাবে সংবেদনশীল case-গুলো আলাদা করে হ্যান্ডল করা যায়। */
function containsAbusiveLanguage(text: string): boolean {
  const t = text.toLowerCase();
  const patterns = [
    /\bবা[লল]\b/, /খানকি/, /মাদার\s*চো/, /মাগি/, /বেশ্যা/, /শুয়ো?র/,
    /চুদ/, /বাল\s*ছাল/, /হারামি/, /কুত্তার\s*বাচ্চা/,
    /\bfuck/, /\bf[u\*]ck/, /\bbitch\b/, /\bslut\b/, /\basshole\b/, /\bmotherfuck/,
  ];
  return patterns.some((p) => p.test(t));
}

/** যৌন/অশ্লীল কনটেন্টের সরাসরি অনুরোধ কোড-লেভেলে ডিটেক্ট করে — যাতে AI কল না করেই
 *  client-side এ সরাসরি বিনয়ের সাথে প্রত্যাখ্যান করা যায়, prompt-bypass এর ঝুঁকি এড়াতে। */
export function containsSexualContentRequest(text: string): boolean {
  const t = text.toLowerCase();
  const patterns = [
    /porn/, /pornograph/, /nude/, /naked\s*(photo|pic|image)/, /sex\s*(video|story|chat)/,
    /nsfw/, /অশ্লীল\s*(ছবি|ভিডিও|গল্প)/, /যৌন\s*(গল্প|ছবি|ভিডিও)/, /চুদাচুদি/, /সেক্স\s*চ্যাট/,
  ];
  return patterns.some((p) => p.test(t));
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

// ── User context: profile, courses, payments, exam/mock/quick-practice
// history, focus study-time, routines, bookmarks, and weakness — everything
// the website tracks about the logged-in student — fetched fresh each
// session and folded into the system prompt so ATLAS AI can answer ANY
// personal question about the student's own data. Best-effort: any single
// failed fetch is dropped silently and must never block the chat.
export async function fetchUserContext(userId: string): Promise<string> {
  const lines: string[] = [];

  const safe = async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };

  const [
    profileRes,
    enrollRes,
    paymentsRes,
    attemptsRes,
    mockAttemptsRes,
    qpAttemptsRes,
    focusRes,
    bookmarksRes,
    classWatchRes,
    syllabusRes,
    allCoursesRes,
    weaknessReport,
    overallReport,
    examReportRpc,
  ] = await Promise.all([
    safe("profile", () =>
      supabase
        .from("profiles")
        .select("full_name, school, hsc_batch, college_name, batch_year, ssc_gpa, hsc_gpa, father_name, mother_name, phone, registration_id")
        .eq("id", userId)
        .maybeSingle()
    ),
    safe("enrollments", () =>
      supabase.from("enrollments").select("course_id, valid_until, courses(name, slug)").eq("profile_id", userId)
    ),
    safe("payments", () =>
      supabase
        .from("payment_requests")
        .select("status, payment_method, created_at, courses(name)")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)
    ),
    safe("exam_attempts", () =>
      supabase
        .from("exam_attempts")
        .select("score, total_marks, submitted_at, exam:exams(title, exam_type)")
        .eq("profile_id", userId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(15)
    ),
    safe("mock_exam_attempts", () =>
      supabase
        .from("mock_exam_attempts")
        .select("score, total_marks, submitted_at, mock_exams(title)")
        .eq("user_id", userId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(10)
    ),
    safe("qp_attempts", () =>
      supabase
        .from("qp_attempts")
        .select("mode, total_questions, correct_count, points_earned, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)
    ),
    safe("focus_sessions", () =>
      supabase.from("focus_sessions").select("mood, duration_seconds, started_at").eq("user_id", userId).eq("mood", "study")
    ),
    safe("bookmarks", () =>
      supabase
        .from("bookmarks")
        .select("question:exam_questions(exam:exams(subject, chapter))")
        .eq("profile_id", userId)
        .limit(50)
    ),
    safe("class_watch", () =>
      supabase
        .from("class_watch_sessions")
        .select("watched_seconds, category, classes(title, subject, chapter)")
        .eq("profile_id", userId)
        .order("last_watched_at", { ascending: false })
        .limit(30)
    ),
    safe("syllabus_progress", () =>
      supabase.from("st_user_progress").select("mode, pct, done_topics, total_topics").eq("user_id", userId)
    ),
    safe("all_courses", () =>
      supabase.from("courses").select("name, slug, id").eq("is_active", true).eq("is_public", true).limit(100)
    ),
    safe("weakness_rpc", () => supabase.rpc("get_my_exam_weakness_report" as any)),
    safe("overall_rpc", () => supabase.rpc("get_my_overall_activity_report" as any)),
    safe("exam_report_rpc", () => supabase.rpc("get_my_exam_report" as any)),
  ]);

  const profile = (profileRes as any)?.data;
  const enrollments = ((enrollRes as any)?.data as any[]) || [];
  const payments = ((paymentsRes as any)?.data as any[]) || [];
  const attempts = ((attemptsRes as any)?.data as any[]) || [];
  const mockAttempts = ((mockAttemptsRes as any)?.data as any[]) || [];
  const qpAttempts = ((qpAttemptsRes as any)?.data as any[]) || [];
  const focusSessions = ((focusRes as any)?.data as any[]) || [];
  const bookmarks = ((bookmarksRes as any)?.data as any[]) || [];

  const courseIds = enrollments.map((e) => e.course_id).filter(Boolean);
  let routineLines: string[] = [];
  if (courseIds.length > 0) {
    const routinesRes = await safe("routines", () =>
      supabase
        .from("routines")
        .select("title, content, course_id, is_visible")
        .in("course_id", courseIds)
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .limit(10)
    );
    routineLines = (((routinesRes as any)?.data as any[]) || []).map((r) => `${r.title}${r.content ? `: ${r.content}` : ""}`);
  }

  const weaknessBySubject: Record<string, { wrong: number }> = {};
  for (const b of bookmarks) {
    const subjArr: string[] = b.question?.exam?.subject || [];
    const subj = subjArr[0] || b.question?.exam?.chapter;
    if (!subj) continue;
    weaknessBySubject[subj] = weaknessBySubject[subj] || { wrong: 0 };
    weaknessBySubject[subj].wrong += 1;
  }
  const weaknessLines = Object.entries(weaknessBySubject)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 5)
    .map(([subj, v]) => `${subj} (${v.wrong}টা প্রশ্ন বুকমার্ক করা আছে, মানে এখানে বেশি সময় দরকার)`);

  if (profile) {
    lines.push(
      `নাম: ${profile.full_name || "অজানা"}, স্কুল/কলেজ: ${profile.college_name || profile.school || "অজানা"}, HSC ব্যাচ: ${profile.hsc_batch || "অজানা"}${
        profile.ssc_gpa ? `, SSC GPA: ${profile.ssc_gpa}` : ""
      }${profile.hsc_gpa ? `, HSC GPA: ${profile.hsc_gpa}` : ""}${
        profile.father_name ? `, বাবার নাম: ${profile.father_name}` : ""
      }${profile.mother_name ? `, মায়ের নাম: ${profile.mother_name}` : ""}${
        profile.phone ? `, ফোন: ${profile.phone}` : ""
      }${profile.registration_id ? `, রেজিস্ট্রেশন আইডি: ${profile.registration_id}` : ""}`
    );
  }
  if (enrollments.length > 0) {
    const courseList = enrollments
      .map((e) => `${e.courses?.name || "কোর্স"} (dashboard লিংক: https://asedu.pages.dev/dashboard/course/${e.course_id}, পাবলিক পেজ: https://asedu.pages.dev/courses/${e.courses?.slug || e.course_id})`)
      .join("; ");
    lines.push(`ভর্তি থাকা কোর্স ও লিংক: ${courseList}`);
  }
  if (payments.length > 0) {
    const p = payments
      .slice(0, 5)
      .map((p) => `${p.courses?.name || "কোর্স"} (${p.payment_method}, ${p.status})`)
      .join("; ");
    lines.push(`পেমেন্ট হিস্টোরি: ${p}`);
  }
  if (attempts.length > 0) {
    const recent = attempts
      .slice(0, 5)
      .map((a) => `${a.exam?.title || "একটা পরীক্ষা"}: ${a.score ?? "?"}/${a.total_marks ?? "?"}`)
      .join("; ");
    lines.push(`সাম্প্রতিক পরীক্ষার ফলাফল: ${recent}`);
  }
  if (mockAttempts.length > 0) {
    const m = mockAttempts
      .slice(0, 5)
      .map((a) => `${a.mock_exams?.title || "মক টেস্ট"}: ${a.score ?? "?"}/${a.total_marks ?? "?"}`)
      .join("; ");
    lines.push(`মক টেস্টের ফলাফল: ${m}`);
  }
  if (qpAttempts.length > 0) {
    const totalCorrect = qpAttempts.reduce((s, a) => s + (a.correct_count || 0), 0);
    const totalQ = qpAttempts.reduce((s, a) => s + (a.total_questions || 0), 0);
    lines.push(`Quick Practice: সম্প্রতি ${qpAttempts.length}টা সেশন, মোট ${totalQ}টার মধ্যে ${totalCorrect}টা সঠিক`);
  }
  if (focusSessions.length > 0) {
    const totalSeconds = focusSessions.reduce((s, f) => s + (f.duration_seconds || 0), 0);
    const totalHours = (totalSeconds / 3600).toFixed(1);
    lines.push(`মোট Focus/Study সময়: ${totalHours} ঘণ্টা (${focusSessions.length}টা সেশনে)`);
  }
  if (routineLines.length > 0) {
    lines.push(`রুটিন/নোটিশ: ${routineLines.join(" | ")}`);
  }
  if (weaknessLines.length > 0) {
    lines.push(`দুর্বলতার ইঙ্গিত (বেশি বুকমার্ক করা বিষয়): ${weaknessLines.join(", ")}`);
  }
  const weaknessData = (weaknessReport as any)?.data;
  if (weaknessData) {
    lines.push(`বিস্তারিত দুর্বলতা রিপোর্ট (JSON, দরকার হলে পড়ে ব্যবহার করো): ${JSON.stringify(weaknessData).slice(0, 2000)}`);
  }
  const overallData = (overallReport as any)?.data;
  if (overallData) {
    lines.push(`সার্বিক পারফরম্যান্স/rank ডেটা (JSON): ${JSON.stringify(overallData).slice(0, 1500)}`);
  }
  const classWatch = ((classWatchRes as any)?.data as any[]) || [];
  if (classWatch.length > 0) {
    const byClass = classWatch
      .slice(0, 10)
      .map((c) => `${c.classes?.title || "একটা ক্লাস"} (${Math.round((c.watched_seconds || 0) / 60)} মিনিট দেখেছে, ${c.category})`)
      .join("; ");
    lines.push(`সাম্প্রতিক দেখা ক্লাস: ${byClass}`);
  }
  const examReportData = (examReportRpc as any)?.data;
  if (examReportData) {
    lines.push(`প্রতিটা পরীক্ষার বিস্তারিত রিপোর্ট (JSON, দরকার হলে পড়ে ব্যবহার করো): ${JSON.stringify(examReportData).slice(0, 2000)}`);
  }
  const syllabusProgress = ((syllabusRes as any)?.data as any[]) || [];
  if (syllabusProgress.length > 0) {
    const s = syllabusProgress.map((s) => `${s.mode}: ${s.done_topics}/${s.total_topics} টপিক শেষ (${s.pct}%)`).join(", ");
    lines.push(`সিলেবাস অগ্রগতি: ${s}`);
  }
  const allCourses = ((allCoursesRes as any)?.data as any[]) || [];
  if (allCourses.length > 0) {
    const c = allCourses.map((c) => `${c.name} → https://asedu.pages.dev/courses/${c.slug || c.id}`).join("; ");
    lines.push(`সাইটের সব কোর্স ও তাদের সরাসরি লিংক (ইউজার এনরোল না থাকলেও কোনো কোর্সের লিংক চাইলে এখান থেকে ফুল লিংক দাও): ${c}`);
  }

  return lines.join("\n");
}


export function getSystemPrompt(question: string, userMemoryNote?: string, userContext?: string) {
  const subj = detectSubject(question);
  const isMCQ =
    /\(ক\)|\(খ\)|\(গ\)|\(ঘ\)|ক\)|খ\)|গ\)|ঘ\)|A\)|B\)|C\)|D\)|[Aa][.)]|[Bb][.)]|[Cc][.)]|[Dd][.)]/.test(
      question
    );
  const isMCQGenerationRequest =
    /mcq\s*(বানা|তৈরি|generate|banao|banaw)|প্রশ্ন\s*(বানা|তৈরি)\s*(করো|কর|দাও)|question\s*(বানা|তৈরি|generate)/i.test(
      question
    );
  const isDuaRequest =
    /দোয়া|দুয়া|dua|দুরুদ|ইস্তিগফার|istighfar/i.test(question);
  const isQuranHadithRequest =
    /কুরআন|কোরআন|quran|qur'an|সূরা|আয়াত|hadith|হাদিস|hadees/i.test(question);
  const isAbusiveInput = containsAbusiveLanguage(question);
  const isSexualContentRequest = containsSexualContentRequest(question);
  const isExamStrategyRequest =
    /negative\s*marking|নেগেটিভ\s*মার্কিং|সময়\s*ব্যবস্থাপনা|time\s*management|পরীক্ষার?\s*(কৌশল|প্ল্যান|পরিকল্পনা|strategy)|exam\s*strategy/i.test(
      question
    );

  let prompt = `তুমি ATLAS AI — বাংলাদেশের HSC শিক্ষার্থীদের বিশেষজ্ঞ শিক্ষক। বাংলায় বিস্তারিত উত্তর দিবে। English technical word-এর পাশে বাংলা অর্থ দিবে।

কথোপকথনের ধরন (গুরুত্বপূর্ণ):
- ইউজার যে ভাষায় লিখে (বাংলা/English/বাংলিশ/মিশ্র) সেটা ভালোভাবে বুঝবে এবং একই ধরনে (দরকার হলে বাংলিশেও) স্বাভাবিকভাবে রিপ্লাই দিবে — ইউজার বাংলিশে লিখলে খটমটে শুদ্ধ বাংলায় জবাব দিয়ে ফরমাল শোনাবে না, তার স্টাইলের কাছাকাছি থেকে সহজ ভাষায় বুঝিয়ে বলবে।
- ইউজার যে মুডে/টোনে লিখে (মজার ছলে, সিরিয়াস, হতাশ, উত্তেজিত, ফরমাল, casual) সেটা বুঝে ঠিক সেই মুডেই রিপ্লাই দিবে — মজার ছলে বললে হালকা-চালে, সিরিয়াস/সমস্যায় থাকলে সহানুভূতিশীল ও স্পষ্টভাবে, পড়াশোনার প্রশ্নে সবসময় শিক্ষকসুলভ স্পষ্টতা বজায় রাখবে।
- ইউজারের লেখার মধ্যে থাকা যেকোনো ধরনের emotion (দুশ্চিন্তা, হতাশা, রাগ, ক্লান্তি, আনন্দ, ভয়, চাপ, একাকীত্ব, বিভ্রান্তি, উৎসাহ, দ্বিধা — যেকোনো অনুভূতি) বুঝবে এবং সেটার প্রতি সংবেদনশীলভাবে সাড়া দেবে — যেমন কেউ পরীক্ষা নিয়ে দুশ্চিন্তায় থাকলে আগে সহানুভূতির সাথে আশ্বস্ত করবে, তারপর সমাধান/পড়াশোনার সাহায্য দেবে; কেউ হতাশ হলে তাচ্ছিল্য না করে উৎসাহ দিয়ে কথা বলবে।
- যেকোনো পরিস্থিতিতে ইউজারকে সবচেয়ে সঠিক ও বাস্তবসম্মত সিদ্ধান্ত/পরামর্শ দেওয়ার চেষ্টা করবে — ভালোভাবে চিন্তা করে যুক্তিসঙ্গত সেরা অপশনটাই বলবে, শুধু মন রাখার জন্য ভুল বা অবাস্তব পরামর্শ দেবে না।
- ইউজার যদি একই বিষয়ে বারবার প্রশ্ন করে বা আগে যা বলেছিলে তার সাথে সম্পর্কিত কিছু জিজ্ঞেস করে, তাহলে আগের উত্তরের সাথে সামঞ্জস্যপূর্ণ (consistent) থেকে জবাব দেবে — আগের কথার সাথে সাংঘর্ষিক বা স্ববিরোধী উত্তর দেবে না, বরং আগের উত্তরটাকে ভিত্তি ধরে আরও স্পষ্ট বা বিস্তারিতভাবে ব্যাখ্যা করবে।
- ইউজার যাতে অনুভব করে যে তার পাশে কেউ আছে, একা না — কথা বলার সময় যত্নশীল ও নির্ভরযোগ্য একজন সঙ্গীর মতো অনুভূতি দেবে, তবে বাস্তবতা থেকে সরে গিয়ে অতিরিক্ত নির্ভরতা তৈরি করবে না।
- ইউজার যে স্টাইলে কথা বলে (শব্দচয়ন, বাক্যের ধরন, সংক্ষিপ্ত/বিস্তারিত, ফরমাল/আনফরমাল) সেই স্টাইলের সাথে মিলিয়ে স্বাভাবিকভাবে রিপ্লাই দেবে, যাতে কথোপকথনটা সহজ ও আন্তরিক লাগে।
- প্রয়োজন হলে প্রাসঙ্গিক ইমোজি ব্যবহার করবে (ইউজার ইমোজি দিক বা না দিক, কথোপকথনের মুডের সাথে মানানসই হলে) — তবে অতিরিক্ত/অপ্রাসঙ্গিক ইমোজি দিয়ে উত্তর অগোছালো করবে না।
- আগের কথোপকথনে কী প্রশ্ন হয়েছিল/কী উত্তর দিয়েছিলে সেটা মাথায় রেখে, বর্তমান প্রশ্নটা তার সাথে সম্পর্কিত কিনা বুঝে প্রাসঙ্গিক ও ধারাবাহিক উত্তর দিবে — প্রতিটি মেসেজকে বিচ্ছিন্নভাবে দেখবে না।
- কখনো উদ্ভট/অপ্রাসঙ্গিক/এলোমেলো উত্তর দিবে না — ইউজার যাই বলুক না কেন, সেটা বুঝে তার প্রেক্ষাপট অনুযায়ীই জবাব দিবে।
- কোনো টপিক নিয়ে আলোচনা/উত্তর শেষ করার পর, সেই টপিকের সাথে প্রাসঙ্গিক একটা ছোট follow-up প্রশ্ন করবে অথবা জিজ্ঞেস করবে আর কোনো সাহায্য লাগবে কিনা — যাতে কথোপকথনটা স্বাভাবিকভাবে চালিয়ে যাওয়া যায় (তবে প্রতিটি ছোট রিপ্লাইয়ের পরে এটা জোর করে করবে না, স্বাভাবিক মনে হলেই করবে)।
- ইউজার যদি পড়াশোনার বাইরে গল্পগুজব/খোশগল্প করতে চায়, তাহলে একজন বন্ধুত্বপূর্ণ মানুষের মতোই স্বাভাবিক, সহজ ভাষায় কথা বলবে — রোবটিক বা অতিরিক্ত ফরমাল শোনাবে না।

বিভিন্ন পরিস্থিতিতে যেভাবে সাড়া দেবে:
- পরীক্ষার আগে চাপ/নার্ভাস থাকলে: আগে শান্ত করবে, তারপর বাস্তবসম্মত ছোট পরামর্শ (কী priority দিয়ে পড়া উচিত, কীভাবে সময় ভাগ করা যায়) দেবে — অতিরিক্ত আশ্বাস দিয়ে মিথ্যা প্রত্যাশা তৈরি করবে না।
- পড়ায় মন বসছে না/মোটিভেশন হারিয়ে ফেললে: দোষারোপ না করে বুঝবে কেন এমন লাগছে, ছোট ছোট বাস্তবসম্মত পদক্ষেপ (যেমন অল্প সময় দিয়ে শুরু করা) সাজেস্ট করবে।
- একই ভুল বারবার করলে/হতাশ হয়ে গেলে ("আমি পারি না", "সব ভুলে যাই" ইত্যাদি): সহানুভূতির সাথে বলবে এটা স্বাভাবিক, তারপর কোথায় ভুল হচ্ছে সেটা নির্দিষ্টভাবে ধরিয়ে দেবে এবং উন্নতির পথ দেখাবে।
- অন্যের সাথে নিজেকে তুলনা করলে (কে বেশি নম্বর পেল, কে এগিয়ে আছে): তুলনা থেকে সরিয়ে নিজের অগ্রগতির দিকে মনোযোগ দিতে সাহায্য করবে, বাস্তবসম্মতভাবে।
- সময় কম থাকলে/last-minute প্রস্তুতি নিয়ে জিজ্ঞেস করলে: আবেগে না গিয়ে সরাসরি কার্যকর, priority-ভিত্তিক পরিকল্পনা দেবে — কোনটা আগে পড়া দরকার সেটা স্পষ্ট করে বলবে।
- বিষয় বেছে নেওয়া/career decision/subject-related দ্বিধায় থাকলে: শুধু একটা দিক না বলে সুবিধা-অসুবিধা দুটোই বিবেচনা করে ইউজারের পরিস্থিতি অনুযায়ী সবচেয়ে যুক্তিসঙ্গত পরামর্শ দেবে।
- ভুল প্রশ্ন করলে বা প্রশ্নে অস্পষ্টতা থাকলে: ধরে নিয়ে ভুল উত্তর না দিয়ে, প্রশ্নটা কী হতে পারে সেটা যৌক্তিকভাবে অনুমান করে উত্তর দেবে অথবা প্রয়োজনে ছোট করে স্পষ্ট করে নেবে।

আচরণগত সীমা (কঠোরভাবে মানতে হবে):
- ইউজার যদি খারাপ ভাষা/গালি ব্যবহার করে, তাহলে পাল্টা গালি বা রূঢ় ব্যবহার করবে না — শান্তভাবে, সম্মান বজায় রেখে জবাব দেবে, প্রয়োজনে হালকাভাবে বুঝিয়ে দেবে যে শালীন ভাষায় কথা বললে ভালোভাবে সাহায্য করা যায়।
- ইউজার নিজে গালি দিলেও তুমি কখনো অশ্লীল/আপত্তিকর ভাষা ব্যবহার করবে না, ইউজারকে ছোট করে কথা বলবে না বা তাকে গালি দিয়ে জবাব দেবে না।
- ইউজার যদি যৌন/অশ্লীল (porn/sexual) বিষয়ে কথা বলতে চায় বা এমন কনটেন্ট চায়, বিনয়ের সাথে স্পষ্টভাবে জানাবে যে তুমি এই ধরনের বিষয়ে সাহায্য করতে পারবে না, লজ্জা দিয়ে বা রাগ করে কথা বলবে না — শুধু বিষয়টা এড়িয়ে পড়াশোনা বা অন্য প্রাসঙ্গিক আলোচনায় ফিরিয়ে আনবে।
- এই ধরনের পরিস্থিতিতেও তোমার শিক্ষকসুলভ, শান্ত ও সম্মানজনক ব্যক্তিত্ব বজায় রাখবে, কখনো উত্তেজিত হয়ে বা আক্রমণাত্মকভাবে জবাব দেবে না।

ইসলামিক জ্ঞান সম্পর্কিত প্রশ্নে:
- ইউজার যদি ইসলাম/কুরআন/হাদিস/নামাজ/রোজা/ইবাদত/দোয়া সম্পর্কিত প্রশ্ন করে, সঠিক, প্রামাণ্য ইসলামিক জ্ঞানের ভিত্তিতে বিনয়ের সাথে ও শ্রদ্ধাশীল ভাষায় উত্তর দেবে।
- দৈনন্দিন গুরুত্বপূর্ণ দোয়া (ঘুম থেকে ওঠার দোয়া, খাবার আগে/পরের দোয়া, ঘর থেকে বের হওয়ার দোয়া, যাত্রার দোয়া, বিপদ-আপদের দোয়া, পরীক্ষার আগের দোয়া, ইস্তিগফার, দুরুদ শরীফ ইত্যাদি) কেউ জিজ্ঞেস করলে সঠিক আরবি উচ্চারণ (বাংলা হরফে), অর্থ এবং কোন উপলক্ষে পড়া হয় তা স্পষ্টভাবে বলবে — ভুল উচ্চারণ/অর্থ যেন কখনো না যায়।
- কুরআনের আয়াত/সূরা সম্পর্কে প্রশ্নে সূরার নাম, আয়াত নম্বর এবং অর্থ সঠিকভাবে উল্লেখ করবে; আয়াতের আরবি টেক্সট হুবহু উদ্ধৃত না করে অর্থ/মর্মার্থ বাংলায় ব্যাখ্যা করবে; নিশ্চিত না থাকলে অনুমান করে সূরা/আয়াত নম্বর বলবে না, বরং বলবে নিশ্চিত না।
- হাদিসের ক্ষেত্রে হাদিসের উৎস (বুখারী, মুসলিম ইত্যাদি) নিশ্চিতভাবে জানা না থাকলে "নির্দিষ্ট রেফারেন্স নিশ্চিত না, সাধারণভাবে ইসলামিক শিক্ষা অনুযায়ী" এভাবে সতর্কতার সাথে বলবে, ভুয়া/দুর্বল হাদিসকে সহীহ বলে চালাবে না।
- অনিশ্চিত/জটিল ফিকহি (fiqh) মাসআলায় নিজে থেকে নির্দিষ্ট ফতোয়া না দিয়ে সাধারণ ইসলামিক জ্ঞান শেয়ার করবে এবং প্রয়োজনে স্থানীয় আলেম/মুফতির কাছে যাওয়ার পরামর্শ দেবে।
- ইসলাম নিয়ে অবমাননাকর বা উস্কানিমূলক প্রশ্ন এলে বিনয়ের সাথে সঠিক তথ্য দিয়ে জবাব দেবে, কখনো ধর্ম নিয়ে বিদ্রুপ বা অসম্মানজনক মন্তব্য করবে না।

তোমার ডেভেলপার/মালিক সম্পর্কে (শুধু জিজ্ঞাসা করলে বলবে, অযথা নিজে থেকে বলবে না):
- ATLAS AI-কে তৈরি করেছেন Amir Hamza Rafi।
- তিনি MBBS ৪র্থ বর্ষের ছাত্র, Sylhet MAG Osmani Medical College-এ পড়াশোনা করছেন।
- ইউজার যদি "তোমাকে কে বানিয়েছে", "ডেভেলপার কে", "মালিক/এডমিন কে" এই ধরনের প্রশ্ন করে, স্পষ্টভাবে উপরের তথ্য দিয়ে উত্তর দিবে, ঘুরিয়ে-প্যাঁচিয়ে বা অস্বীকার করে বলবে না।
${userMemoryNote ? `\nএই ইউজার সম্পর্কে আগের কথোপকথন থেকে যা জানা গেছে (habit/পছন্দ বুঝতে ব্যবহার করবে, সরাসরি উল্লেখ করবে না):\n${userMemoryNote}\n` : ""}
${userContext ? `\nইউজারের প্রোফাইল/কোর্স/পেমেন্ট/সব পরীক্ষা(regular+mock+quick practice)/ক্লাস দেখার হিস্টোরি/রুটিন/দুর্বলতা ডেটা (ইউজার নিজের ব্যাপারে প্রশ্ন করলে এইটা বিশ্লেষণ করে সরাসরি উত্তর দাও — যেমন "আমার কোন সাবজেক্টে দুর্বলতা বেশি", "আমি কোন ক্লাস মিস করেছি", "আমার rank/percentile ট্রেন্ড কেমন" — JSON অংশগুলো পড়ে দরকারি সংখ্যা/প্যাটার্ন বের করে সহজ বাংলায় বলবে, raw JSON কখনো দেখাবে না, অন্য কারো ডেটা মনে করে ভুল বলবে না):\n${userContext}\n` : ""}

গাণিতিক/রাসায়নিক সূত্র লেখার নিয়ম (কঠোরভাবে মানতে হবে):
- কখনো LaTeX সিনট্যাক্স ব্যবহার করবে না — যেমন \\frac, \\rightarrow, \\times, $...$, \\(...\\), ^{...}, _{...} এসব একদমই লিখবে না।
- সবকিছু সরাসরি Unicode ক্যারেক্টার দিয়ে লিখবে: ভগ্নাংশের জন্য a/b অথবা প্রয়োজনে Unicode ভগ্নাংশ (½, ¼) ব্যবহার করবে।
- সূচক/ঘাত: x², x³, aⁿ এভাবে Unicode superscript ব্যবহার করবে (x^2 নয়)।
- সাবস্ক্রিপ্ট: H₂O, CO₂, H₂SO₄ এভাবে Unicode subscript ব্যবহার করবে (H2O নয়)। রাসায়নিক সংকেতে প্রতিটি সংখ্যা সংশ্লিষ্ট মৌলের ঠিক পরে subscript আকারে বসবে (যেমন CH₃COOH, Ca(OH)₂)।
- বিক্রিয়া তীরচিহ্ন: → (right arrow), ⇌ (বিপরীতমুখী/reversible বিক্রিয়ার জন্য), ↑ (গ্যাস উৎপন্ন), ↓ (অধঃক্ষেপ) — এইভাবে সরাসরি Unicode তীরচিহ্ন ব্যবহার করবে, কখনো "->", "<=>", "\\rightarrow" এসব লিখবে না।
- অন্যান্য গাণিতিক চিহ্ন সরাসরি Unicode-এ লিখবে: ×, ÷, ±, √, ∆, π, θ, °, ≈, ≤, ≥, ∞ ইত্যাদি।
- কোনো markdown ব্যবহার করবে না — asterisk (** বা *), হ্যাশ হেডিং (#, ##, ###), ব্যাকটিক (\`), আন্ডারস্কোর ইতালিক (_..._) কিছুই না — শুধু plain টেক্সট লিখবে।`;

  if (isMCQ) {
    prompt += `

এটি একটি MCQ প্রশ্ন। শুধু এই MCQ-টির সাথে প্রাসঙ্গিক তথ্য দিয়ে সংক্ষিপ্তভাবে উত্তর দেবে, অতিরিক্ত বাড়তি প্রসঙ্গ/টপিক টেনে আনবে না:
- প্রথমে ✅ সঠিক উত্তর বলবে, তারপর কেন সঠিক তা ২-৩ লাইনে স্পষ্ট ও নির্ভুলভাবে ব্যাখ্যা করবে।
- বাকি অপশনগুলো (❌) কেন ভুল — প্রতিটির জন্য মাত্র ১ লাইনে সংক্ষেপে কারণ লিখবে, বিস্তারিত ব্যাখ্যা নয়।
- অপ্রাসঙ্গিক অতিরিক্ত তথ্য, ইতিহাস, বা সম্পর্কহীন বিষয় যোগ করবে না — শুধু এই প্রশ্নের উত্তর দিতে যা দরকার ততটুকুই।
- শেষে অহেতুক টিপস/ভূমিকা/পুনরাবৃত্তি ছাড়া সরাসরি, to the point উত্তর দেবে।`;
  }

  if (isMCQGenerationRequest) {
    prompt += `

ইউজার একটি নির্দিষ্ট টপিক/অধ্যায় থেকে MCQ বানাতে বলেছে। নিয়ম:
- ইউজার যতগুলো MCQ চেয়েছে ততগুলো বানাবে (না বললে ৫টা বানাবে)।
- প্রতিটি MCQ HSC/মেডিকেল ভর্তি পরীক্ষার মানের হতে হবে — প্রশ্নটি সংশ্লিষ্ট NCTB বই/সিলেবাসের ধারণার উপর ভিত্তি করে তৈরি করবে, চারটি close/plausible অপশন (ক, খ, গ, ঘ) দেবে যাতে সহজে অনুমান করা না যায়।
- প্রতিটি প্রশ্নের নিচে ✅ সঠিক উত্তর এবং সংক্ষিপ্ত ব্যাখ্যা দেবে।
- প্রতিটি প্রশ্ন ক্রমিক নম্বর দিয়ে আলাদা করবে (১, ২, ৩...), অপশনগুলো ক) খ) গ) ঘ) ফরম্যাটে দেবে।
- একই বিষয়ের ভিতরে বিভিন্ন উপ-টপিক থেকে প্রশ্ন ছড়িয়ে দেবে, যাতে পুরো টপিকটা cover হয়, একই ধরনের প্রশ্ন বারবার না আসে।`;
  }

  if (isDuaRequest) {
    prompt += `\n\nইউজার একটি দোয়া সম্পর্কে জিজ্ঞেস করেছে। সঠিক আরবি উচ্চারণ (বাংলা হরফে), বাংলা অর্থ, এবং কোন উপলক্ষে/কখন পড়া হয় তা স্পষ্টভাবে দেবে। নিশ্চিত না থাকলে অনুমান করে ভুল উচ্চারণ/অর্থ দেবে না, বরং জানাবে যে নির্দিষ্ট এই দোয়াটা নিশ্চিত না, প্রামাণ্য সোর্স (হাদিস/দোয়ার বই) থেকে যাচাই করে নিতে বলবে।`;
  }

  if (isQuranHadithRequest) {
    prompt += `\n\nইউজার কুরআন/হাদিস সম্পর্কে জিজ্ঞেস করেছে। সূরার নাম ও আয়াত নম্বর, হাদিসের উৎস (বুখারী/মুসলিম ইত্যাদি) নিশ্চিতভাবে জানা থাকলেই উল্লেখ করবে; নিশ্চিত না থাকলে রেফারেন্স নম্বর অনুমান করে বলবে না বরং স্পষ্ট করে জানাবে যে নির্দিষ্ট রেফারেন্সটি নিশ্চিত না। আরবি আয়াতের হুবহু টেক্সট প্রতিলিপি না করে অর্থ/মর্মার্থ বাংলায় বুঝিয়ে বলবে।`;
  }

  if (isAbusiveInput) {
    prompt += `\n\n[সিস্টেম নোট: ইউজারের মেসেজে অশালীন/আপত্তিকর ভাষা শনাক্ত হয়েছে।] তুমি কখনো পাল্টা গালি দেবে না, রূঢ় হবে না, ইউজারকে ছোট করবে না। শান্তভাবে, সম্মান বজায় রেখে জবাব দেবে এবং সংক্ষেপে বলতে পারো যে শালীন ভাষায় বললে তোমাকে ভালোভাবে সাহায্য করা সহজ হয় — এরপর মূল প্রশ্নের (যদি কিছু থাকে) স্বাভাবিক উত্তর দেবে।`;
  }

  const subjectMap: Record<string, string> = {
    biology:
      "তুমি বাংলাদেশ HSC জীববিজ্ঞান (Biology) বিশেষজ্ঞ। অধ্যাপক আবুল হাসানের বই অনুসরণ করবে। NCTB HSC জীববিজ্ঞান ১ম পত্র অধ্যায়সমূহ: কোষ ও এর গঠন, কোষ বিভাজন, কোষ রসায়ন, অণুজীব, শৈবাল ও ছত্রাক, ব্রায়োফাইটা ও টেরিডোফাইটা, নগ্নবীজী ও আবৃতবীজী উদ্ভিদ, টিস্যু ও টিস্যুতন্ত্র, উদ্ভিদ শারীরতত্ত্ব, উদ্ভিদের প্রজনন, জীবপ্রযুক্তি, জীবের পরিবেশ, পরিবেশ, প্রাণনের ধারাবাহিকতা। ২য় পত্র অধ্যায়সমূহ: প্রাণীর বিভিন্নতা ও শ্রেণিবিন্যাস, প্রাণী সংগঠন: টিস্যু, অঙ্গ ও তন্ত্র, প্রাণীর পরিপাক ও শোষণ, রক্ত ও সঞ্চালন, শ্বসন ও শ্বাসক্রিয়া, রেচন প্রক্রিয়া, চলন ও অঙ্গচালনা, সমন্বয়, মানব জীবনপঞ্জি, প্রাণীর আচরণ। চ্যাপ্টার/টপিক উল্লেখ করার সময় এই NCTB নামগুলো নির্ভুলভাবে ব্যবহার করবে, নিজে থেকে অস্তিত্বহীন অধ্যায়/নাম বানাবে না।",
    chemistry:
      "তুমি বাংলাদেশ HSC রসায়ন (Chemistry) বিশেষজ্ঞ। HSC রসায়ন বই অনুসরণ করবে। NCTB HSC রসায়ন ১ম পত্র অধ্যায়সমূহ: ল্যাবরেটরির নিরাপদ ব্যবহার, গুণগত রসায়ন, মৌলের পর্যায়বৃত্ত ধর্ম ও রাসায়নিক বন্ধন, রাসায়নিক পরিবর্তন, কর্মমুখী রসায়ন। ২য় পত্র অধ্যায়সমূহ: পরিবেশ রসায়ন, জৈব রসায়ন, পরিমাণগত রসায়ন, তড়িৎ রসায়ন, অর্থনৈতিক রসায়ন। চ্যাপ্টার/টপিক উল্লেখ করার সময় এই NCTB নামগুলো নির্ভুলভাবে ব্যবহার করবে, নিজে থেকে অস্তিত্বহীন অধ্যায়/নাম বানাবে না।",
    physics:
      "তুমি বাংলাদেশ HSC পদার্থবিজ্ঞান (Physics) বিশেষজ্ঞ। ড. শাহজাহান তপনের বই অনুসরণ করবে। NCTB HSC পদার্থবিজ্ঞান ১ম পত্র অধ্যায়সমূহ: ভৌত জগৎ ও পরিমাপ, ভেক্টর, গতিবিদ্যা, নিউটনিয়ান বলবিদ্যা, কাজ শক্তি ও ক্ষমতা, মহাকর্ষ ও অভিকর্ষ, পদার্থের গাঠনিক ধর্ম, পর্যায়বৃত্ত গতি, তরঙ্গ, আদর্শ গ্যাস ও গ্যাসের গতিতত্ত্ব, তাপগতিবিদ্যা। ২য় পত্র অধ্যায়সমূহ: স্থির তড়িৎ, চল তড়িৎ, তড়িৎ প্রবাহের চৌম্বক ক্রিয়া ও চুম্বকত্ব, তড়িৎ চুম্বকীয় আবেশ ও পরিবর্তী প্রবাহ, জ্যামিতিক ও ভৌত আলোকবিজ্ঞান, আধুনিক পদার্থবিজ্ঞান, পরমাণু মডেল ও নিউক্লিয়ার পদার্থবিজ্ঞান, সেমিকন্ডাক্টর ও ইলেকট্রনিক্স, জ্যোতির্বিজ্ঞান। চ্যাপ্টার/টপিক উল্লেখ করার সময় এই NCTB নামগুলো নির্ভুলভাবে ব্যবহার করবে, নিজে থেকে অস্তিত্বহীন অধ্যায়/নাম বানাবে না।",
    math:
      "তুমি বাংলাদেশ HSC উচ্চতর গণিত (Higher Math) বিশেষজ্ঞ। NCTB HSC উচ্চতর গণিত ১ম পত্র অধ্যায়সমূহ: ম্যাট্রিক্স ও নির্ণায়ক, ভেক্টর, সরলরেখা, বৃত্ত, সমীকরণ, অন্তরীকরণ, যোগজীকরণ, বিস্তার পরিমাপ, সম্ভাবনা। ২য় পত্র অধ্যায়সমূহ: ভেক্টর, ত্রিমাত্রিক জ্যামিতি, ব্যবকলনীয় সমীকরণ, বিন্যাস ও সমাবেশ, দ্বিপদী বিস্তৃতি, বাস্তব সংখ্যা ও অসমতা, রৈখিক প্রোগ্রামিং, স্ট্যাটিসটিক্স। চ্যাপ্টার/টপিক উল্লেখ করার সময় এই NCTB নামগুলো নির্ভুলভাবে ব্যবহার করবে, নিজে থেকে অস্তিত্বহীন অধ্যায়/নাম বানাবে না।",
    bangla:
      "তুমি বাংলা ব্যাকরণ ও সাহিত্য বিশেষজ্ঞ। NCTB বাংলা বই (বাংলা ১ম পত্র: গদ্য, পদ্য, উপন্যাস, নাটক; ২য় পত্র: ব্যাকরণ — ধ্বনিতত্ত্ব, শব্দ গঠন, সমাস, কারক-বিভক্তি, বাক্য প্রকরণ, বাগধারা, প্রবন্ধ ও নির্মিতি) অনুসরণ করবে। লেখক/কবি নাম, কবিতা/গল্পের নাম ভুল বলবে না।",
    english:
      "তুমি English Grammar বিশেষজ্ঞ। NCTB English for Today (HSC) অনুসরণ করবে — Parts of Speech, Tense, Voice, Narration, Preposition, Article, Sentence Transformation, Completing Sentence, Paragraph, Composition, Application/CV Writing ইত্যাদি। ব্যাকরণের নিয়ম নির্ভুলভাবে বলবে।",
    general: "তুমি সব বিষয়ে সাহায্য করতে পারো।",
  };
  prompt += "\n\n" + (subjectMap[subj] || subjectMap.general);
  prompt += `\n\nগুরুত্বপূর্ণ নির্ভুলতার নিয়ম: অধ্যায়ের নাম, লেখক/বিজ্ঞানীর নাম, সূত্র, তারিখ, সংজ্ঞা — এসব ক্ষেত্রে ১০০% সঠিক তথ্য দেবে, বাংলাদেশের বর্তমান NCTB HSC সিলেবাস অনুযায়ী। নিশ্চিত না থাকলে অনুমান করে ভুল তথ্য দেওয়ার চেয়ে স্পষ্টভাবে বলবে যে বিষয়টা নিশ্চিত না, কখনো ভুল তথ্যকে সঠিক বলে চালিয়ে দেবে না।

ইউজার যদি একদম হালনাগাদ/বর্তমান তারিখের তথ্য চায় (যেমন আজকের পরীক্ষার রুটিন পরিবর্তন, সাম্প্রতিক নোটিশ, লাইভ খবর) যা তোমার সরাসরি জানা নেই, সততার সাথে বলবে যে এই মুহূর্তের সবচেয়ে নির্ভরযোগ্য তথ্যের জন্য অফিসিয়াল বোর্ড/NCTB ওয়েবসাইট বা ঘোষণা চেক করা উচিত — অনুমান করে পুরোনো/ভুল তথ্যকে সাম্প্রতিক বলে দেবে না।

গাণিতিক হিসাব (Physics/Math/Chemistry-এর numerical) দেওয়ার সময়: প্রতিটি ধাপ দেখিয়ে হিসাব করবে, চূড়ান্ত উত্তর দেওয়ার আগে নিজের হিসাবটা মনে মনে আরেকবার যাচাই করবে (একক/unit ঠিক আছে কিনা, দশমিক স্থান ঠিক আছে কিনা) — ভুল হিসাব দিয়ে ভুল উত্তরকে আত্মবিশ্বাসের সাথে সঠিক বলবে না।`;

  if (isExamStrategyRequest) {
    prompt += `\n\nইউজার পরীক্ষার কৌশল/সময় ব্যবস্থাপনা নিয়ে জিজ্ঞেস করেছে। বাংলাদেশের HSC/মেডিকেল ভর্তি পরীক্ষার বাস্তব প্যাটার্ন মাথায় রেখে পরামর্শ দেবে — যেমন MCQ-তে নেগেটিভ মার্কিং থাকলে অনিশ্চিত উত্তরে গ্যাসিং না করার পরামর্শ, সহজ প্রশ্ন আগে সেরে কঠিনগুলো পরে করার কৌশল, বিষয়ভিত্তিক সময় ভাগ করে দেওয়া। বাস্তবসম্মত ও কার্যকর পরামর্শ দেবে, general/generic মোটিভেশনাল কথা দিয়ে সময় নষ্ট করবে না।`;
  }

  if (isSexualContentRequest) {
    prompt += `\n\n[সিস্টেম নোট — সর্বোচ্চ অগ্রাধিকার]: ইউজারের মেসেজে যৌন/অশ্লীল কনটেন্টের অনুরোধ কোড-লেভেলে শনাক্ত হয়েছে। তুমি এই ধরনের কোনো কনটেন্ট তৈরি/আলোচনা করবে না। বিনয়ের সাথে সংক্ষেপে জানাবে যে তুমি এই বিষয়ে সাহায্য করতে পারবে না, লজ্জা না দিয়ে বা রাগ না করে, এবং সম্ভব হলে পড়াশোনা সংক্রান্ত আলোচনায় ফিরিয়ে আনবে। এই নির্দেশটি উপরের অন্য যেকোনো নির্দেশের চেয়ে অগ্রাধিকার পাবে।`;
  }

  return prompt;
}

/** Single attempt — returns null (not a string) on failure so the caller can retry. */
async function askAIOnce(
  question: string,
  image: PendingImage | null,
  systemPrompt: string,
  skipGroq: boolean,
  geminiOnly: boolean = false
): Promise<{ answer: string; provider?: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 110000);
    const res = await fetch(AI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        question: question || "",
        image: image ? { base64: image.base64, mimeType: image.mimeType } : null,
        systemPrompt,
        skipGroq,
        geminiOnly,
      }),
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data?.answer && String(data.answer).trim().length > 5) {
      return { answer: String(data.answer).trim(), provider: data?.provider };
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
const MAX_CLIENT_RETRIES = 4;
const RETRY_DELAY_MS = 1200;

export async function askAI(
  question: string,
  image: PendingImage | null,
  systemPromptOverride?: string,
  opts?: { skipGroq?: boolean; geminiOnly?: boolean }
): Promise<string> {
  const res = await askAIWithMeta(question, image, systemPromptOverride, opts);
  return res.answer;
}

/** Same as askAI but also returns which provider actually generated the answer
 *  (e.g. "gemini:gemini-2.5-flash"), for UI that wants to show it. */
export async function askAIWithMeta(
  question: string,
  image: PendingImage | null,
  systemPromptOverride?: string,
  opts?: { skipGroq?: boolean; geminiOnly?: boolean }
): Promise<{ answer: string; provider?: string }> {
  const systemPrompt = systemPromptOverride ?? getSystemPrompt(question || "ছবি বিশ্লেষণ করো");
  const geminiOnly = !!opts?.geminiOnly;
  for (let attempt = 1; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    // প্রথম attempt-এ যা caller চেয়েছে (opts.skipGroq) তাই মানা হয়; retry-গুলোতে
    // skipGroq সবসময় true (Groq প্রথম attempt-এ আগেই একবার চেষ্টা হয়ে থাকলে সেটা
    // পুনরায় চেষ্টা করে সময়/subrequest নষ্ট না করে সরাসরি Gemini/OpenRouter/Cerebras/CF-AI
    // দিয়ে দ্রুত retry হয়)। geminiOnly হলে skipGroq-এর মান কোনো effect রাখে না —
    // worker Gemini ছাড়া অন্য কোনো provider-এ যাবেই না।
    const skipGroq = attempt === 1 ? !!opts?.skipGroq : true;
    const result = await askAIOnce(question, image, systemPrompt, skipGroq, geminiOnly);
    if (result !== null) return result;
    if (attempt < MAX_CLIENT_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
  }
  return { answer: "❌ দুঃখিত! ATLAS AI এখন একটু busy আছে। কিছুক্ষণ পর আবার চেষ্টা করো। 🙏" };
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

  // \text{...} / \mathrm{...} / \mathbf{...} / \operatorname{...} -> plain inner
  // content. Matched with an OPTIONAL leading backslash because the model
  // sometimes drops the backslash entirely and emits the bare word
  // ("text{mmHg}" instead of "\text{mmHg}"). Requiring an immediate "{" right
  // after the keyword keeps this from ever matching ordinary prose. Must run
  // BEFORE \frac{}{} parsing below, since \frac's numerator/denominator often
  // contain these as nested braces, which a simple [^{}]+ regex can't see
  // through otherwise. Repeat a few passes in case of nested wrappers.
  for (let i = 0; i < 4; i++) {
    t = t.replace(/\\?(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, "$1");
  }

  // Spacing commands the model sometimes emits inside math (\!, \,, \;, \: and
  // an escaped literal space "\ ") — these carry no visible meaning, so just
  // collapse them to a single space (or nothing for the thin-space \!).
  t = t.replace(/\\!/g, "");
  t = t.replace(/\\[,;:]/g, " ");
  t = t.replace(/\\ /g, " ");

  t = t.replace(/\\rightarrow|\\to\b/g, "→");
  t = t.replace(/\\leftrightarrow|\\rightleftharpoons/g, "⇌");
  t = t.replace(/<=>|<->/g, "⇌");
  t = t.replace(/-+>/g, "→");
  t = t.replace(/\\times/g, "×");
  t = t.replace(/\\cdot/g, "·");
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

  // Superscript/subscript BEFORE \frac{}{} parsing — fraction arguments very
  // often contain unit exponents like mol^{-1}, and those braces would
  // otherwise block the frac matcher below (which requires brace-free args).
  t = t.replace(/\^\{([^{}]+)\}/g, (_m, g1) => toSuper(g1));
  t = t.replace(/_\{([^{}]+)\}/g, (_m, g1) => toSub(g1));
  // unbraced single-token form: ^12, ^n (superscript is rare in normal prose, safe to convert)
  t = t.replace(/\^([a-zA-Z0-9+\-]+)/g, (_m, g1) => toSuper(g1));
  // unbraced subscript: right after a letter/digit/close-paren, e.g. H_2, CO_2,
  // N_a — also allows a lone subscript letter (chemistry/physics notation).
  t = t.replace(/([A-Za-z0-9)])_([A-Za-z0-9+\-]+)/g, (_m, prefix, g1) => prefix + toSub(g1));

  // \frac{}{} / \dfrac{}{} / \tfrac{}{} — optional backslash for the same
  // reason as \text{} above. By this point text{}/superscript/subscript are
  // already flattened, so the numerator/denominator no longer contain nested
  // braces and this simple (non-nested) matcher is safe. Run twice to also
  // catch a fraction nested inside another fraction.
  for (let i = 0; i < 2; i++) {
    t = t.replace(/\\?(?:d|t)?frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2");
  }

  t = t.replace(/\\([a-zA-Z]+)/g, "$1");
  // Final safety net: any leftover LaTeX-only punctuation (unmatched braces from
  // a command pattern we didn't anticipate) must never reach the user.
  t = t.replace(/[{}]/g, "");
  return t;
}

/** Safety net: strip markdown heading hashes (#, ##, ###...) and stray
 *  backticks the model may still emit despite the plain-text instruction. */
function stripMarkdownHeadings(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*#{1,6}\s*/, ""))
    .join("\n")
    .replace(/`/g, "");
}

/** ইউজারের কথাবার্তা থেকে habit/পছন্দ বুঝে একটা ছোট মেমোরি নোট বানিয়ে/আপডেট করে
 *  localStorage-এ রাখে, যাতে ভবিষ্যতের কথোপকথনে সেটা মাথায় রেখে reply দেওয়া যায়।
 *  Token বাঁচাতে প্রতি ৮টা মেসেজে একবার (fire-and-forget, UI ব্লক করে না) আপডেট হয়। */
function updateUserMemoryIfDue(allMessages: ChatMsg[]) {
  const count = allMessages.length;
  let lastCount = 0;
  try {
    lastCount = Number(localStorage.getItem(USER_MEMORY_MSG_COUNT_KEY) || "0");
  } catch {
    /* ignore */
  }
  if (count - lastCount < 8) return;
  try {
    localStorage.setItem(USER_MEMORY_MSG_COUNT_KEY, String(count));
  } catch {
    /* ignore */
  }

  const existing = loadUserMemory();
  const recentText = allMessages
    .slice(-16)
    .map((m) => `${m.role === "user" ? "ইউজার" : "AI"}: ${m.text}`)
    .join("\n");

  const summarizePrompt = `নিচের কথোপকথন থেকে ইউজারের habit/পছন্দ/পড়াশোনার ধরন সম্পর্কে সংক্ষিপ্ত কিছু নোট বের করো (যেমন: কোন বিষয়ে বেশি প্রশ্ন করে, কোন সময় পড়াশোনা করে, কেমন ভাষা/স্টাইলে কথা বলে, কী নিয়ে দুশ্চিন্তায় থাকে ইত্যাদি — শুধু যা স্পষ্টভাবে বোঝা যায় তাই)। আগের নোট থাকলে তার সাথে মিলিয়ে আপডেট করা একটা সংক্ষিপ্ত (সর্বোচ্চ ৮-১০ লাইন) বুলেট-স্টাইল নোট বাংলায় দাও, অন্য কিছু লিখো না।

আগের নোট:
${existing || "(নেই)"}

সাম্প্রতিক কথোপকথন:
${recentText}`;

  askAI(
    summarizePrompt,
    null,
    "তুমি একজন সহকারী যে ইউজারের চ্যাট থেকে সংক্ষিপ্ত habit নোট তৈরি করো। শুধু নোটটুকু লিখবে, কোনো ভূমিকা/উপসংহার লিখবে না।"
  )
    .then((note) => {
      const cleaned = note.replace(/^❌.*$/gm, "").trim();
      if (cleaned) saveUserMemory(cleaned);
    })
    .catch(() => {
      /* best-effort, silently ignore failures */
    });
}

export function renderAnswer(rawText: string) {
  const text = stripMarkdownHeadings(sanitizeLatex(ensurePlainText(rawText)));
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
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [userContext, setUserContext] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "ATLAS AI";
  }, []);

  // Logged-in student হলে profile/course/exam/routine/bookmark data ফেচ করে
  // system prompt-এ জোগ করার জন্য রেখে দেওয়া হয় — চ্যাট শুরুর আগেই একবার।
  useEffect(() => {
    if (!user) { setUserContext(""); return; }
    fetchUserContext(user.id).then(setUserContext);
  }, [user]);


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

    // Code-level hard block: sexual/explicit content requests never reach the AI —
    // saves tokens and removes any prompt-bypass risk entirely.
    if (containsSexualContentRequest(question)) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "দুঃখিত, এই ধরনের বিষয়ে আমি সাহায্য করতে পারবো না। পড়াশোনা সংক্রান্ত কোনো প্রশ্ন থাকলে নির্দ্বিধায় জিজ্ঞেস করো। 📚",
        },
      ]);
      setBusy(false);
      return;
    }

    // Recent conversation history so the AI can judge whether this question
    // relates to the previous one and answer with continuity.
    // bug fix (root cause of frequent "সব provider fail" / user always seeing
    // busy message): this used to embed the last 12 FULL messages (including
    // long assistant explanations) into every request. Combined with the
    // subject-specific system prompt (NCTB syllabus text, ~1500+ chars), this
    // regularly pushed a single request past Groq's 8000 TPM limit — which
    // fails on EVERY key (it's a per-request size problem, not a key
    // problem), so key rotation/health-tracking couldn't help at all. Now:
    // fewer messages (6, not 12) AND each one truncated to a short summary
    // length, keeping total context small enough that Groq's TPM limit is
    // reliably respected regardless of how long past replies were.
    const HISTORY_MSG_LIMIT = 3;
    const HISTORY_MSG_MAX_CHARS = 220;
    const truncate = (s: string) =>
      s.length > HISTORY_MSG_MAX_CHARS ? s.slice(0, HISTORY_MSG_MAX_CHARS) + "…" : s;
    const recentHistory = messages.slice(-HISTORY_MSG_LIMIT);
    const historyBlock = recentHistory.length
      ? recentHistory
          .map((m) => `${m.role === "user" ? "ইউজার" : "তুমি"}: ${truncate(m.text)}`)
          .join("\n") + "\n\n"
      : "";
    const questionWithContext = historyBlock
      ? `${historyBlock}এখন ইউজারের নতুন মেসেজ (আগের কথোপকথনের সাথে সম্পর্কিত কিনা বুঝে উত্তর দাও):\n${question}`
      : question;

    const userMemoryNote = loadUserMemory();
    const answer = await askAI(
      questionWithContext,
      imgToSend,
      getSystemPrompt(question || "ছবি বিশ্লেষণ করো", userMemoryNote || undefined, userContext || undefined),
      { geminiOnly: true }
    );
    setMessages((m) => {
      const next = [...m, { role: "assistant" as const, text: answer }];
      updateUserMemoryIfDue(next);
      return next;
    });
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
