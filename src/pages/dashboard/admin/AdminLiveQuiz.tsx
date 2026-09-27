import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Radio, CheckCircle2 } from "lucide-react";
import type { QuestionData } from "@/types/exam";

const QUIZBOT_API_BASE = "https://quizbot.pages.dev";
const QUIZBOT_API_SECRET = "001b72896f99e070168d2e48a8c4710b";

export default function AdminLiveQuiz() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // ── manually-selected MCQs (filled in by the Question Bank picker at the
  //    bottom of this same form) — only questions the admin explicitly
  //    checks go into the Live Quiz, no whole-exam bulk-select ──
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionData[]>([]);
  const [selectedExamTitle, setSelectedExamTitle] = useState<string>("");

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

  // Fired by QuestionBankSelector's onSelect — the admin manually checks
  // individual questions inside an exam and hits "Add (n)"; only those exact
  // MCQs are appended to this Live Quiz's question list.
  const handleBankSelect = (questions: QuestionData[], source?: { label: string; examIds: string[] }) => {
    if (!questions?.length) return;
    setSelectedQuestions((prev) => [...prev, ...questions]);
    const label = source?.label || "";
    setSelectedExamTitle((prev) => prev || label);
    setQuizName((prev) => prev || label);
  };

  const questionIds = selectedQuestions.map((q) => q.id).filter((id): id is string => !!id);

  const handleSubmit = async () => {
    if (questionIds.length === 0 || !channelId.trim()) {
      toast({ title: "অন্তত একটা প্রশ্ন ও Channel/Group ID দুটোই দরকার", variant: "destructive" });
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
      setSelectedQuestions([]);
      setSelectedExamTitle("");
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

  return (
    <div className="w-full max-w-4xl mx-auto p-2 sm:p-4 space-y-4">
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
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Time</label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={busy} />
              </div>
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
            <div className="border rounded-lg h-[80vh] sm:h-[55vh] overflow-hidden">
              <QuestionBankSelector onSelect={handleBankSelect} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => navigate("/dashboard")}>বাতিল</Button>
            <Button size="sm" disabled={busy || questionIds.length === 0} onClick={handleSubmit}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (timing === "instant" ? "🔴 এখনই শুরু করো" : "শিডিউল করো")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
