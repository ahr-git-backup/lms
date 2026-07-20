import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Trash2, Plus, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    document.title = "Syllabus Tracker — Admin";
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
          <BarChart3 className="h-5 w-5 text-sky-600" /> Syllabus Tracker ম্যানেজার
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          বিষয় → অধ্যায় → টপিক — HSC ও Medical Admission আলাদাভাবে যোগ করুন।
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2">
        <Button variant={mode === "hsc" ? "default" : "outline"} onClick={() => { setMode("hsc"); setExpandedSubject(null); setExpandedChapter(null); }}>
          HSC সিলেবাস
        </Button>
        <Button variant={mode === "medical" ? "default" : "outline"} onClick={() => { setMode("medical"); setExpandedSubject(null); setExpandedChapter(null); }}>
          Medical Admission
        </Button>
      </div>

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
                  <button
                    onClick={() => setExpandedSubject(isOpen ? null : s.id)}
                    className="flex-1 flex items-center gap-2 text-left"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    <span className="font-semibold text-sm">{s.name}</span>
                  </button>
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
                              {topicsOfChapter?.map((t: any) => (
                                <div
                                  key={t.id}
                                  className="flex items-start gap-2 text-[11px] bg-muted/30 rounded-md p-2"
                                >
                                  <span className="flex-1">{t.name}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-destructive flex-shrink-0"
                                    onClick={() => deleteTopic(t.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
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
    </div>
  );
};

export default AdminSyllabusTracker;
