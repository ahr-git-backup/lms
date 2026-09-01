import { useState, useRef } from "react";
import Papa from "papaparse";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";
import type { QuestionData } from "@/types/exam";
import { Plus, Trash2, Upload, X } from "lucide-react";

type SpCategory = "subject_final" | "paper_final";
type SpMode = "medical_standard" | "standard_hard";

const MODE_LABELS: Record<SpMode, string> = {
  medical_standard: "Medical Standard",
  standard_hard: "Standard+Hard",
};
const MODES: SpMode[] = ["medical_standard", "standard_hard"];
const TOTAL_TARGET = 100;

interface SpItem {
  id: string;
  name: string;
  sort_order: number;
  medical_standard_configured: number;
  standard_hard_configured: number;
}

interface SpSource {
  id: string;
  item_id: string;
  mode: SpMode;
  source_type: "existing_bank" | "csv";
  label: string;
  question_count: number;
  filter_subject: string | null;
  filter_chapter: string | null;
  filter_topic: string | null;
  sort_order: number;
}

/** Admin management screen for the Subject Final / Paper Final exam type:
 *  add A-Z items under each category, then per item x mode configure the
 *  sources (existing question bank filter, or an uploaded CSV pool) that
 *  a student's random 100-question attempt in that mode will draw from. */
export const SpFinalManager = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<SpCategory>("subject_final");
  const [newItemName, setNewItemName] = useState("");
  const [managingItem, setManagingItem] = useState<SpItem | null>(null);
  const [managingMode, setManagingMode] = useState<SpMode>("medical_standard");

  const { data: items, isLoading } = useQuery({
    queryKey: ["sp-final-items", category],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sp_final_items", { p_category: category });
      if (error) throw error;
      return (data || []) as SpItem[];
    },
    enabled: open,
  });

  const handleAddItem = async () => {
    const name = newItemName.trim();
    if (!name) return;
    const { error } = await supabase.from("sp_final_items").insert({ category, name });
    if (error) {
      toast({ title: "যোগ করা যায়নি", description: error.message, variant: "destructive" });
      return;
    }
    setNewItemName("");
    queryClient.invalidateQueries({ queryKey: ["sp-final-items", category] });
  };

  const handleDeleteItem = async (item: SpItem) => {
    if (!confirm(`"${item.name}" মুছে ফেলবেন? এর সব source/CSV প্রশ্নও মুছে যাবে।`)) return;
    const { error } = await supabase.from("sp_final_items").delete().eq("id", item.id);
    if (error) {
      toast({ title: "মুছা যায়নি", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["sp-final-items", category] });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subject / Paper Final ম্যানেজ করুন</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={category === "subject_final" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setCategory("subject_final")}
            >
              Subject Final
            </Button>
            <Button
              size="sm"
              variant={category === "paper_final" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setCategory("paper_final")}
            >
              Paper Final
            </Button>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder={category === "subject_final" ? "নতুন Subject-এর নাম" : "নতুন Paper-এর নাম"}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
            />
            <Button size="sm" onClick={handleAddItem}><Plus className="h-4 w-4" /></Button>
          </div>

          <div className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {items?.length === 0 && <p className="text-sm text-muted-foreground">কোনো {category === "subject_final" ? "Subject" : "Paper"} যোগ করা হয়নি।</p>}
            {items?.map((item) => (
              <Card key={item.id} className="cursor-pointer hover:border-primary/40" onClick={() => { setManagingItem(item); setManagingMode("medical_standard"); }}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {MODES.map((m) => {
                        const key = `${m}_configured` as keyof SpItem;
                        const count = item[key] as number;
                        return (
                          <Badge key={m} variant={count >= TOTAL_TARGET ? "default" : "outline"} className="text-[10px]">
                            {MODE_LABELS[m]}: {count}/{TOTAL_TARGET}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {managingItem && (
        <SpFinalItemSourcesDialog
          item={managingItem}
          mode={managingMode}
          setMode={setManagingMode}
          onClose={() => {
            setManagingItem(null);
            queryClient.invalidateQueries({ queryKey: ["sp-final-items", category] });
          }}
        />
      )}
    </>
  );
};

/** Per (item, mode) source list: add an existing-bank filter or upload a CSV,
 *  each with a target question_count. Shows a running total against 100. */
const SpFinalItemSourcesDialog = ({
  item, mode, setMode, onClose,
}: {
  item: SpItem;
  mode: SpMode;
  setMode: (m: SpMode) => void;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [addingType, setAddingType] = useState<"existing_bank" | "csv" | null>(null);
  const [ebLabel, setEbLabel] = useState("");
  const [showQbSelector, setShowQbSelector] = useState(false);
  const [qbSaving, setQbSaving] = useState(false);

  // csv form state
  const [csvLabel, setCsvLabel] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);

  const { data: sources, isLoading } = useQuery({
    queryKey: ["sp-final-sources", item.id, mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sp_final_sources")
        .select("*")
        .eq("item_id", item.id)
        .eq("mode", mode)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as SpSource[];
    },
  });

  const total = (sources || []).reduce((sum, s) => sum + s.question_count, 0);

  const resetAddForms = () => {
    setAddingType(null);
    setEbLabel("");
    setCsvLabel(""); setCsvFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const refetchSources = () => queryClient.invalidateQueries({ queryKey: ["sp-final-sources", item.id, mode] });

  /** QuestionBankSelector hands back the exact questions the admin picked
   *  (browsed Category -> Subject -> Chapter -> Exam -> individual questions,
   *  same flow ExamForm.tsx uses). They're stored the same way an uploaded
   *  CSV's questions are (sp_final_source_questions) -- the random-assembly
   *  RPC doesn't care where a source's questions originally came from. */
  const handleQbSelect = async (questions: QuestionData[]) => {
    if (questions.length === 0) return;
    if (!ebLabel.trim()) {
      toast({ title: "আগে Label দিন", description: "Source-এর একটা নাম দিয়ে তারপর প্রশ্ন বাছাই করুন।", variant: "destructive" });
      return;
    }
    setQbSaving(true);
    try {
      const { data: sourceRow, error: sourceError } = await supabase
        .from("sp_final_sources")
        .insert({
          item_id: item.id,
          mode,
          source_type: "csv", // same storage path as CSV-uploaded sources
          label: ebLabel.trim(),
          question_count: questions.length,
        })
        .select()
        .single();
      if (sourceError) throw sourceError;

      const rows = questions.map((q) => ({
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
      const { error: qError } = await supabase.from("sp_final_source_questions").insert(rows);
      if (qError) throw qError;

      toast({ title: "যোগ হয়েছে", description: `${questions.length}টি প্রশ্ন যোগ হয়েছে।` });
      resetAddForms();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (parsed.data as any[]).forEach((row) => {
      const qText = row["questions"] || row["question"];
      if (!qText) return;
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
    return rows;
  };

  const handleAddCsv = async () => {
    if (!csvLabel.trim() || !csvFile) {
      toast({ title: "তথ্য অসম্পূর্ণ", description: "Label ও CSV ফাইল দিন।", variant: "destructive" });
      return;
    }
    setCsvUploading(true);
    try {
      const text = await csvFile.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast({ title: "CSV-তে কোনো প্রশ্ন পাওয়া যায়নি", variant: "destructive" });
        setCsvUploading(false);
        return;
      }
      const { data: sourceRow, error: sourceError } = await supabase
        .from("sp_final_sources")
        .insert({
          item_id: item.id,
          mode,
          source_type: "csv",
          label: csvLabel.trim(),
          question_count: rows.length,
        })
        .select()
        .single();
      if (sourceError) throw sourceError;

      const { error: qError } = await supabase
        .from("sp_final_source_questions")
        .insert(rows.map((r) => ({ ...r, source_id: sourceRow.id })));
      if (qError) throw qError;

      toast({ title: "CSV আপলোড হয়েছে", description: `${rows.length}টি প্রশ্ন যোগ হয়েছে।` });
      resetAddForms();
      refetchSources();
    } catch (err: any) {
      toast({ title: "আপলোড ব্যর্থ", description: err?.message || "আবার চেষ্টা করুন।", variant: "destructive" });
    } finally {
      setCsvUploading(false);
    }
  };

  const handleDeleteSource = async (source: SpSource) => {
    if (!confirm(`"${source.label}" source মুছে ফেলবেন?`)) return;
    const { error } = await supabase.from("sp_final_sources").delete().eq("id", source.id);
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
          <DialogTitle>{item.name} — সোর্স ম্যানেজ করুন</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1.5">
          {MODES.map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "default" : "outline"}
              className="flex-1 text-[11px] h-8 px-1"
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </Button>
          ))}
        </div>

        <div className={`text-sm font-medium px-3 py-2 rounded-lg ${total >= TOTAL_TARGET ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
          মোট: {total} / {TOTAL_TARGET} MCQ কনফিগার করা আছে
          {total < TOTAL_TARGET && ` — আরও ${TOTAL_TARGET - total}টি দরকার`}
          {total > TOTAL_TARGET && ` — ${total - TOTAL_TARGET}টি বেশি আছে`}
        </div>

        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {sources?.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.source_type === "csv" ? "CSV আপলোড" : `Existing Bank${s.filter_subject ? ` · ${s.filter_subject}` : ""}${s.filter_chapter ? ` · ${s.filter_chapter}` : ""}${s.filter_topic ? ` · ${s.filter_topic}` : ""}`}
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

        {addingType === null && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddingType("existing_bank")}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Existing Bank
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddingType("csv")}>
              <Upload className="h-3.5 w-3.5 mr-1" /> CSV আপলোড
            </Button>
          </div>
        )}

        {addingType === "existing_bank" && (
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Existing Bank থেকে যোগ করুন</p>
                <Button size="sm" variant="ghost" onClick={resetAddForms}><X className="h-4 w-4" /></Button>
              </div>
              <Input placeholder="Source-এর নাম (যেমন: HSC Board 2023-24)" value={ebLabel} onChange={(e) => setEbLabel(e.target.value)} />
              <Button
                size="sm"
                className="w-full"
                disabled={!ebLabel.trim()}
                onClick={() => setShowQbSelector(true)}
              >
                প্রশ্ন বাছাই করুন
              </Button>
              {!ebLabel.trim() && <p className="text-[11px] text-muted-foreground">আগে একটা নাম দিন।</p>}
            </CardContent>
          </Card>
        )}

        {addingType === "csv" && (
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">CSV থেকে যোগ করুন</p>
                <Button size="sm" variant="ghost" onClick={resetAddForms}><X className="h-4 w-4" /></Button>
              </div>
              <Input placeholder="Source-এর নাম" value={csvLabel} onChange={(e) => setCsvLabel(e.target.value)} />
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              />
              <p className="text-[11px] text-muted-foreground">Columns: questions, option1-5, answer (1-5), explanation</p>
              <Button size="sm" className="w-full" onClick={handleAddCsv} disabled={csvUploading}>
                {csvUploading ? "আপলোড হচ্ছে..." : "আপলোড করুন"}
              </Button>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={showQbSelector} onOpenChange={setShowQbSelector}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>প্রশ্ন বাছাই করুন — {ebLabel}</DialogTitle>
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
