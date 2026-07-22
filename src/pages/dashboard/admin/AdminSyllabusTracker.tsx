import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Trash2, Plus, BarChart3, Pencil, Check, X, Layers, BookOpen, Trophy, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StudyTrackerProgress } from "@/components/admin/StudyTrackerProgress";
import { StudyTrackerRevision } from "@/components/admin/StudyTrackerRevision";

type Mode = "hsc" | "medical";

const AdminSyllabusTracker = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("hsc");
  const [subjectName, setSubjectName] = useState("");
  const [chapterSubjectId, setChapterSubjectId] = useState<number | "">("");
  const [chapterName, setChapterName] = useState("");
  const [topicSubjectId, setTopicSubjectId] = useState<number | "">("");
  const [topicChapterId, setTopicChapterId] = useState<number | "">("");
  const [topicNames, setTopicNames] = useState(""); // one per line, bulk add
  const [saving, setSaving] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);
  const [bulkSubjectName, setBulkSubjectName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkExistingSubjectId, setBulkExistingSubjectId] = useState<number | "">("");
  const [editSubjectId, setEditSubjectId] = useState<number | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editChapterId, setEditChapterId] = useState<number | null>(null);
  const [editChapterName, setEditChapterName] = useState("");
  const [editTopicId, setEditTopicId] = useState<number | null>(null);
  const [editTopicName, setEditTopicName] = useState("");

  useEffect(() => {
    document.title = "Study Tracker — Admin";
  }, []);

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["admin-st-subjects", mode],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("st_subjects")
        .select("id, name, short_name, sort_order")
        .eq("mode", mode)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: chaptersOfSubject } = useQuery({
    queryKey: ["admin-st-chapters", expandedSubject],
    enabled: expandedSubject !== null,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("st_chapters")
        .select("id, name, subject_id")
        .eq("subject_id", expandedSubject!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const withCounts = await Promise.all(
        (data || []).map(async (ch: any) => {
          const { count } = await (supabase.from as any)("st_topics")
            .select("id", { count: "exact", head: true })
            .eq("chapter_id", ch.id);
          return { ...ch, topicCount: count || 0 };
        })
      );
      return withCounts;
    },
  });

  const { data: topicsOfChapter } = useQuery({
    queryKey: ["admin-st-topics", expandedChapter],
    enabled: expandedChapter !== null,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("st_topics")
        .select("id, name, weight")
        .eq("chapter_id", expandedChapter!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: topicChapterOptions } = useQuery({
    queryKey: ["admin-st-topic-chapter-options", topicSubjectId],
    enabled: topicSubjectId !== "",
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("st_chapters")
        .select("id, name")
        .eq("subject_id", topicSubjectId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const refreshSubjects = () => queryClient.invalidateQueries({ queryKey: ["admin-st-subjects", mode] });
  const refreshChapters = () => queryClient.invalidateQueries({ queryKey: ["admin-st-chapters", expandedSubject] });
  const refreshTopics = () => queryClient.invalidateQueries({ queryKey: ["admin-st-topics", expandedChapter] });

  const addSubject = async () => {
    if (!subjectName.trim()) {
      toast({ title: "বিষয়ের নাম দিন", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const nextOrder = (subjects && subjects.length > 0) ? Math.max(...subjects.map((s: any) => s.sort_order)) + 1 : 0;
      const { error } = await (supabase.from as any)("st_subjects").insert({
        mode,
        name: subjectName.trim(),
        short_name: subjectName.trim().slice(0, 12),
        sort_order: nextOrder,
      });
      if (error) throw error;
      setSubjectName("");
      toast({ title: "বিষয় যোগ হয়েছে" });
      refreshSubjects();
    } catch (e: any) {
      toast({ title: "ব্যর্থ হয়েছে", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addChapter = async () => {
    if (!chapterSubjectId || !chapterName.trim()) {
      toast({ title: "বিষয় বেছে নিয়ে অধ্যায়ের নাম দিন", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: existing } = await (supabase.from as any)("st_chapters")
        .select("sort_order")
        .eq("subject_id", chapterSubjectId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (existing?.sort_order ?? -1) + 1;
      const { error } = await (supabase.from as any)("st_chapters").insert({
        subject_id: chapterSubjectId,
        name: chapterName.trim(),
        sort_order: nextOrder,
      });
      if (error) throw error;
      setChapterName("");
      toast({ title: "অধ্যায় যোগ হয়েছে" });
      if (expandedSubject === chapterSubjectId) refreshChapters();
      queryClient.invalidateQueries({ queryKey: ["admin-st-topic-chapter-options", chapterSubjectId] });
    } catch (e: any) {
      toast({ title: "ব্যর্থ হয়েছে", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addTopics = async () => {
    const names = topicNames.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!topicChapterId || names.length === 0) {
      toast({ title: "অধ্যায় বেছে নিয়ে অন্তত একটি টপিক দিন", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: existing } = await (supabase.from as any)("st_topics")
        .select("sort_order")
        .eq("chapter_id", topicChapterId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      let nextOrder = (existing?.sort_order ?? -1) + 1;
      const rows = names.map((n) => ({ chapter_id: topicChapterId, name: n, weight: 1, sort_order: nextOrder++ }));
      const { error } = await (supabase.from as any)("st_topics").insert(rows);
      if (error) throw error;
      setTopicNames("");
      toast({ title: `${names.length}টি টপিক যোগ হয়েছে` });
      if (expandedChapter === topicChapterId) refreshTopics();
      refreshSubjects();
    } catch (e: any) {
      toast({ title: "ব্যর্থ হয়েছে", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Bulk add: paste whole structure at once.
  // Format (indent-based):
  // Chapter Name
  //   Topic 1
  //   Topic 2
  // Another Chapter
  //   Topic 1
  // Lines with no leading space/tab = chapter. Indented lines = topics.
  const bulkAddAll = async () => {
    const lines = bulkText.split("\n").map((l) => l.replace(/\r/g, "")).filter((l) => l.trim() !== "");
    if (lines.length === 0) {
      toast({ title: "কিছু পেস্ট করুন", variant: "destructive" });
      return;
    }
    if (!bulkSubjectName.trim() && !bulkExistingSubjectId) {
      toast({ title: "নতুন বিষয়ের নাম দিন অথবা বিদ্যমান বিষয় বেছে নিন", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let subjectId: number;
      if (bulkExistingSubjectId) {
        subjectId = bulkExistingSubjectId as number;
      } else {
        const nextOrder = (subjects && subjects.length > 0) ? Math.max(...subjects.map((s: any) => s.sort_order)) + 1 : 0;
        const { data: newSubj, error: subjErr } = await (supabase.from as any)("st_subjects")
          .insert({ mode, name: bulkSubjectName.trim(), short_name: bulkSubjectName.trim().slice(0, 12), sort_order: nextOrder })
          .select("id")
          .single();
        if (subjErr) throw subjErr;
        subjectId = newSubj.id;
      }

      // Parse: indented lines (starts with space/tab) belong to the last non-indented line (chapter)
      const chapters: { name: string; topics: string[] }[] = [];
      for (const raw of lines) {
        const isIndented = /^[ \t]/.test(raw);
        const text = raw.trim();
        if (!text) continue;
        if (isIndented) {
          if (chapters.length === 0) chapters.push({ name: "সাধারণ", topics: [] });
          chapters[chapters.length - 1].topics.push(text);
        } else {
          chapters.push({ name: text, topics: [] });
        }
      }

      const { data: existingCh } = await (supabase.from as any)("st_chapters")
        .select("sort_order")
        .eq("subject_id", subjectId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      let chOrder = (existingCh?.sort_order ?? -1) + 1;

      for (const ch of chapters) {
        const { data: newCh, error: chErr } = await (supabase.from as any)("st_chapters")
          .insert({ subject_id: subjectId, name: ch.name, sort_order: chOrder++ })
          .select("id")
          .single();
        if (chErr) throw chErr;
        if (ch.topics.length > 0) {
          const rows = ch.topics.map((n, i) => ({ chapter_id: newCh.id, name: n, weight: 1, sort_order: i }));
          const { error: topErr } = await (supabase.from as any)("st_topics").insert(rows);
          if (topErr) throw topErr;
        }
      }

      toast({ title: `যোগ সম্পন্ন: ${chapters.length}টি অধ্যায়, ${chapters.reduce((a, c) => a + c.topics.length, 0)}টি টপিক` });
      setBulkSubjectName("");
      setBulkText("");
      setBulkExistingSubjectId("");
      refreshSubjects();
      if (expandedSubject === subjectId) refreshChapters();
    } catch (e: any) {
      toast({ title: "ব্যর্থ হয়েছে", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateSubject = async (id: number) => {
    if (!editSubjectName.trim()) return;
    const { error } = await (supabase.from as any)("st_subjects").update({ name: editSubjectName.trim(), short_name: editSubjectName.trim().slice(0, 12) }).eq("id", id);
    if (error) {
      toast({ title: "ব্যর্থ হয়েছে", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "আপডেট হয়েছে" });
    setEditSubjectId(null);
    refreshSubjects();
  };

  const updateChapter = async (id: number) => {
    if (!editChapterName.trim()) return;
    const { error } = await (supabase.from as any)("st_chapters").update({ name: editChapterName.trim() }).eq("id", id);
    if (error) {
      toast({ title: "ব্যর্থ হয়েছে", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "আপডেট হয়েছে" });
    setEditChapterId(null);
    refreshChapters();
  };

  const updateTopic = async (id: number) => {
    if (!editTopicName.trim()) return;
    const { error } = await (supabase.from as any)("st_topics").update({ name: editTopicName.trim() }).eq("id", id);
    if (error) {
      toast({ title: "ব্যর্থ হয়েছে", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "আপডেট হয়েছে" });
    setEditTopicId(null);
    refreshTopics();
  };

  const updateWeight = async (id: number, weight: number) => {
    const { error } = await (supabase.from as any)("st_topics").update({ weight }).eq("id", id);
    if (error) {
      toast({ title: "ব্যর্থ হয়েছে", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Weight আপডেট হয়েছে" });
    refreshTopics();
  };

  const applyTopicsToAllChapters = async (sourceChapId: number, subjId: number) => {
    if (!confirm("এই অধ্যায়ের সব টপিক কি একই বিষয়ের বাকি সব অধ্যায়ে যোগ করতে চান?")) return;
    setSaving(true);
    try {
      const { data: sourceTopics } = await (supabase.from as any)("st_topics")
        .select("name, weight")
        .eq("chapter_id", sourceChapId);
      if (!sourceTopics || sourceTopics.length === 0) {
        toast({ title: "এই অধ্যায়ে কোনো টপিক নেই", variant: "destructive" });
        return;
      }

      const { data: allChapters } = await (supabase.from as any)("st_chapters")
        .select("id")
        .eq("subject_id", subjId);
      const targetChapters = (allChapters || []).filter((c: any) => c.id !== sourceChapId);
      if (targetChapters.length === 0) {
        toast({ title: "এই বিষয়ে আর কোনো অধ্যায় নেই", variant: "destructive" });
        return;
      }

      let addedCount = 0;
      for (const ch of targetChapters) {
        const { data: existingTopics } = await (supabase.from as any)("st_topics")
          .select("name")
          .eq("chapter_id", ch.id);
        const existingNames = new Set((existingTopics || []).map((t: any) => t.name.trim().toLowerCase()));
        const { data: existingSort } = await (supabase.from as any)("st_topics")
          .select("sort_order")
          .eq("chapter_id", ch.id)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        let nextSort = (existingSort?.sort_order ?? -1) + 1;

        const rowsToInsert = sourceTopics
          .filter((t: any) => !existingNames.has(t.name.trim().toLowerCase()))
          .map((t: any) => ({ name: t.name, chapter_id: ch.id, weight: t.weight || 1, sort_order: nextSort++ }));

        if (rowsToInsert.length > 0) {
          const { error } = await (supabase.from as any)("st_topics").insert(rowsToInsert);
          if (error) throw error;
          addedCount += rowsToInsert.length;
        }
      }

      toast({ title: `${targetChapters.length}টি অধ্যায়ে ${addedCount}টি টপিক যোগ হয়েছে` });
      refreshSubjects();
    } catch (e: any) {
      toast({ title: "ব্যর্থ হয়েছে", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteSubject = async (id: number) => {
    if (!confirm("এই বিষয়, সব অধ্যায় ও টপিক ডিলিট হবে। নিশ্চিত?")) return;
    const { error } = await (supabase.from as any)("st_subjects").delete().eq("id", id);
    if (error) {
      toast({ title: "ব্যর্থ হয়েছে", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "বিষয় ডিলিট হয়েছে" });
    refreshSubjects();
  };

  const deleteChapter = async (id: number) => {
    if (!confirm("এই অধ্যায় ও সব টপিক ডিলিট হবে। নিশ্চিত?")) return;
    const { error } = await (supabase.from as any)("st_chapters").delete().eq("id", id);
    if (error) {
      toast({ title: "ব্যর্থ হয়েছে", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "অধ্যায় ডিলিট হয়েছে" });
    refreshChapters();
  };

  const deleteTopic = async (id: number) => {
    const { error } = await (supabase.from as any)("st_topics").delete().eq("id", id);
    if (error) {
      toast({ title: "ব্যর্থ হয়েছে", variant: "destructive" });
      return;
    }
    refreshTopics();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-sky-600" /> Study Tracker ম্যানেজার
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Syllabus, Progress এবং Revision কন্টেন্ট এখান থেকে ম্যানেজ করুন।
        </p>
      </div>

      <Tabs defaultValue="syllabus" className="space-y-4">
        <TabsList>
          <TabsTrigger value="syllabus" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Syllabus Tracker
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-1.5">
            <Trophy className="h-4 w-4" /> Weak &amp; Progress
          </TabsTrigger>
          <TabsTrigger value="revision" className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Revision Planner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="progress">
          <StudyTrackerProgress />
        </TabsContent>

        <TabsContent value="revision">
          <StudyTrackerRevision />
        </TabsContent>

        <TabsContent value="syllabus" className="space-y-6">

      {/* Mode tabs */}
      <div className="flex gap-2">
        <Button variant={mode === "hsc" ? "default" : "outline"} onClick={() => { setMode("hsc"); setExpandedSubject(null); setExpandedChapter(null); }}>
          HSC সিলেবাস
        </Button>
        <Button variant={mode === "medical" ? "default" : "outline"} onClick={() => { setMode("medical"); setExpandedSubject(null); setExpandedChapter(null); }}>
          Medical Admission
        </Button>
      </div>

      {/* Bulk add everything at once */}
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> এক সাথে সব যোগ করুন (Subject + Chapter + Topic)
          </CardTitle>
          <CardDescription>মোড: {mode === "hsc" ? "HSC" : "Medical Admission"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <Input
              placeholder="নতুন বিষয়ের নাম (যেমন: পদার্থবিজ্ঞান)"
              value={bulkSubjectName}
              onChange={(e) => { setBulkSubjectName(e.target.value); setBulkExistingSubjectId(""); }}
              disabled={!!bulkExistingSubjectId}
            />
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={bulkExistingSubjectId}
              onChange={(e) => { setBulkExistingSubjectId(e.target.value ? Number(e.target.value) : ""); setBulkSubjectName(""); }}
            >
              <option value="">অথবা বিদ্যমান বিষয়ে যোগ করুন</option>
              {subjects?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <textarea
            className="w-full min-h-40 rounded-md border bg-background px-3 py-2 text-sm font-mono"
            placeholder={"অধ্যায়ের নাম লিখুন (কোনো স্পেস ছাড়া), তার নিচে টপিক লিখুন এক স্পেস/ট্যাব দিয়ে ইনডেন্ট করে:\n\nভেক্টর\n  ভেক্টরের যোগ\n  ভেক্টরের বিয়োগ\nনিউটনিয়ান বলবিদ্যা\n  নিউটনের সূত্র\n  ঘর্ষণ বল"}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <Button onClick={() => void bulkAddAll()} disabled={saving} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> সব যোগ করুন
          </Button>
        </CardContent>
      </Card>

      {/* Add subject */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">নতুন বিষয় যোগ করুন</CardTitle>
          <CardDescription>মোড: {mode === "hsc" ? "HSC" : "Medical Admission"}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="বিষয়ের নাম (যেমন: পদার্থবিজ্ঞান)"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
          />
          <Button onClick={() => void addSubject()} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" /> যোগ করুন
          </Button>
        </CardContent>
      </Card>

      {/* Add chapter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">নতুন অধ্যায় যোগ করুন</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={chapterSubjectId}
            onChange={(e) => setChapterSubjectId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">বিষয় বেছে নিন</option>
            {subjects?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Input
            placeholder="অধ্যায়ের নাম (যেমন: ভেক্টর)"
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
          />
          <Button onClick={() => void addChapter()} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" /> যোগ করুন
          </Button>
        </CardContent>
      </Card>

      {/* Add topics (bulk, one per line) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">নতুন টপিক যোগ করুন (একাধিক, প্রতি লাইনে একটি)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={topicSubjectId}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : "";
              setTopicSubjectId(v);
              setTopicChapterId("");
            }}
          >
            <option value="">বিষয় বেছে নিন</option>
            {subjects?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={topicChapterId}
            onChange={(e) => setTopicChapterId(e.target.value ? Number(e.target.value) : "")}
            disabled={!topicSubjectId}
          >
            <option value="">অধ্যায় বেছে নিন</option>
            {topicChapterOptions?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <textarea
            className="w-full min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder={"একটি লাইনে একটি টপিক লিখুন\nযেমন:\nভেক্টরের যোগ\nভেক্টরের বিয়োগ"}
            value={topicNames}
            onChange={(e) => setTopicNames(e.target.value)}
          />
          <Button onClick={() => void addTopics()} disabled={saving} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> টপিক যোগ করুন
          </Button>
        </CardContent>
      </Card>

      {/* Subjects/chapters/topics tree */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            বিষয় সমূহ {subjects ? `(${subjects.length}টি)` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>}
          {!isLoading && (!subjects || subjects.length === 0) && (
            <p className="text-sm text-muted-foreground">কোনো বিষয় নেই। উপরে যোগ করুন।</p>
          )}
          {subjects?.map((s: any) => {
            const isOpen = expandedSubject === s.id;
            return (
              <div key={s.id} className="border rounded-xl overflow-hidden">
                <div className="w-full flex items-center gap-2 p-3 hover:bg-muted/40">
                  {editSubjectId === s.id ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <Input
                        className="h-8 text-sm"
                        value={editSubjectName}
                        onChange={(e) => setEditSubjectName(e.target.value)}
                        autoFocus
                      />
                      <Button size="icon" className="h-7 w-7" onClick={() => void updateSubject(s.id)}><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditSubjectId(null)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setExpandedSubject(isOpen ? null : s.id)}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                      <span className="font-semibold text-sm">{s.name}</span>
                    </button>
                  )}
                  {editSubjectId !== s.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => { setEditSubjectId(s.id); setEditSubjectName(s.name); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteSubject(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {isOpen && (
                  <div className="border-t bg-muted/20 p-2 space-y-1.5">
                    {chaptersOfSubject?.map((ch: any) => {
                      const chOpen = expandedChapter === ch.id;
                      return (
                        <div key={ch.id} className="border rounded-lg bg-card overflow-hidden">
                          <div className="flex items-center gap-2 p-2.5">
                            {editChapterId === ch.id ? (
                              <div className="flex-1 flex items-center gap-1.5">
                                <Input
                                  className="h-7 text-xs"
                                  value={editChapterName}
                                  onChange={(e) => setEditChapterName(e.target.value)}
                                  autoFocus
                                />
                                <Button size="icon" className="h-6 w-6" onClick={() => void updateChapter(ch.id)}><Check className="h-3 w-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditChapterId(null)}><X className="h-3 w-3" /></Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setExpandedChapter(chOpen ? null : ch.id)}
                                className="flex-1 flex items-center gap-2 text-left text-xs"
                              >
                                <ChevronDown
                                  className={cn("h-3.5 w-3.5 transition-transform", chOpen && "rotate-180")}
                                />
                                <span className="font-medium">{ch.name}</span>
                                <span className="text-muted-foreground">({ch.topicCount} টপিক)</span>
                              </button>
                            )}
                            {editChapterId !== ch.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => { setEditChapterId(ch.id); setEditChapterName(ch.name); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteChapter(ch.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {chOpen && (
                            <div className="border-t p-2 space-y-1.5 max-h-64 overflow-y-auto">
                              {(topicsOfChapter?.length ?? 0) > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-[10.5px] h-7 border-primary/40 text-primary font-bold"
                                  disabled={saving}
                                  onClick={() => void applyTopicsToAllChapters(ch.id, s.id)}
                                >
                                  <Layers className="h-3 w-3 mr-1" /> এই {topicsOfChapter?.length}টি টপিক একই বিষয়ের বাকি সব অধ্যায়ে Apply করুন
                                </Button>
                              )}
                              {(() => {
                                const totalW = (topicsOfChapter || []).reduce((s2: number, t: any) => s2 + (t.weight || 1), 0);
                                return topicsOfChapter?.map((t: any) => {
                                  const pct = totalW > 0 ? Math.round(((t.weight || 1) / totalW) * 100) : 0;
                                  return (
                                <div
                                  key={t.id}
                                  className="flex items-center gap-2 text-[11px] bg-muted/30 rounded-md p-2"
                                >
                                  {editTopicId === t.id ? (
                                    <div className="flex-1 flex items-center gap-1">
                                      <Input
                                        className="h-6 text-[11px]"
                                        value={editTopicName}
                                        onChange={(e) => setEditTopicName(e.target.value)}
                                        autoFocus
                                      />
                                      <Button size="icon" className="h-5 w-5" onClick={() => void updateTopic(t.id)}><Check className="h-3 w-3" /></Button>
                                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditTopicId(null)}><X className="h-3 w-3" /></Button>
                                    </div>
                                  ) : (
                                    <span className="flex-1">{t.name}</span>
                                  )}
                                  <span className="text-[9.5px] text-primary font-bold min-w-[26px] text-right">{pct}%</span>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    defaultValue={t.weight || 1}
                                    title="Weight"
                                    className="h-6 w-10 text-[10px] text-center px-1"
                                    onBlur={(e) => {
                                      const v = parseInt(e.target.value) || 1;
                                      if (v !== (t.weight || 1)) void updateWeight(t.id, v);
                                    }}
                                  />
                                  {editTopicId !== t.id && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-muted-foreground flex-shrink-0"
                                      onClick={() => { setEditTopicId(t.id); setEditTopicName(t.name); }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-destructive flex-shrink-0"
                                    onClick={() => deleteTopic(t.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                  );
                                });
                              })()}
                              {topicsOfChapter?.length === 0 && (
                                <p className="text-[11px] text-muted-foreground text-center py-2">
                                  কোনো টপিক নেই
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {chaptersOfSubject?.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">কোনো অধ্যায় নেই</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSyllabusTracker;
