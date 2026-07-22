import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Trash2, UploadCloud, Zap, Loader2, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CsvRow {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

function parseCsv(text: string): string[][] {
  // simple CSV parser handling quoted commas
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cur.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (field.length || cur.length) {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      }
    } else {
      field += c;
    }
  }
  if (field.length || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseCsvToMcqs(text: string): CsvRow[] {
  const lines = parseCsv(text.replace(/\t/g, ","));
  if (lines.length < 2) return [];
  const header = lines[0].map((h) => h.replace(/^\uFEFF/, "").trim().toLowerCase());
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const qIdx = idx(["question", "questions"]);
  const o1 = idx(["option1", "option 1"]);
  const o2 = idx(["option2", "option 2"]);
  const o3 = idx(["option3", "option 3"]);
  const o4 = idx(["option4", "option 4"]);
  const o5 = idx(["option5", "option 5"]);
  const aIdx = idx(["answer", "answers"]);
  const eIdx = idx(["explanation", "explanations"]);

  const data: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i];
    if (cols.length < 6) continue;
    const opts = [cols[o1], cols[o2], cols[o3], cols[o4], o5 >= 0 ? cols[o5] : null].filter(
      (o): o is string => !!o && o.trim() !== ""
    );
    const answerNum = parseInt(cols[aIdx], 10) || 1;
    data.push({
      question: cols[qIdx] || "",
      options: opts,
      correct_index: answerNum - 1,
      explanation: eIdx >= 0 ? cols[eIdx] || "" : "",
    });
  }
  return data;
}

const AdminQuickPractice = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [subjectName, setSubjectName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [csvData, setCsvData] = useState<CsvRow[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);

  // Manual single-MCQ add form (compact)
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualOptions, setManualOptions] = useState(["", "", "", ""]);
  const [manualCorrect, setManualCorrect] = useState(0);
  const [manualExplanation, setManualExplanation] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  // Inline edit state for an existing MCQ
  const [editingMcqId, setEditingMcqId] = useState<number | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrect, setEditCorrect] = useState(0);
  const [editExplanation, setEditExplanation] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    document.title = "Quick Practice — Admin";
  }, []);

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["admin-qp-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qp_subjects")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: chaptersOfSubject } = useQuery({
    queryKey: ["admin-qp-chapters", expandedSubject],
    enabled: expandedSubject !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qp_chapters")
        .select("id, name, subject_id")
        .eq("subject_id", expandedSubject!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const withCounts = await Promise.all(
        (data || []).map(async (ch) => {
          const { count } = await supabase
            .from("qp_mcqs")
            .select("id", { count: "exact", head: true })
            .eq("chapter_id", ch.id);
          return { ...ch, mcqCount: count || 0 };
        })
      );
      return withCounts;
    },
  });

  const { data: mcqsOfChapter } = useQuery({
    queryKey: ["admin-qp-mcqs", expandedChapter],
    enabled: expandedChapter !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qp_mcqs")
        .select("id, question, options, correct_index, explanation")
        .eq("chapter_id", expandedChapter!)
        .order("id", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const handleFile = (file: File) => {
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      const parsed = parseCsvToMcqs(text);
      if (!parsed.length) {
        toast({ title: "CSV-এ কোনো ডাটা পাওয়া যায়নি", variant: "destructive" });
        return;
      }
      setCsvData(parsed);
      toast({ title: `${parsed.length}টি প্রশ্ন লোড হয়েছে` });
    };
    reader.readAsText(file);
  };

  const clearForm = () => {
    setSubjectName("");
    setChapterName("");
    setCsvData(null);
    setCsvFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const findOrCreateSubject = async (name: string): Promise<number> => {
    const { data: existingSubj } = await supabase
      .from("qp_subjects")
      .select("id")
      .eq("name", name.trim())
      .maybeSingle();
    if (existingSubj) return existingSubj.id;
    const { data: lastSubj } = await supabase
      .from("qp_subjects")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort = (lastSubj?.sort_order || 0) + 1;
    const { data: newSubj, error } = await supabase
      .from("qp_subjects")
      .insert({ name: name.trim(), sort_order: sort })
      .select("id")
      .single();
    if (error) throw error;
    return newSubj.id;
  };

  const findOrCreateChapter = async (subjId: number, name: string): Promise<number> => {
    const { data: existingChap } = await supabase
      .from("qp_chapters")
      .select("id")
      .eq("subject_id", subjId)
      .eq("name", name.trim())
      .maybeSingle();
    if (existingChap) return existingChap.id;
    const { data: lastChap } = await supabase
      .from("qp_chapters")
      .select("sort_order")
      .eq("subject_id", subjId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortC = (lastChap?.sort_order || 0) + 1;
    const { data: newChap, error } = await supabase
      .from("qp_chapters")
      .insert({ subject_id: subjId, name: name.trim(), sort_order: sortC })
      .select("id")
      .single();
    if (error) throw error;
    return newChap.id;
  };

  const saveAll = async () => {
    if (!subjectName.trim() || !chapterName.trim()) {
      toast({ title: "বিষয় ও অধ্যায়ের নাম দিন", variant: "destructive" });
      return;
    }
    if (!csvData?.length) {
      toast({ title: "CSV আপলোড করুন", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const subjId = await findOrCreateSubject(subjectName);
      const chapId = await findOrCreateChapter(subjId, chapterName);

      const rows = csvData.map((d) => ({
        chapter_id: chapId,
        question: d.question,
        options: d.options,
        correct_index: d.correct_index,
        explanation: d.explanation || null,
      }));
      const { error: insertErr } = await supabase.from("qp_mcqs").insert(rows);
      if (insertErr) throw insertErr;

      toast({ title: `${rows.length}টি MCQ সেভ হয়েছে` });
      clearForm();
      queryClient.invalidateQueries({ queryKey: ["admin-qp-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-qp-chapters"] });
    } catch (e: any) {
      toast({ title: "এরর হয়েছে", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const clearManualForm = () => {
    setManualQuestion("");
    setManualOptions(["", "", "", ""]);
    setManualCorrect(0);
    setManualExplanation("");
  };

  const saveManualMcq = async () => {
    if (!subjectName.trim() || !chapterName.trim()) {
      toast({ title: "বিষয় ও অধ্যায়ের নাম দিন", variant: "destructive" });
      return;
    }
    const filledOptions = manualOptions.map((o) => o.trim()).filter(Boolean);
    if (!manualQuestion.trim() || filledOptions.length < 2) {
      toast({ title: "প্রশ্ন ও অন্তত ২টি অপশন দিন", variant: "destructive" });
      return;
    }
    if (manualCorrect >= filledOptions.length) {
      toast({ title: "সঠিক অপশন বেছে নিন", variant: "destructive" });
      return;
    }
    setSavingManual(true);
    try {
      const subjId = await findOrCreateSubject(subjectName);
      const chapId = await findOrCreateChapter(subjId, chapterName);
      const { error } = await supabase.from("qp_mcqs").insert({
        chapter_id: chapId,
        question: manualQuestion.trim(),
        options: filledOptions,
        correct_index: manualCorrect,
        explanation: manualExplanation.trim() || null,
      });
      if (error) throw error;
      toast({ title: "MCQ যোগ হয়েছে" });
      clearManualForm();
      queryClient.invalidateQueries({ queryKey: ["admin-qp-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-qp-chapters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-qp-mcqs"] });
    } catch (e: any) {
      toast({ title: "এরর হয়েছে", description: e.message, variant: "destructive" });
    } finally {
      setSavingManual(false);
    }
  };

  const startEditMcq = (m: { id: number; question: string; options: string[]; correct_index: number; explanation?: string | null }) => {
    setEditingMcqId(m.id);
    setEditQuestion(m.question);
    const opts = [...m.options];
    while (opts.length < 4) opts.push("");
    setEditOptions(opts);
    setEditCorrect(m.correct_index);
    setEditExplanation(m.explanation || "");
  };

  const cancelEditMcq = () => {
    setEditingMcqId(null);
    setEditQuestion("");
    setEditOptions([]);
    setEditCorrect(0);
    setEditExplanation("");
  };

  const saveEditMcq = async () => {
    if (editingMcqId === null) return;
    const filledOptions = editOptions.map((o) => o.trim()).filter(Boolean);
    if (!editQuestion.trim() || filledOptions.length < 2) {
      toast({ title: "প্রশ্ন ও অন্তত ২টি অপশন দিন", variant: "destructive" });
      return;
    }
    if (editCorrect >= filledOptions.length) {
      toast({ title: "সঠিক অপশন বেছে নিন", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("qp_mcqs")
        .update({
          question: editQuestion.trim(),
          options: filledOptions,
          correct_index: editCorrect,
          explanation: editExplanation.trim() || null,
        })
        .eq("id", editingMcqId);
      if (error) throw error;
      toast({ title: "MCQ আপডেট হয়েছে" });
      cancelEditMcq();
      queryClient.invalidateQueries({ queryKey: ["admin-qp-mcqs"] });
    } catch (e: any) {
      toast({ title: "এরর হয়েছে", description: e.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteChapter = async (chapId: number) => {
    if (!confirm("এই অধ্যায় ও এর সব MCQ ডিলিট হবে। নিশ্চিত?")) return;
    const { error } = await supabase.from("qp_chapters").delete().eq("id", chapId);
    if (error) {
      toast({ title: "ডিলিট ব্যর্থ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "অধ্যায় ডিলিট হয়েছে" });
    queryClient.invalidateQueries({ queryKey: ["admin-qp-chapters"] });
  };

  const deleteSubject = async (subjId: number) => {
    if (!confirm("এই বিষয়, সব অধ্যায় ও MCQ ডিলিট হবে। নিশ্চিত?")) return;
    const { error } = await supabase.from("qp_subjects").delete().eq("id", subjId);
    if (error) {
      toast({ title: "ডিলিট ব্যর্থ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "বিষয় ডিলিট হয়েছে" });
    queryClient.invalidateQueries({ queryKey: ["admin-qp-subjects"] });
  };

  const deleteMcq = async (mcqId: number) => {
    const { error } = await supabase.from("qp_mcqs").delete().eq("id", mcqId);
    if (error) {
      toast({ title: "ডিলিট ব্যর্থ", variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin-qp-mcqs"] });
    queryClient.invalidateQueries({ queryKey: ["admin-qp-chapters"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-5 w-5 text-violet-500" /> Quick Practice ম্যানেজার
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          বিষয়, অধ্যায় ও CSV থেকে MCQ যোগ করুন — একবারে।
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">নতুন MCQ যোগ করুন</CardTitle>
          <CardDescription>
            CSV কলাম: question, option1, option2, option3, option4, option5 (ঐচ্ছিক), answer (১-৫), explanation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              placeholder="বিষয়ের নাম (যেমন: পদার্থবিজ্ঞান)"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              list="qp-subject-list"
            />
            <datalist id="qp-subject-list">
              {subjects?.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            <Input
              placeholder="অধ্যায়ের নাম (যেমন: ভেক্টর)"
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 border-2 border-dashed rounded-xl px-4 py-6 cursor-pointer hover:border-primary/50 transition-colors justify-center text-sm text-muted-foreground">
              <UploadCloud className="h-4 w-4" />
              {csvFileName || "CSV ফাইল আপলোড করুন"}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            {csvData && (
              <p className="text-xs text-emerald-600 font-semibold mt-1.5">
                ✓ {csvData.length}টি প্রশ্ন প্রস্তুত
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={saveAll} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              সেভ করুন
            </Button>
            <Button variant="outline" onClick={clearForm} disabled={saving}>
              ক্লিয়ার
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">একটি MCQ নিজে টাইপ করে যোগ করুন</CardTitle>
          <CardDescription className="text-xs">
            উপরের বিষয়/অধ্যায়ের নাম ব্যবহার হবে — আগে সেটা পূরণ করুন।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="প্রশ্ন লিখুন"
            value={manualQuestion}
            onChange={(e) => setManualQuestion(e.target.value)}
            className="text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            {manualOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setManualCorrect(i)}
                  className={cn(
                    "h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
                    manualCorrect === i
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-border text-muted-foreground"
                  )}
                  title="সঠিক উত্তর হিসেবে বেছে নিন"
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <Input
                  placeholder={`অপশন ${i + 1}`}
                  value={opt}
                  onChange={(e) =>
                    setManualOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))
                  }
                  className="text-sm h-8"
                />
              </div>
            ))}
          </div>
          <Input
            placeholder="ব্যাখ্যা (ঐচ্ছিক)"
            value={manualExplanation}
            onChange={(e) => setManualExplanation(e.target.value)}
            className="text-sm"
          />
          <Button onClick={saveManualMcq} disabled={savingManual} size="sm" className="w-full">
            {savingManual ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
            MCQ যোগ করুন
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            বিষয় ও অধ্যায় সমূহ {subjects ? `(${subjects.length}টি)` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>}
          {!isLoading && (!subjects || subjects.length === 0) && (
            <p className="text-sm text-muted-foreground">কোনো বিষয় নেই। উপরে যোগ করুন।</p>
          )}
          {subjects?.map((s) => {
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
                    {chaptersOfSubject?.map((ch) => {
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
                              <span className="text-muted-foreground">({ch.mcqCount} MCQ)</span>
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
                            <div className="border-t p-2 space-y-1.5 max-h-80 overflow-y-auto">
                              {mcqsOfChapter?.map((m) => {
                                const isEditing = editingMcqId === m.id;
                                if (isEditing) {
                                  return (
                                    <div key={m.id} className="bg-card border rounded-md p-2 space-y-1.5">
                                      <Input
                                        value={editQuestion}
                                        onChange={(e) => setEditQuestion(e.target.value)}
                                        className="text-xs h-7"
                                        placeholder="প্রশ্ন"
                                      />
                                      <div className="grid grid-cols-2 gap-1.5">
                                        {editOptions.map((opt, i) => (
                                          <div key={i} className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => setEditCorrect(i)}
                                              className={cn(
                                                "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center text-[9px] font-bold",
                                                editCorrect === i
                                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                                  : "border-border text-muted-foreground"
                                              )}
                                            >
                                              {String.fromCharCode(65 + i)}
                                            </button>
                                            <Input
                                              value={opt}
                                              onChange={(e) =>
                                                setEditOptions((prev) =>
                                                  prev.map((o, idx) => (idx === i ? e.target.value : o))
                                                )
                                              }
                                              className="text-[11px] h-7"
                                              placeholder={`অপশন ${i + 1}`}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                      <Input
                                        value={editExplanation}
                                        onChange={(e) => setEditExplanation(e.target.value)}
                                        className="text-xs h-7"
                                        placeholder="ব্যাখ্যা (ঐচ্ছিক)"
                                      />
                                      <div className="flex gap-1.5">
                                        <Button
                                          size="sm"
                                          className="h-7 flex-1 text-[11px]"
                                          onClick={saveEditMcq}
                                          disabled={savingEdit}
                                        >
                                          {savingEdit ? (
                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          ) : (
                                            <Check className="h-3 w-3 mr-1" />
                                          )}
                                          সেভ
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-[11px]"
                                          onClick={cancelEditMcq}
                                          disabled={savingEdit}
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          বাতিল
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div
                                    key={m.id}
                                    className="flex items-start gap-2 text-[11px] bg-muted/30 rounded-md p-2"
                                  >
                                    <span className="flex-1">{m.question}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-muted-foreground flex-shrink-0"
                                      onClick={() => startEditMcq(m)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-destructive flex-shrink-0"
                                      onClick={() => deleteMcq(m.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                              {mcqsOfChapter?.length === 0 && (
                                <p className="text-[11px] text-muted-foreground text-center py-2">
                                  কোনো MCQ নেই
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

export default AdminQuickPractice;
