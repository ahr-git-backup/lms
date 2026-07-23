import { useState } from "react";
import Papa from "papaparse";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, Trash2, FileUp, BookOpen, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";
import type { QuestionData } from "@/components/admin/QuestionEditor";

const STANDARDS = [
  { value: "medical", label: "Medical" },
  { value: "varsity", label: "Varsity" },
  { value: "onushiloni", label: "Onushiloni" },
];

const AdminMockPool = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState("");
  const [paper, setPaper] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [standard, setStandard] = useState("medical");
  const [csvData, setCsvData] = useState<any[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [qbQuestions, setQbQuestions] = useState<QuestionData[] | null>(null);
  const [isQbOpen, setIsQbOpen] = useState(false);

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

  // Reusable Subject/Chapter master lists — once added, they stay available
  // as datalist options for future adds (mirrors Quick Practice admin pattern).
  const { data: mockSubjects } = useQuery({
    queryKey: ["mock-subjects-master"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_subjects")
        .select("id, name")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: mockChapters } = useQuery({
    queryKey: ["mock-chapters-master", subject],
    enabled: !!subject.trim(),
    queryFn: async () => {
      const subj = mockSubjects?.find((s) => s.name === subject.trim());
      if (!subj) return [];
      const { data, error } = await supabase
        .from("mock_chapters")
        .select("id, name")
        .eq("subject_id", subj.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const findOrCreateSubject = async (name: string): Promise<number> => {
    const { data: existing } = await supabase
      .from("mock_subjects")
      .select("id")
      .eq("name", name.trim())
      .maybeSingle();
    if (existing) return existing.id;
    const { data: last } = await supabase
      .from("mock_subjects")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort = (last?.sort_order || 0) + 1;
    const { data: created, error } = await supabase
      .from("mock_subjects")
      .insert({ name: name.trim(), sort_order: sort })
      .select("id")
      .single();
    if (error) throw error;
    return created.id;
  };

  const findOrCreateChapter = async (subjectId: number, name: string): Promise<void> => {
    const { data: existing } = await supabase
      .from("mock_chapters")
      .select("id")
      .eq("subject_id", subjectId)
      .eq("name", name.trim())
      .maybeSingle();
    if (existing) return;
    const { data: last } = await supabase
      .from("mock_chapters")
      .select("sort_order")
      .eq("subject_id", subjectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort = (last?.sort_order || 0) + 1;
    const { error } = await supabase
      .from("mock_chapters")
      .insert({ subject_id: subjectId, name: name.trim(), sort_order: sort });
    if (error) throw error;
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setQbQuestions(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = (result.data as any[]).filter((r) => r["questions"] || r["question_text"]);
        setCsvData(rows);
      },
    });
  };

  const handleQbSelect = (questions: QuestionData[]) => {
    // Merge into whatever's already picked from the Question Bank (subject may
    // be selected across multiple exams / individually-picked MCQs).
    setCsvData(null);
    setCsvFileName("");
    setQbQuestions((prev) => [...(prev || []), ...questions]);
    setIsQbOpen(false);
    toast({ title: `${questions.length}টি প্রশ্ন যোগ হয়েছে`, description: "নিচে সেভ করুন" });
  };

  const clearForm = () => {
    setSubject("");
    setPaper("");
    setChapter("");
    setTopic("");
    setStandard("medical");
    setCsvData(null);
    setCsvFileName("");
    setQbQuestions(null);
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

      const subjectId = await findOrCreateSubject(subject);
      await findOrCreateChapter(subjectId, chapter);

      const { error } = await supabase.from("mock_question_pool").insert({
        subject: subject.trim(),
        paper: paper.trim() || null,
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
      queryClient.invalidateQueries({ queryKey: ["mock-subjects-master"] });
      queryClient.invalidateQueries({ queryKey: ["mock-chapters-master"] });
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>সাবজেক্ট</Label>
              <Input
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setChapter("");
                }}
                placeholder="সাবজেক্ট"
                list="mock-subject-list"
              />
              <datalist id="mock-subject-list">
                {mockSubjects?.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>পেপার (ঐচ্ছিক)</Label>
              <Input value={paper} onChange={(e) => setPaper(e.target.value)} placeholder="পেপার" />
            </div>
          </div>
          <div>
            <Label>চ্যাপ্টার</Label>
            <Input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="চ্যাপ্টার"
              list="mock-chapter-list"
            />
            <datalist id="mock-chapter-list">
              {mockChapters?.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>টপিক (ঐচ্ছিক)</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="টপিক" />
          </div>
          <div>
            <Label className="mb-2 block">স্ট্যান্ডার্ড</Label>
            <div className="flex gap-2 flex-wrap">
              {STANDARDS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStandard(s.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    standard === s.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50"
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
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center"
              onClick={() => setIsQbOpen(true)}
            >
              <BookOpen className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm">Question Bank থেকে সিলেক্ট করুন</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                রেডিমেড Exam থেকে পুরো এক্সাম বা আলাদা MCQ যোগ করুন
              </p>
              {!!qbQuestions?.length && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-xs text-primary">{qbQuestions.length}টি প্রশ্ন সিলেক্ট করা হয়েছে</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQbQuestions(null);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

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
                    {p.subject}
                    {p.paper ? ` (${p.paper})` : ""} › {p.chapter}
                    {p.topic ? ` › ${p.topic}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {STANDARDS.find((s) => s.value === p.standard)?.label || p.standard} ·{" "}
                    {p.question_count} প্রশ্ন
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => deleteMutation.mutate(p.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isQbOpen} onOpenChange={setIsQbOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Question Bank থেকে প্রশ্ন সিলেক্ট করুন</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-4 pt-2 h-[calc(85vh-60px)]">
            <QuestionBankSelector onSelect={handleQbSelect} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMockPool;
