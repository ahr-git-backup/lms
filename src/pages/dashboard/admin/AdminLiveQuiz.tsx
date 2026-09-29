import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { format } from "date-fns";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Radio, CheckCircle2, RotateCw, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { QuestionData } from "@/types/exam";

const QUIZBOT_API_BASE = "https://quizbot.pages.dev";
const QUIZBOT_API_SECRET = "001b72896f99e070168d2e48a8c4710b";

export default function AdminLiveQuiz() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── history list of created live quizzes (+ Resend / Cancel) ──
  const { data: quizHistory } = useQuery({
    queryKey: ["scheduled-live-quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_live_quizzes")
        .select("id, name, exam_id, question_ids, chat_id, thread_id, per_q_time_sec, scheduled_at, status, error, channel_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });
  const [resendRow, setResendRow] = useState<any | null>(null);
  const [resendWhen, setResendWhen] = useState(""); // "" = instant, else datetime-local value
  const [resending, setResending] = useState(false);

  // ── manually-selected MCQs (filled in by the Question Bank picker at the
  //    bottom of this same form) — only questions the admin explicitly
  //    checks go into the Live Quiz, no whole-exam bulk-select ──
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionData[]>([]);

  // ── channel picker ──
  const [savedChannelId, setSavedChannelId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [savingNewChannel, setSavingNewChannel] = useState(false);

  const { data: savedChannels, refetch: refetchChannels } = useQuery({
    queryKey: ["telegram-channels-live-quiz"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_channels")
        .select("id, name, chat_id, thread_id")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const handleSelectSavedChannel = (id: string) => {
    setSavedChannelId(id);
    setNewChannelName("");
    if (id === "custom" || id === "__new__") {
      setChannelId("");
      setThreadId("");
      return;
    }
    const ch = savedChannels?.find((c: any) => c.id === id);
    if (ch) {
      setChannelId(ch.chat_id || "");
      setThreadId("");
    }
  };

  const handleSaveNewChannel = async () => {
    if (!newChannelName.trim() || !channelId.trim()) {
      toast({ title: "নাম ও Chat ID দুটোই দরকার", variant: "destructive" });
      return;
    }
    setSavingNewChannel(true);
    try {
      const { data, error } = await supabase
        .from("telegram_channels")
        .insert({ name: newChannelName.trim(), chat_id: channelId.trim(), thread_id: null, is_active: true })
        .select("id, name, chat_id, thread_id")
        .single();
      if (error) throw error;
      await refetchChannels();
      setSavedChannelId(data.id);
      setNewChannelName("");
      toast({ title: "নতুন channel সেভ হয়েছে" });
    } catch (err: any) {
      toast({ title: "সেভ করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSavingNewChannel(false);
    }
  };

  // ── Live Quiz fields ──
  const [quizName, setQuizName] = useState("");
  const [perQSec, setPerQSec] = useState("20");
  const [timing, setTiming] = useState<"instant" | "schedule">("instant");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  // Fired by QuestionBankSelector's onSelect — the admin manually checks
  // individual questions inside an exam and hits "Add (n)"; only those exact
  // MCQs are appended to this Live Quiz's question list.
  const handleBankSelect = (questions: QuestionData[]) => {
    if (!questions?.length) return;
    setSelectedQuestions((prev) => [...prev, ...questions]);
    setBankOpen(false); // auto-close after adding so the form below is reachable
    // Quiz name is entered manually by the admin — never auto-filled from the exam title.
  };

  const questionIds = selectedQuestions.map((q) => q.id).filter((id): id is string => !!id);

  const handleSubmit = async () => {
    if (questionIds.length === 0 || !channelId.trim()) {
      toast({ title: "অন্তত একটা প্রশ্ন ও Channel/Group ID দুটোই দরকার", variant: "destructive" });
      return;
    }
    if (!quizName.trim()) {
      toast({ title: "Live Quiz-এর নাম দিন", variant: "destructive" });
      return;
    }
    const perQ = Math.max(5, parseInt(perQSec, 10) || 20);
    let scheduledAtIso: string | undefined;
    if (timing === "schedule") {
      if (!date || !time) {
        toast({ title: "Date ও Time দুটোই দরকার", variant: "destructive" });
        return;
      }
      const local = new Date(`${date}T${time}:00`);
      if (isNaN(local.getTime())) {
        toast({ title: "সঠিক Date/Time দিন", variant: "destructive" });
        return;
      }
      if (local.getTime() < Date.now() - 60000) {
        toast({ title: "অতীতের সময় দেওয়া যাবে না", variant: "destructive" });
        return;
      }
      scheduledAtIso = local.toISOString();
    }
    setBusy(true);
    try {
      const res = await fetch(`${QUIZBOT_API_BASE}/api/lms-live-quiz/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: QUIZBOT_API_SECRET,
          name: quizName.trim(),
          question_ids: questionIds,
          chat_id: channelId.trim(),
          thread_id: threadId.trim() ? Number(threadId.trim()) : null,
          per_q_time_sec: perQ,
          scheduled_at: scheduledAtIso,
          channel_row_id: savedChannelId && savedChannelId !== "custom" && savedChannelId !== "__new__" ? savedChannelId : null,
        }),
      });
      const rawText = await res.text();
      let json: any;
      try { json = JSON.parse(rawText); } catch { throw new Error(`HTTP ${res.status}`); }
      if (!res.ok || !json.ok) throw new Error(json.error || "failed");
      toast({
        title: timing === "instant" ? "Live Quiz শুরু হচ্ছে" : "Live Quiz শিডিউল হয়েছে",
        description: timing === "instant" ? "১০ সেকেন্ডের মধ্যে চ্যানেলে শুরু হবে।" : `${date} ${time}-এ পাঠানো হবে।`,
      });
      queryClient.invalidateQueries({ queryKey: ["scheduled-live-quizzes"] });
      setSelectedQuestions([]);
      setQuizName("");
      setPerQSec("20");
      setTiming("instant");
      setDate("");
      setTime("");
    } catch (err: any) {
      toast({ title: "Schedule করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const channelNameFor = (row: any) =>
    savedChannels?.find((c: any) => c.id === row.channel_id)?.name || row.chat_id;

  const statusLabel = (st: string) =>
    ({ pending: "অপেক্ষমান", running: "চলছে", done: "শেষ", error: "ব্যর্থ", cancelled: "বাতিল" } as Record<string, string>)[st] || st;

  const handleResend = async () => {
    if (!resendRow) return;
    let scheduledAtIso: string | undefined;
    if (resendWhen) {
      const local = new Date(resendWhen);
      if (isNaN(local.getTime())) {
        toast({ title: "সঠিক Date/Time দিন", variant: "destructive" });
        return;
      }
      if (local.getTime() < Date.now() - 60000) {
        toast({ title: "অতীতের সময় দেওয়া যাবে না", variant: "destructive" });
        return;
      }
      scheduledAtIso = local.toISOString();
    }
    setResending(true);
    try {
      const res = await fetch(`${QUIZBOT_API_BASE}/api/lms-live-quiz/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: QUIZBOT_API_SECRET,
          name: resendRow.name,
          exam_id: resendRow.exam_id || undefined,
          question_ids: resendRow.question_ids || undefined,
          chat_id: resendRow.chat_id,
          thread_id: resendRow.thread_id || null,
          per_q_time_sec: resendRow.per_q_time_sec,
          scheduled_at: scheduledAtIso,
          channel_row_id: resendRow.channel_id || null,
        }),
      });
      const rawText = await res.text();
      let json: any;
      try { json = JSON.parse(rawText); } catch { throw new Error(`HTTP ${res.status}`); }
      if (!res.ok || !json.ok) throw new Error(json.error || "failed");
      toast({
        title: resendWhen ? "আবার শিডিউল হয়েছে" : "আবার শুরু হচ্ছে",
        description: resendWhen ? format(new Date(resendWhen), "dd MMM yyyy, hh:mm a") : "১০ সেকেন্ডের মধ্যে চ্যানেলে শুরু হবে।",
      });
      setResendRow(null);
      setResendWhen("");
      queryClient.invalidateQueries({ queryKey: ["scheduled-live-quizzes"] });
    } catch (err: any) {
      toast({ title: "Resend করা যায়নি", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const handleCancelRow = async (id: string) => {
    try {
      const res = await fetch(`${QUIZBOT_API_BASE}/api/lms-live-quiz/cancel/${id}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      queryClient.invalidateQueries({ queryKey: ["scheduled-live-quizzes"] });
    } catch (err: any) {
      toast({ title: "বাতিল করা যায়নি", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Radio className="h-5 w-5 text-red-600" /> Live Quiz
        </h1>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Live Quiz-এর নাম</label>
            <Input placeholder="যেমন: জাতীয় বাজেট Live Quiz" value={quizName} onChange={(e) => setQuizName(e.target.value)} disabled={busy} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Per Question Time (sec)</label>
              <Input type="number" min={5} value={perQSec} onChange={(e) => setPerQSec(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">কখন পাঠাবে</label>
              <Select value={timing} onValueChange={(v) => setTiming(v as any)} disabled={busy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">এখনই (Instant)</SelectItem>
                  <SelectItem value="schedule">শিডিউল করো</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {timing === "schedule" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">কবে পাঠাবে</label>
              <Input
                type="datetime-local"
                value={date && time ? `${date}T${time}` : ""}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => {
                  const [d, t] = e.target.value ? e.target.value.split("T") : ["", ""];
                  setDate(d || "");
                  setTime(t || "");
                }}
                disabled={busy}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Saved Channel</label>
            <Select value={savedChannelId} onValueChange={handleSelectSavedChannel} disabled={busy}>
              <SelectTrigger><SelectValue placeholder="একটা channel বেছে নাও অথবা নতুন লিখো" /></SelectTrigger>
              <SelectContent>
                {savedChannels?.map((ch: any) => (
                  <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                ))}
                <SelectItem value="__new__">+ নতুন channel যোগ করো</SelectItem>
                <SelectItem value="custom">নতুন / সরাসরি ID লিখো (সেভ ছাড়া)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {savedChannelId === "__new__" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">নতুন Channel-এর নাম</label>
              <Input placeholder="যেমন: HSC Batch 27 Group" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} disabled={busy || savingNewChannel} />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Channel/Group Chat ID</label>
            <Input placeholder="-100xxxxxxxxxx" value={channelId} onChange={(e) => setChannelId(e.target.value)} disabled={busy} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Thread/Topic ID (ঐচ্ছিক, সেভ হয় না)</label>
            <Input placeholder="ঐচ্ছিক" value={threadId} onChange={(e) => setThreadId(e.target.value)} disabled={busy} />
          </div>

          {savedChannelId === "__new__" && (
            <Button type="button" variant="secondary" size="sm" onClick={handleSaveNewChannel} disabled={savingNewChannel || busy || !newChannelName.trim() || !channelId.trim()}>
              {savingNewChannel ? "সেভ হচ্ছে..." : "এই নামে সেভ করো"}
            </Button>
          )}

          {/* Question Bank picker — same drill-down as ExamForm, mounted
              inline at the end of this same form. Admin must manually check
              individual MCQs (no whole-exam bulk select) — only those exact
              questions go into the Live Quiz. */}
          <div className="space-y-1 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Question Bank — প্রশ্ন বাছাই করো</label>
              {selectedQuestions.length > 0 && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {selectedQuestions.length}টি প্রশ্ন যোগ হয়েছে
                </span>
              )}
            </div>
            {bankOpen ? (
              <div className="space-y-2">
                <div className="border rounded-lg h-[80vh] sm:h-[55vh] overflow-hidden">
                  <QuestionBankSelector onSelect={handleBankSelect} />
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setBankOpen(false)}>
                  ✕ Question Bank বন্ধ করো
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setBankOpen(true)}>
                {selectedQuestions.length > 0 ? "＋ আরও প্রশ্ন যোগ করো" : "Question Bank খোলো"}
              </Button>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => navigate("/dashboard")}>বাতিল</Button>
            <Button size="sm" disabled={busy || questionIds.length === 0} onClick={handleSubmit}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (timing === "instant" ? "🔴 এখনই শুরু করো" : "শিডিউল করো")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Created Live Quizzes (history) ── */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-2">
          <h3 className="text-sm font-semibold">তৈরি করা Live Quiz ({quizHistory?.length ?? 0})</h3>
          {!quizHistory?.length && <p className="text-xs text-muted-foreground">এখনো কোনো Live Quiz তৈরি হয়নি।</p>}
          {quizHistory?.map((row: any) => {
            const qCount = row.question_ids?.length;
            return (
              <div key={row.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{row.name}</p>
                    <Badge variant={row.status === "error" ? "destructive" : row.status === "done" ? "secondary" : "outline"} className="text-[10px] shrink-0">
                      {statusLabel(row.status)}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {channelNameFor(row)} · {qCount ? `${qCount}টি প্রশ্ন` : "পুরো exam"} · {row.per_q_time_sec}s · {format(new Date(row.scheduled_at), "dd MMM, hh:mm a")}
                  </p>
                  {row.status === "error" && row.error && <p className="text-[11px] text-destructive truncate">{row.error}</p>}
                </div>
                {row.status === "pending" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="বাতিল" onClick={() => handleCancelRow(row.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" className="shrink-0 h-8 px-2" onClick={() => { setResendRow(row); setResendWhen(""); }}>
                  <RotateCw className="h-3.5 w-3.5 mr-1" /> Resend
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!resendRow} onOpenChange={(v) => { if (!v && !resending) setResendRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>আবার পাঠাও — {resendRow?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">কখন পাঠাবে (খালি রাখলে এখনই)</label>
              <Input
                type="datetime-local"
                value={resendWhen}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => setResendWhen(e.target.value)}
                disabled={resending}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={resending} onClick={() => setResendRow(null)}>বাতিল</Button>
              <Button size="sm" disabled={resending} onClick={handleResend}>
                {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (resendWhen ? "শিডিউল করো" : "🔴 এখনই শুরু করো")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
