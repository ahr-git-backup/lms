import { useState, useRef } from "react";
import Papa from "papaparse";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";
import type { QuestionData } from "@/types/exam";
import { Plus, Trash2, Upload } from "lucide-react";

type MtMode = string;

interface ModelTestMode {
  mode_key: string;
  label: string;
  sort_order: number;
}

// উদ্দীপক (context-based), চিত্র (image-based), and Roman-numeral (i./ii./iii.)
// questions must never be pulled into Model Test sources -- only plain MCQs.
const isSkippableQuestion = (text: string): boolean => {
  if (!text) return false;
  if (text.includes("উদ্দীপক") || text.includes("চিত্র")) return true;
  if (/<img[\s>]/i.test(text)) return true;
  // Roman-numeral sub-statement pattern: i. / ii. / iii. appearing as list items.
  if (/(^|[<>।\n])\s*i{1,3}\s*\./i.test(text) || /(^|[<>।\n])\s*iv\s*\./i.test(text)) return true;
  return false;
};

interface ModelTestSubjectRow {
  subject_key: string;
  name: string;
  target_count: number;
  configured_count: number;
  sort_order: number;
}

interface ModelTestSource {
  id: string;
  subject_key: string;
  mode: MtMode;
  source_type: "existing_bank" | "csv";
  label: string;
  question_count: number;
  filter_subject: string | null;
  filter_chapter: string | null;
  filter_topic: string | null;
}

/** Admin management screen for the standalone Model Test type: six fixed
 *  subjects (Biology 30, Chemistry 25, Physics 15, English 15, GK 10,
 *  মানবিক গুণাবলী 5 = 100), never editable. Two Medical modes -- Standard and
 *  Standard+Hard -- share the same fixed composition but draw from
 *  completely separate source pools per (subject, mode). Admin picks a mode
 *  tab, then per subject configures sources (existing bank filter or CSV);
 *  উদ্দীপক/চিত্র/Roman-numeral questions are filtered out automatically on
 *  import so only plain MCQs ever enter a Model Test pool. */
export const ModelTestManager = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<MtMode | null>(null);
  const [managingSubject, setManagingSubject] = useState<ModelTestSubjectRow | null>(null);
  const [addingMode, setAddingMode] = useState(false);
  const [newModeLabel, setNewModeLabel] = useState("");

  const { data: modes } = useQuery({
    queryKey: ["model-test-modes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("model_test_modes").select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      const rows = (data || []) as ModelTestMode[];
      if (!mode && rows.length > 0) setMode(rows[0].mode_key);
      return rows;
    },
    enabled: open,
  });

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["model-test-summary", mode],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_model_test_summary", { p_mode: mode });
      if (error) throw error;
      return (data || []) as ModelTestSubjectRow[];
    },
    enabled: open && !!mode,
  });

  const handleAddMode = async () => {
    if (!newModeLabel.trim()) return;
    const { error } = await supabase.rpc("add_model_test_mode", { p_key: newModeLabel, p_label: newModeLabel.trim() });
    if (error) {
      toast({ title: "মোড যোগ করা যায়নি", description: error.message, variant: "destructive" });
      return;
    }
    setNewModeLabel("");
    setAddingMode(false);
    queryClient.invalidateQueries({ queryKey: ["model-test-modes"] });
  };

  const handleDeleteMode = async (modeKey: string, label: string) => {
    if (!confirm(`"${label}" মোড মুছে ফেলবেন?`)) return;
    const { error } = await supabase.rpc("delete_model_test_mode", { p_mode_key: modeKey });
    if (error) {
      toast({ title: "মোড মুছা যায়নি", description: error.message, variant: "destructive" });
      return;
    }
    if (mode === modeKey) setMode(null);
    queryClient.invalidateQueries({ queryKey: ["model-test-modes"] });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Model Test (Medical) ম্যানেজ করুন</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            ফিক্সড ৬টি সাবজেক্ট, মোট ১০০ MCQ। প্রতিটি মোডের নিজস্ব আলাদা সোর্স।
          </p>

          <div className="flex flex-wrap gap-2">
            {modes?.map((m) => (
              <div key={m.mode_key} className="flex items-center gap-0.5">
                <Button
                  size="sm"
                  variant={mode === m.mode_key ? "default" : "outline"}
                  onClick={() => setMode(m.mode_key)}
                >
                  {m.label}
                </Button>
                {(modes?.length || 0) > 1 && (
                  <Button size="sm" variant="ghost" className="text-destructive px-1.5" onClick={() => handleDeleteMode(m.mode_key, m.label)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {addingMode ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  className="h-8 rounded-md border px-2 text-sm w-32 bg-background"
                  placeholder="মোডের নাম"
                  value={newModeLabel}
                  onChange={(e) => setNewModeLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddMode(); if (e.key === "Escape") setAddingMode(false); }}
                />
                <Button size="sm" onClick={handleAddMode}>যোগ করুন</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAddingMode(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> নতুন মোড
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {subjects?.map((s) => (
              <Card
                key={s.subject_key}
                className="cursor-pointer hover:border-primary/40"
                onClick={() => setManagingSubject(s)}
              >
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{s.name}</p>
                  <Badge variant={s.configured_count >= s.target_count ? "default" : "outline"} className="text-[10px]">
                    {s.configured_count}/{s.target_count}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {managingSubject && mode && (
        <ModelTestSourcesDialog
          subject={managingSubject}
          mode={mode}
          modeLabel={modes?.find((m) => m.mode_key === mode)?.label || mode}
          onClose={() => {
            setManagingSubject(null);
            queryClient.invalidateQueries({ queryKey: ["model-test-summary", mode] });
          }}
        />
      )}
    </>
  );
};

/** Per (subject, mode) source list: add an existing-bank filter or upload a
 *  CSV, each with a raw question_count. Shows running total against the
 *  subject's fixed target (informational -- the RPC caps to target
 *  regardless, so over-configuring is safe, just wasted admin effort).
 *  Both the QuestionBankSelector pick and the CSV parse drop any
 *  উদ্দীপক/চিত্র/Roman-numeral question before it's stored. */
const ModelTestSourcesDialog = ({
  subject, mode, modeLabel, onClose,
}: {
  subject: ModelTestSubjectRow;
  mode: MtMode;
  modeLabel: string;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showQbSelector, setShowQbSelector] = useState(false);
  const [qbSaving, setQbSaving] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);

  const { data: sources, isLoading } = useQuery({
    queryKey: ["model-test-sources", subject.subject_key, mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("model_test_sources")
        .select("*")
        .eq("subject_key", subject.subject_key)
        .eq("mode", mode)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as ModelTestSource[];
    },
  });

  const total = (sources || []).reduce((sum, s) => sum + s.question_count, 0);

  const refetchSources = () => queryClient.invalidateQueries({ queryKey: ["model-test-sources", subject.subject_key, mode] });

  const handleQbSelect = async (questions: QuestionData[]) => {
    const filtered = questions.filter((q) => !isSkippableQuestion(q.question || ""));
    const skippedCount = questions.length - filtered.length;
    if (filtered.length === 0) {
      toast({ title: "কোনো উপযুক্ত প্রশ্ন নেই", description: "উদ্দীপক/চিত্র/রোমান সংখ্যা প্রশ্ন বাদ দেওয়ার পর কিছু অবশিষ্ট নেই।", variant: "destructive" });
      return;
    }
    const uniqueSubjects = Array.from(new Set(filtered.map((q) => q.subject).filter(Boolean))) as string[];
    const autoLabel = uniqueSubjects.length > 0
      ? uniqueSubjects.slice(0, 2).join(", ") + (uniqueSubjects.length > 2 ? ` +${uniqueSubjects.length - 2}` : "")
      : "Existing Bank";
    setQbSaving(true);
    try {
      const { data: sourceRow, error: sourceError } = await supabase
        .from("model_test_sources")
        .insert({
          subject_key: subject.subject_key,
          mode,
          source_type: "csv",
          label: autoLabel,
          question_count: filtered.length,
        })
        .select()
        .single();
      if (sourceError) throw sourceError;

      const rows = filtered.map((q) => ({
        source_id: sourceRow.id,
        question_text: q.question,
        option_a: q.options?.A || "",
        option_b: q.options?.B || "",
        option_c: q.options?.C || "",
        option_d: q.options?.D || "",
        option_e: q.options?.E || null,
        correct_option: q.correct_answer,
        explanation: q.explanation || null,
      }));
      const { error: qError } = await supabase.from("model_test_source_questions").insert(rows);
      if (qError) throw qError;

      toast({
        title: "যোগ হয়েছে",
        description: `${filtered.length}টি প্রশ্ন যোগ হয়েছে।${skippedCount > 0 ? ` (${skippedCount}টি উদ্দীপক/চিত্র/রোমান সংখ্যা প্রশ্ন বাদ দেওয়া হয়েছে)` : ""}`,
      });
      setShowQbSelector(false);
      refetchSources();
    } catch (err: any) {
      toast({ title: "যোগ করা যায়নি", description: err?.message || "আবার চেষ্টা করুন।", variant: "destructive" });
    } finally {
      setQbSaving(false);
    }
  };

  const parseCsv = (csv: string) => {
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = [];
    let skipped = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (parsed.data as any[]).forEach((row) => {
      const qText = row["questions"] || row["question"];
      if (!qText) return;
      if (isSkippableQuestion(String(qText))) { skipped++; return; }
      const o1 = row["option1"], o2 = row["option2"], o3 = row["option3"], o4 = row["option4"], o5 = row["option5"];
      const answer = row["answer"];
      const ansIdx = Number(answer);
      const correct = ansIdx >= 1 && ansIdx <= 5 ? ["A", "B", "C", "D", "E"][ansIdx - 1] : "A";
      rows.push({
        question_text: qText,
        option_a: o1 || "",
        option_b: o2 || "",
        option_c: o3 || "",
        option_d: o4 || "",
        option_e: o5 || null,
        correct_option: correct,
        explanation: row["explanation"] || null,
      });
    });
    return { rows, skipped };
  };

  const handleAddCsv = async (file: File) => {
    setCsvUploading(true);
    try {
      const text = await file.text();
      const { rows, skipped } = parseCsv(text);
      if (rows.length === 0) {
        toast({ title: "CSV-তে কোনো উপযুক্ত প্রশ্ন পাওয়া যায়নি", variant: "destructive" });
        setCsvUploading(false);
        return;
      }
      const autoLabel = file.name.replace(/\.csv$/i, "");
      const { data: sourceRow, error: sourceError } = await supabase
        .from("model_test_sources")
        .insert({
          subject_key: subject.subject_key,
          mode,
          source_type: "csv",
          label: autoLabel,
          question_count: rows.length,
        })
        .select()
        .single();
      if (sourceError) throw sourceError;

      const { error: qError } = await supabase
        .from("model_test_source_questions")
        .insert(rows.map((r) => ({ ...r, source_id: sourceRow.id })));
      if (qError) throw qError;

      toast({
        title: "CSV আপলোড হয়েছে",
        description: `${rows.length}টি প্রশ্ন যোগ হয়েছে।${skipped > 0 ? ` (${skipped}টি উদ্দীপক/চিত্র/রোমান সংখ্যা প্রশ্ন বাদ দেওয়া হয়েছে)` : ""}`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      refetchSources();
    } catch (err: any) {
      toast({ title: "আপলোড ব্যর্থ", description: err?.message || "আবার চেষ্টা করুন।", variant: "destructive" });
    } finally {
      setCsvUploading(false);
    }
  };

  const handleDeleteSource = async (source: ModelTestSource) => {
    if (!confirm(`"${source.label}" source মুছে ফেলবেন?`)) return;
    const { error } = await supabase.from("model_test_sources").delete().eq("id", source.id);
    if (error) {
      toast({ title: "মুছা যায়নি", description: error.message, variant: "destructive" });
      return;
    }
    refetchSources();
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{subject.name} — {modeLabel} — সোর্স ম্যানেজ করুন</DialogTitle>
          </DialogHeader>

          <div className={`text-sm font-medium px-3 py-2 rounded-lg ${total >= subject.target_count ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
            মোট: {total} / {subject.target_count} MCQ কনফিগার করা আছে
            {total < subject.target_count && ` — আরও ${subject.target_count - total}টি দরকার`}
          </div>

          <div className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {sources?.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.source_type === "csv" ? "CSV আপলোড" : `Existing Bank${s.filter_subject ? ` · ${s.filter_subject}` : ""}`}
                      {" · "}{s.question_count} MCQ
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => handleDeleteSource(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowQbSelector(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Existing Bank
            </Button>
            <Button variant="outline" size="sm" disabled={csvUploading} onClick={() => fileInputRef.current?.click()}>
              {csvUploading ? "আপলোড হচ্ছে..." : <><Upload className="h-3.5 w-3.5 mr-1" /> CSV আপলোড</>}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAddCsv(file);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showQbSelector} onOpenChange={setShowQbSelector}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>প্রশ্ন বাছাই করুন — Existing Bank</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-0.5 sm:p-4 pt-2 h-[calc(85vh-60px)] relative">
            {qbSaving && (
              <div className="absolute inset-0 z-10 bg-background/80 flex items-center justify-center text-sm">
                সংরক্ষণ হচ্ছে...
              </div>
            )}
            <QuestionBankSelector onSelect={handleQbSelect} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
