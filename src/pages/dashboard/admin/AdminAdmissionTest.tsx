import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X, Save, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type Category = "medical" | "varsity";
type Mode = "subject_final" | "paper_final" | "full_model";

const CATEGORY_LABEL: Record<Category, string> = {
  medical: "মেডিকেল এডমিশন টেস্ট",
  varsity: "ভার্সিটি এডমিশন টেস্ট",
};

// ---------- Source picker: pick an exam (with subject/chapter shown) as a random-pull source ----------
function SourcePicker({ sources, onAdd, onRemove }: { sources: any[]; onAdd: (examId: string, examTitle: string, subject: string | null, chapter: string | null) => void; onRemove: (id: string) => void; }) {
  const [search, setSearch] = useState("");
  const { data: exams } = useQuery({
    queryKey: ["admission-source-exams", search],
    queryFn: async () => {
      let q = supabase.from("exams").select("id, title, subject, chapter").order("created_at", { ascending: false }).limit(30);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
      <Label className="text-xs">Sources (Question Bank থেকে exam সিলেক্ট করুন — randomly MCQ আসবে)</Label>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <Badge key={s.id} variant="secondary" className="gap-1">
            {s.exams?.title || s.source_exam_id}
            <button onClick={() => onRemove(s.id)}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
        {sources.length === 0 && <span className="text-xs text-muted-foreground">কোনো source সেট করা নেই</span>}
      </div>
      <Input placeholder="Exam খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />
      <div className="max-h-40 overflow-y-auto space-y-1">
        {(exams || []).map((e: any) => (
          <button
            key={e.id}
            onClick={() => onAdd(e.id, e.title, e.subject?.[0] || null, e.chapter || null)}
            className="w-full text-left text-xs p-1.5 rounded hover:bg-accent flex items-center justify-between"
          >
            <span className="truncate">{e.title}</span>
            <Plus className="h-3 w-3 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Generic slice editor (works for subject / paper / full-model slice rows) ----------
function SliceRow({ table, sourceTable, sourceFk, row, nameField, onChanged }: { table: string; sourceTable: string; sourceFk: string; row: any; nameField: string; onChanged: () => void; }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row[nameField]);
  const [marks, setMarks] = useState(String(row.marks));
  const [qCount, setQCount] = useState(String(row.question_count));
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const { data: sources, refetch } = useQuery({
    queryKey: [sourceTable, row.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(sourceTable).select(`*, exams:source_exam_id(title)`).eq(sourceFk, row.id);
      if (error) throw error;
      return data || [];
    },
    enabled: expanded,
  });

  const save = async () => {
    // @ts-expect-error dynamic table
    const { error } = await supabase.from(table).update({ [nameField]: name, marks: Number(marks), question_count: Number(qCount) }).eq("id", row.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    // @ts-expect-error dynamic table
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    onChanged();
  };

  const addSource = async (examId: string, examTitle: string, subject: string | null, chapter: string | null) => {
    // @ts-expect-error dynamic table
    const { error } = await supabase.from(sourceTable).insert({ [sourceFk]: row.id, source_exam_id: examId });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    refetch();
  };

  const removeSource = async (id: string) => {
    // @ts-expect-error dynamic table
    const { error } = await supabase.from(sourceTable).delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    refetch();
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <div className="flex-1 grid grid-cols-3 gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" placeholder="নাম" />
            <Input value={marks} onChange={(e) => setMarks(e.target.value)} className="h-8 text-sm" placeholder="Marks" type="number" />
            <Input value={qCount} onChange={(e) => setQCount(e.target.value)} className="h-8 text-sm" placeholder="MCQ Count" type="number" />
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2 text-sm">
            <span className="font-medium">{row[nameField]}</span>
            <Badge variant="outline">{row.marks} marks</Badge>
            <Badge variant="outline">{row.question_count} MCQ</Badge>
          </div>
        )}
        <div className="flex items-center gap-1">
          {editing ? (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save}><Save className="h-3.5 w-3.5" /></Button>
          ) : (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      {expanded && <SourcePicker sources={sources || []} onAdd={addSource} onRemove={removeSource} />}
    </div>
  );
}

function AddSliceButton({ table, testId, nameField, nameLabel }: { table: string; testId: string; nameField: string; nameLabel: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [marks, setMarks] = useState("");
  const [qCount, setQCount] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const add = async () => {
    if (!name.trim()) return;
    // @ts-expect-error dynamic table
    const { error } = await supabase.from(table).insert({
      admission_test_id: testId,
      [nameField]: name.trim(),
      marks: Number(marks) || 0,
      question_count: Number(qCount) || 0,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setName(""); setMarks(""); setQCount(""); setOpen(false);
    qc.invalidateQueries({ queryKey: [table, testId] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />{nameLabel} যোগ করুন</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>{nameLabel} যোগ করুন</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">নাম</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Marks</Label><Input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} /></div>
            <div><Label className="text-xs">MCQ Count</Label><Input type="number" value={qCount} onChange={(e) => setQCount(e.target.value)} /></div>
          </div>
          <Button className="w-full" onClick={add}>যোগ করুন</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeTab({ testId, mode }: { testId: string; mode: Mode }) {
  const table = mode === "subject_final" ? "admission_test_subjects" : mode === "paper_final" ? "admission_test_papers" : "admission_test_full_model_slices";
  const sourceTable = mode === "subject_final" ? "admission_test_subject_sources" : mode === "paper_final" ? "admission_test_paper_sources" : "admission_test_full_model_sources";
  const sourceFk = mode === "subject_final" ? "admission_test_subject_id" : mode === "paper_final" ? "admission_test_paper_id" : "slice_id";
  const nameField = mode === "paper_final" ? "paper_name" : "subject_name";
  const nameLabel = mode === "subject_final" ? "Subject" : mode === "paper_final" ? "Paper" : "Subject Slice";

  const { data: rows, refetch } = useQuery({
    queryKey: [table, testId],
    queryFn: async () => {
      // @ts-expect-error dynamic table
      const { data, error } = await supabase.from(table).select("*").eq("admission_test_id", testId).order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const totalMarks = (rows || []).reduce((s: number, r: any) => s + Number(r.marks || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">মোট মার্ক: {totalMarks} {mode === "full_model" && totalMarks !== 100 ? "(⚠ 100 না)" : ""}</span>
        <AddSliceButton table={table} testId={testId} nameField={nameField} nameLabel={nameLabel} onAdded={refetch} />
      </div>
      <div className="space-y-2">
        {(rows || []).map((row: any) => (
          <SliceRow key={row.id} table={table} sourceTable={sourceTable} sourceFk={sourceFk} row={row} nameField={nameField} onChanged={refetch} />
        ))}
        {(rows || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">কিছু যোগ করা হয়নি</p>}
      </div>
    </div>
  );
}

function TestCard({ test, onChanged }: { test: any; onChanged: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(test.title);

  const save = async () => {
    const { error } = await supabase.from("admission_tests" as any).update({ title }).eq("id", test.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm("এই টেস্ট ডিলিট করবেন?")) return;
    const { error } = await supabase.from("admission_tests" as any).delete().eq("id", test.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          {editing ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" />
          ) : (
            <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />{test.title}</CardTitle>
          )}
          <div className="flex gap-1">
            {editing ? (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save}><Save className="h-3.5 w-3.5" /></Button>
            ) : (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="subject_final">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="subject_final">Subject Final</TabsTrigger>
            <TabsTrigger value="paper_final">Paper Final</TabsTrigger>
            <TabsTrigger value="full_model">Full Model (100)</TabsTrigger>
          </TabsList>
          <TabsContent value="subject_final"><ModeTab testId={test.id} mode="subject_final" /></TabsContent>
          <TabsContent value="paper_final"><ModeTab testId={test.id} mode="paper_final" /></TabsContent>
          <TabsContent value="full_model"><ModeTab testId={test.id} mode="full_model" /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function AdminAdmissionTest() {
  const { toast } = useToast();
  const [category, setCategory] = useState<Category>("medical");
  const [newTitle, setNewTitle] = useState("");

  const { data: tests, refetch } = useQuery({
    queryKey: ["admission-tests", category],
    queryFn: async () => {
      const { data, error } = await supabase.from("admission_tests" as any).select("*").eq("category", category).order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const addTest = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from("admission_tests" as any).insert({ category, title: newTitle.trim() });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewTitle("");
    refetch();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Admission Test Manager</h1>
      <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
        <TabsList>
          <TabsTrigger value="medical">{CATEGORY_LABEL.medical}</TabsTrigger>
          <TabsTrigger value="varsity">{CATEGORY_LABEL.varsity}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-2">
        <Input placeholder="নতুন টেস্টের নাম" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <Button onClick={addTest}><Plus className="h-4 w-4 mr-1" />যোগ করুন</Button>
      </div>

      <div className="space-y-4">
        {(tests || []).map((t: any) => <TestCard key={t.id} test={t} onChanged={refetch} />)}
        {(tests || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">এখনো কোনো টেস্ট নেই</p>}
      </div>
    </div>
  );
}
