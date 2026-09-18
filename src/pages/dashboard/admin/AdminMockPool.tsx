import { useState } from "react";
import Papa from "papaparse";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, Trash2, FileUp, BookOpen, X, Pencil, Plus, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { useGlobalMetadata, useAddGlobalMetadata, useRenameGlobalMetadata, useDeleteGlobalMetadata } from "@/hooks/useGlobalMetadata";
import type { QuestionData } from "@/components/admin/QuestionEditor";

const DEFAULT_STANDARDS = [
  { value: "medical", label: "Medical" },
  { value: "varsity", label: "Varsity" },
  { value: "onushiloni", label: "Onushiloni" },
];

const AdminMockPool = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [standard, setStandard] = useState("medical");
  const [csvData, setCsvData] = useState<any[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [qbQuestions, setQbQuestions] = useState<QuestionData[] | null>(null);
  const [isQbOpen, setIsQbOpen] = useState(false);
  // Tracks each Question Bank import as a separate "source" row — shown
  // compactly below so the admin can see exactly what was pulled in and
  // preview it, instead of one flat merged list with no origin info.
  const [qbSources, setQbSources] = useState<{ id: string; label: string; examIds: string[]; questions: QuestionData[] }[]>([]);
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null);

  // Edit-existing-entry dialog state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editChapter, setEditChapter] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editStandard, setEditStandard] = useState("medical");
  const [editQuestions, setEditQuestions] = useState<any[]>([]);
  const [editCsvData, setEditCsvData] = useState<any[] | null>(null);
  const [editCsvFileName, setEditCsvFileName] = useState("");
  const [isEditQbOpen, setIsEditQbOpen] = useState(false);
  const [editQbSources, setEditQbSources] = useState<{ id: string; label: string; examIds: string[]; questions: QuestionData[] }[]>([]);
  const [editPreviewSourceId, setEditPreviewSourceId] = useState<string | null>(null);

  const { data: pools, isLoading } = useQuery({
    queryKey: ["admin-mock-pool"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Reusable Subject/Chapter/Topic lists — same global_metadata system used by
  // the main exam creator, so once added they stay available as dropdown
  // options everywhere (mock_subject/mock_chapter/mock_topic types).
  const { data: globalMeta } = useGlobalMetadata() as any;
  const addMeta = useAddGlobalMetadata();
  const renameMeta = useRenameGlobalMetadata();
  const deleteMeta = useDeleteGlobalMetadata();

  const standardOptions: { value: string; label: string }[] = (() => {
    const extra = (globalMeta?.mock_standard || []) as { value: string; label: string }[];
    const map = new Map<string, { value: string; label: string }>();
    DEFAULT_STANDARDS.forEach((s) => map.set(s.value, s));
    extra.forEach((s) => {
      if (!map.has(s.value)) map.set(s.value, s);
    });
    return Array.from(map.values());
  })();

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setQbQuestions(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (result) => {
        const rows = (result.data as any[]).filter((r) => r["questions"] || r["question_text"]);
        setCsvData(rows);
      },
    });
  };

  const handleEditCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (result) => {
        const rows = (result.data as any[]).filter((r) => r["questions"] || r["question_text"]);
        setEditCsvData(rows);
        // Auto-append CSV rows into the editable question list right away —
        // matches the "questions" shape already used by editQuestions.
        const mapped = rows.map((r: any) => ({
          question_text: r["question_text"] || r["questions"] || "",
          option_a: r["option_a"] || r["option1"] || "",
          option_b: r["option_b"] || r["option2"] || "",
          option_c: r["option_c"] || r["option3"] || "",
          option_d: r["option_d"] || r["option4"] || "",
          correct_option:
            r["correct_option"] ||
            (["A", "B", "C", "D", "E"][(Number(r["answer"]) || 1) - 1] ?? "A"),
          explanation: r["explanation"] || "",
        }));
        setEditQuestions((prev) => [...prev, ...mapped]);
        toast({ title: `${mapped.length}টি প্রশ্ন যোগ হয়েছে`, description: "নিচে আপডেট সেভ করুন" });
      },
    });
  };

  const handleQbSelect = (questions: QuestionData[], source?: { label: string; examIds: string[] }) => {
    // Merge into whatever's already picked from the Question Bank (subject may
    // be selected across multiple exams / individually-picked MCQs).
    setCsvData(null);
    setCsvFileName("");
    setQbQuestions((prev) => [...(prev || []), ...questions]);
    setQbSources((prev) => [
      ...prev,
      {
        id: `src_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: source?.label || `${questions.length}টি প্রশ্ন`,
        examIds: source?.examIds || [],
        questions,
      },
    ]);
    setIsQbOpen(false);
    toast({ title: `${questions.length}টি প্রশ্ন যোগ হয়েছে`, description: "নিচে সেভ করুন" });
  };

  const handleEditQbSelect = (questions: QuestionData[], source?: { label: string; examIds: string[] }) => {
    setEditQbSources((prev) => [
      ...prev,
      {
        id: `esrc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: source?.label || `${questions.length}টি প্রশ্ন`,
        examIds: source?.examIds || [],
        questions,
      },
    ]);
    const mapped = questions.map((q) => ({
      question_text: q.question,
      option_a: q.options?.A || "",
      option_b: q.options?.B || "",
      option_c: q.options?.C || "",
      option_d: q.options?.D || "",
      correct_option: q.correct_answer,
      explanation: q.explanation || "",
    }));
    setEditQuestions((prev) => [...prev, ...mapped]);
    setIsEditQbOpen(false);
    toast({ title: `${questions.length}টি প্রশ্ন যোগ হয়েছে`, description: "নিচে আপডেট সেভ করুন" });
  };

  const removeEditQbSource = (id: string) => {
    setEditQbSources((prev) => prev.filter((s) => s.id !== id));
    // Note: doesn't auto-remove already-merged questions from editQuestions —
    // admin can remove individual questions below with the per-question X.
  };

  const allEditAddedExamIds = editQbSources.flatMap((s) => s.examIds);

  const removeQbSource = (id: string) => {
    const src = qbSources.find((s) => s.id === id);
    if (!src) return;
    // Remove exactly this source's questions from the merged qbQuestions list.
    setQbQuestions((prev) => {
      if (!prev) return prev;
      const toRemove = new Set(src.questions);
      return prev.filter((q) => !toRemove.has(q));
    });
    setQbSources((prev) => prev.filter((s) => s.id !== id));
  };

  const allAddedExamIds = qbSources.flatMap((s) => s.examIds);

  const clearForm = () => {
    setSubject("");
    setChapter("");
    setTopic("");
    setStandard("medical");
    setCsvData(null);
    setCsvFileName("");
    setQbQuestions(null);
    setQbSources([]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const sourceRows = qbQuestions?.length
        ? qbQuestions.map((q) => ({
            question_text: q.question,
            option_a: q.options?.A || "",
            option_b: q.options?.B || "",
            option_c: q.options?.C || "",
            option_d: q.options?.D || "",
            correct_option: q.correct_answer,
            explanation: q.explanation || "",
          }))
        : csvData;

      if (!sourceRows?.length) throw new Error("CSV আপলোড করুন অথবা Question Bank থেকে প্রশ্ন সিলেক্ট করুন");
      if (!subject.trim() || !chapter.trim()) throw new Error("সাবজেক্ট ও চ্যাপ্টার দিন");

      const { error } = await supabase.from("mock_question_pool").insert({
        subject: subject.trim(),
        chapter: chapter.trim(),
        topic: topic.trim() || null,
        standard,
        question_count: sourceRows.length,
        questions_json: sourceRows,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "মক টেস্ট প্রশ্ন সেভ হয়েছে" });
      queryClient.invalidateQueries({ queryKey: ["admin-mock-pool"] });
      queryClient.invalidateQueries({ queryKey: ["global-metadata"] });
      clearForm();
    },
    onError: (e: any) => toast({ title: "সেভ ব্যর্থ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mock_question_pool").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "মুছে ফেলা হয়েছে" });
      queryClient.invalidateQueries({ queryKey: ["admin-mock-pool"] });
    },
    onError: (e: any) => toast({ title: "মুছতে ব্যর্থ", description: e.message, variant: "destructive" }),
  });

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setEditSubject(p.subject || "");
    setEditChapter(p.chapter || "");
    setEditTopic(p.topic || "");
    setEditStandard(p.standard || "medical");
    setEditQuestions(Array.isArray(p.questions_json) ? JSON.parse(JSON.stringify(p.questions_json)) : []);
    setEditCsvData(null);
    setEditCsvFileName("");
    setEditQbSources([]);
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditCsvData(null);
    setEditCsvFileName("");
    setEditQbSources([]);
  };

  const updateEditQuestion = (idx: number, field: string, value: string) => {
    setEditQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  };

  const removeEditQuestion = (idx: number) => {
    setEditQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const addEditQuestion = () => {
    setEditQuestions((prev) => [
      ...prev,
      { question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A", explanation: "" },
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      if (!editSubject.trim() || !editChapter.trim()) throw new Error("সাবজেক্ট ও চ্যাপ্টার দিন");
      if (!editQuestions.length) throw new Error("অন্তত ১টি প্রশ্ন থাকতে হবে");
      const { error } = await supabase
        .from("mock_question_pool")
        .update({
          subject: editSubject.trim(),
          chapter: editChapter.trim(),
          topic: editTopic.trim() || null,
          standard: editStandard,
          question_count: editQuestions.length,
          questions_json: editQuestions,
        })
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "আপডেট হয়েছে" });
      queryClient.invalidateQueries({ queryKey: ["admin-mock-pool"] });
      closeEdit();
    },
    onError: (e: any) => toast({ title: "আপডেট ব্যর্থ", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center shrink-0">
          <Target className="h-6 w-6 text-fuchsia-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">আনলিমিটেড মক টেস্ট — প্রশ্ন ব্যাংক</h1>
          <p className="text-sm text-muted-foreground">
            Subject/Chapter/Topic ভিত্তিক প্রশ্নের পুল আপলোড করুন — স্টুডেন্টরা এখান থেকে র‍্যান্ডম টেস্ট নিবে।
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">মক টেস্ট যোগ/এডিট</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>সাবজেক্ট</Label>
            <CreatableSelect
              options={globalMeta?.mock_subject || []}
              value={subject}
              onChange={(val) => {
                setSubject(val);
                setChapter("");
              }}
              onCreate={(val) => {
                addMeta.mutate({ type: "mock_subject", value: val });
                setSubject(val);
                setChapter("");
              }}
              onRename={(oldVal, newVal) => renameMeta.mutate({ type: "mock_subject", oldValue: oldVal, newValue: newVal })}
              onDelete={(val) => deleteMeta.mutate({ type: "mock_subject", value: val })}
              placeholder="সাবজেক্ট বাছাই বা তৈরি করুন"
            />
          </div>
          <div>
            <Label>চ্যাপ্টার</Label>
            <CreatableSelect
              options={globalMeta?.mock_chapter || []}
              value={chapter}
              onChange={setChapter}
              onCreate={(val) => {
                addMeta.mutate({ type: "mock_chapter", value: val });
                setChapter(val);
              }}
              onRename={(oldVal, newVal) => renameMeta.mutate({ type: "mock_chapter", oldValue: oldVal, newValue: newVal })}
              onDelete={(val) => deleteMeta.mutate({ type: "mock_chapter", value: val })}
              placeholder="চ্যাপ্টার বাছাই বা তৈরি করুন"
            />
          </div>
          <div>
            <Label>টপিক (ঐচ্ছিক)</Label>
            <CreatableSelect
              options={globalMeta?.mock_topic || []}
              value={topic}
              onChange={setTopic}
              onCreate={(val) => {
                addMeta.mutate({ type: "mock_topic", value: val });
                setTopic(val);
              }}
              onRename={(oldVal, newVal) => renameMeta.mutate({ type: "mock_topic", oldValue: oldVal, newValue: newVal })}
              onDelete={(val) => deleteMeta.mutate({ type: "mock_topic", value: val })}
              placeholder="টপিক বাছাই বা তৈরি করুন"
            />
          </div>
          <div>
            <Label className="mb-2 block">স্ট্যান্ডার্ড</Label>
            <CreatableSelect
              options={standardOptions}
              value={standard}
              onChange={setStandard}
              onCreate={(val) => {
                addMeta.mutate({ type: "mock_standard", value: val });
                setStandard(val);
              }}
              onRename={(oldVal, newVal) => {
                renameMeta.mutate({ type: "mock_standard", oldValue: oldVal, newValue: newVal });
                if (standard === oldVal) setStandard(newVal);
              }}
              onDelete={(val) => deleteMeta.mutate({ type: "mock_standard", value: val })}
              placeholder="স্ট্যান্ডার্ড বাছাই বা তৈরি করুন"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div
              className="border-2 border-dashed rounded-lg p-2 sm:p-4 text-center cursor-pointer hover:border-primary/50"
              onClick={() => document.getElementById("mockPoolCSV")?.click()}
            >
              <FileUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm">CSV আপলোড করুন</p>
              <input
                id="mockPoolCSV"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCSV}
              />
              {csvFileName && (
                <p className="text-xs text-primary mt-1">
                  {csvFileName} — {csvData?.length || 0} প্রশ্ন পাওয়া গেছে
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Header: questions, option1, option2, option3, option4, answer, explanation
              </p>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-2 sm:p-4 text-center cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center"
              onClick={() => setIsQbOpen(true)}
            >
              <BookOpen className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm">Question Bank থেকে সিলেক্ট করুন</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                রেডিমেড Exam থেকে পুরো এক্সাম বা আলাদা MCQ যোগ করুন
              </p>
            </div>
          </div>

          {qbSources.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">সিলেক্ট করা সোর্স ({qbQuestions?.length || 0}টি প্রশ্ন)</Label>
              {qbSources.map((src) => (
                <div
                  key={src.id}
                  className="flex items-center justify-between gap-2 border rounded-md px-2.5 py-1.5 bg-muted/30"
                >
                  <p className="text-xs truncate flex-1" title={src.label}>
                    {src.label} <span className="text-muted-foreground">— {src.questions.length}টি</span>
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewSourceId(src.id)}
                      className="text-muted-foreground hover:text-primary p-1"
                      title="MCQ দেখুন"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQbSource(src.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="সরিয়ে ফেলুন"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "সেভ হচ্ছে..." : "সেইভ"}
            </Button>
            <Button variant="outline" onClick={clearForm}>
              ক্লিয়ার
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">তালিকা</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && (!pools || pools.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-6">কোনো প্রশ্ন যোগ করা হয়নি।</p>
          )}
          <div className="space-y-2">
            {(pools || []).map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between border rounded-lg px-3 py-2"
              >
                <div className="text-sm">
                  <p className="font-semibold">
                    {p.subject} › {p.chapter}
                    {p.topic ? ` › ${p.topic}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {standardOptions.find((s) => s.value === p.standard)?.label || p.standard} ·{" "}
                    {p.question_count} প্রশ্ন
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="outline" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => deleteMutation.mutate(p.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingId} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-w-3xl h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-0 shrink-0">
            <DialogTitle>এন্ট্রি এডিট করুন</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <Label>সাবজেক্ট</Label>
              <CreatableSelect
                options={globalMeta?.mock_subject || []}
                value={editSubject}
                onChange={(val) => {
                  setEditSubject(val);
                }}
                onCreate={(val) => {
                  addMeta.mutate({ type: "mock_subject", value: val });
                  setEditSubject(val);
                }}
                onRename={(oldVal, newVal) => renameMeta.mutate({ type: "mock_subject", oldValue: oldVal, newValue: newVal })}
                onDelete={(val) => deleteMeta.mutate({ type: "mock_subject", value: val })}
                placeholder="সাবজেক্ট বাছাই বা তৈরি করুন"
              />
            </div>
            <div>
              <Label>চ্যাপ্টার</Label>
              <CreatableSelect
                options={globalMeta?.mock_chapter || []}
                value={editChapter}
                onChange={setEditChapter}
                onCreate={(val) => {
                  addMeta.mutate({ type: "mock_chapter", value: val });
                  setEditChapter(val);
                }}
                onRename={(oldVal, newVal) => renameMeta.mutate({ type: "mock_chapter", oldValue: oldVal, newValue: newVal })}
                onDelete={(val) => deleteMeta.mutate({ type: "mock_chapter", value: val })}
                placeholder="চ্যাপ্টার বাছাই বা তৈরি করুন"
              />
            </div>
            <div>
              <Label>টপিক (ঐচ্ছিক)</Label>
              <CreatableSelect
                options={globalMeta?.mock_topic || []}
                value={editTopic}
                onChange={setEditTopic}
                onCreate={(val) => {
                  addMeta.mutate({ type: "mock_topic", value: val });
                  setEditTopic(val);
                }}
                onRename={(oldVal, newVal) => renameMeta.mutate({ type: "mock_topic", oldValue: oldVal, newValue: newVal })}
                onDelete={(val) => deleteMeta.mutate({ type: "mock_topic", value: val })}
                placeholder="টপিক বাছাই বা তৈরি করুন"
              />
            </div>
            <div>
              <Label className="mb-2 block">স্ট্যান্ডার্ড</Label>
              <CreatableSelect
                options={standardOptions}
                value={editStandard}
                onChange={setEditStandard}
                onCreate={(val) => {
                  addMeta.mutate({ type: "mock_standard", value: val });
                  setEditStandard(val);
                }}
                onRename={(oldVal, newVal) => {
                  renameMeta.mutate({ type: "mock_standard", oldValue: oldVal, newValue: newVal });
                  if (editStandard === oldVal) setEditStandard(newVal);
                }}
                onDelete={(val) => deleteMeta.mutate({ type: "mock_standard", value: val })}
                placeholder="স্ট্যান্ডার্ড বাছাই বা তৈরি করুন"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div
                className="border-2 border-dashed rounded-lg p-2 sm:p-4 text-center cursor-pointer hover:border-primary/50"
                onClick={() => document.getElementById("editMockPoolCSV")?.click()}
              >
                <FileUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm">CSV আপলোড করুন</p>
                <input
                  id="editMockPoolCSV"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleEditCSV}
                />
                {editCsvFileName && (
                  <p className="text-xs text-primary mt-1">
                    {editCsvFileName} — {editCsvData?.length || 0} প্রশ্ন যোগ হয়েছে
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Header: questions, option1, option2, option3, option4, answer, explanation
                </p>
              </div>

              <div
                className="border-2 border-dashed rounded-lg p-2 sm:p-4 text-center cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center"
                onClick={() => setIsEditQbOpen(true)}
              >
                <BookOpen className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm">Question Bank থেকে সিলেক্ট করুন</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  রেডিমেড Exam থেকে পুরো এক্সাম বা আলাদা MCQ যোগ করুন
                </p>
              </div>
            </div>

            {editQbSources.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">সিলেক্ট করা সোর্স</Label>
                {editQbSources.map((src) => (
                  <div
                    key={src.id}
                    className="flex items-center justify-between gap-2 border rounded-md px-2.5 py-1.5 bg-muted/30"
                  >
                    <p className="text-xs truncate flex-1" title={src.label}>
                      {src.label} <span className="text-muted-foreground">— {src.questions.length}টি</span>
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditPreviewSourceId(src.id)}
                        className="text-muted-foreground hover:text-primary p-1"
                        title="MCQ দেখুন"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEditQbSource(src.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        title="সরিয়ে ফেলুন"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">প্রশ্নসমূহ ({editQuestions.length})</Label>
              <Button size="sm" variant="outline" onClick={addEditQuestion}>
                <Plus className="h-3.5 w-3.5 mr-1" /> নতুন প্রশ্ন
              </Button>
            </div>

            <div className="space-y-3">
              {editQuestions.map((q, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2 relative">
                  <button
                    type="button"
                    onClick={() => removeEditQuestion(idx)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="text-xs text-muted-foreground">প্রশ্ন #{idx + 1}</p>
                  <Textarea
                    value={q.question_text || ""}
                    onChange={(e) => updateEditQuestion(idx, "question_text", e.target.value)}
                    placeholder="প্রশ্ন"
                    className="min-h-[60px]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={q.option_a || ""}
                      onChange={(e) => updateEditQuestion(idx, "option_a", e.target.value)}
                      placeholder="অপশন A"
                    />
                    <Input
                      value={q.option_b || ""}
                      onChange={(e) => updateEditQuestion(idx, "option_b", e.target.value)}
                      placeholder="অপশন B"
                    />
                    <Input
                      value={q.option_c || ""}
                      onChange={(e) => updateEditQuestion(idx, "option_c", e.target.value)}
                      placeholder="অপশন C"
                    />
                    <Input
                      value={q.option_d || ""}
                      onChange={(e) => updateEditQuestion(idx, "option_d", e.target.value)}
                      placeholder="অপশন D"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">সঠিক উত্তর</Label>
                      <select
                        value={q.correct_option || "A"}
                        onChange={(e) => updateEditQuestion(idx, "correct_option", e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </div>
                  </div>
                  <Textarea
                    value={q.explanation || ""}
                    onChange={(e) => updateEditQuestion(idx, "explanation", e.target.value)}
                    placeholder="ব্যাখ্যা (ঐচ্ছিক)"
                    className="min-h-[50px]"
                  />
                </div>
              ))}
              {editQuestions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">কোনো প্রশ্ন নেই</p>
              )}
            </div>
          </div>
          <div className="p-4 border-t flex gap-2 shrink-0">
            <Button
              className="flex-1"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "আপডেট হচ্ছে..." : "আপডেট সেভ করুন"}
            </Button>
            <Button variant="outline" onClick={closeEdit}>
              বাতিল
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQbOpen} onOpenChange={setIsQbOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Question Bank থেকে প্রশ্ন সিলেক্ট করুন</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-4 pt-2 h-[calc(85vh-60px)]">
            <QuestionBankSelector onSelect={handleQbSelect} alreadyAddedExamIds={allAddedExamIds} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewSourceId} onOpenChange={(open) => !open && setPreviewSourceId(null)}>
        <DialogContent className="max-w-2xl h-[80vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-0 shrink-0">
            <DialogTitle>
              {qbSources.find((s) => s.id === previewSourceId)?.label || "প্রশ্নসমূহ"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(qbSources.find((s) => s.id === previewSourceId)?.questions || []).map((q, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-1.5 text-sm">
                <p className="font-medium">
                  <span className="text-muted-foreground mr-1">{i + 1}.</span>
                  {q.question}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {(["A", "B", "C", "D"] as const).map((k) => (
                    <div
                      key={k}
                      className={`p-1.5 rounded border ${
                        q.correct_answer === k
                          ? "bg-green-100/50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                          : "bg-muted/30"
                      }`}
                    >
                      <span className="font-semibold mr-1.5">{k}.</span>
                      {q.options?.[k]}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditQbOpen} onOpenChange={setIsEditQbOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Question Bank থেকে প্রশ্ন সিলেক্ট করুন</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-4 pt-2 h-[calc(85vh-60px)]">
            <QuestionBankSelector onSelect={handleEditQbSelect} alreadyAddedExamIds={allEditAddedExamIds} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPreviewSourceId} onOpenChange={(open) => !open && setEditPreviewSourceId(null)}>
        <DialogContent className="max-w-2xl h-[80vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-0 shrink-0">
            <DialogTitle>
              {editQbSources.find((s) => s.id === editPreviewSourceId)?.label || "প্রশ্নসমূহ"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(editQbSources.find((s) => s.id === editPreviewSourceId)?.questions || []).map((q, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-1.5 text-sm">
                <p className="font-medium">
                  <span className="text-muted-foreground mr-1">{i + 1}.</span>
                  {q.question}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {(["A", "B", "C", "D"] as const).map((k) => (
                    <div
                      key={k}
                      className={`p-1.5 rounded border ${
                        q.correct_answer === k
                          ? "bg-green-100/50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                          : "bg-muted/30"
                      }`}
                    >
                      <span className="font-semibold mr-1.5">{k}.</span>
                      {q.options?.[k]}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMockPool;
