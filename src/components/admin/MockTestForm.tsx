import { useState } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileUp, X } from "lucide-react";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";
import { QuestionData } from "@/types/exam";

interface MockTestFormProps {
  mockExam?: any;
  onClose: () => void;
}

export const MockTestForm = ({ mockExam, onClose }: MockTestFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(mockExam?.title || "");
  const [subject, setSubject] = useState(mockExam?.subject || "");
  const [chapter, setChapter] = useState(mockExam?.chapter || "");
  const [topic, setTopic] = useState(mockExam?.topic || "");
  const [duration, setDuration] = useState(String(mockExam?.duration_minutes || 30));
  const [negativeMark, setNegativeMark] = useState(String(mockExam?.negative_mark_per_question || 0));
  const [instructions, setInstructions] = useState(mockExam?.instructions || "");
  const [isPublished, setIsPublished] = useState(mockExam?.is_published ?? false);
  const [linkedExamId, setLinkedExamId] = useState(mockExam?.linked_exam_id || "");
  const [csvText, setCsvText] = useState("");
  const [bankQuestions, setBankQuestions] = useState<QuestionData[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(String(ev.target?.result || ""));
    reader.readAsText(file);
  };

  const parseCsvQuestions = (csv: string) => {
    const result = Papa.parse(csv, { header: true, skipEmptyLines: true }) as any;
    const rows: any[] = [];
    (result.data || []).forEach((row: any) => {
      const qText = row["questions"];
      if (!qText) return;
      const answer = row["answer"];
      const ansIdx = Number(answer);
      const correct = ansIdx >= 1 && ansIdx <= 4 ? ["A", "B", "C", "D"][ansIdx - 1] : "A";
      rows.push({
        question_text: qText,
        option_a: row["option1"],
        option_b: row["option2"],
        option_c: row["option3"],
        option_d: row["option4"],
        correct_option: correct,
        marks: 1,
        explanation: row["explanation"] || null,
      });
    });
    return rows;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title,
        subject: subject || null,
        chapter: chapter || null,
        topic: topic || null,
        duration_minutes: Number(duration) || 30,
        negative_mark_per_question: Number(negativeMark) || 0,
        instructions: instructions || null,
        is_published: isPublished,
        linked_exam_id: linkedExamId || null,
      };

      if (mockExam?.id) {
        const { error } = await supabase.from("mock_exams").update(payload).eq("id", mockExam.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("mock_exams").insert(payload).select("id").single();
        if (error) throw error;

        const allRows: any[] = [];
        if (csvText.trim()) allRows.push(...parseCsvQuestions(csvText));
        if (bankQuestions.length) {
          bankQuestions.forEach((q: any) => {
            allRows.push({
              question_text: q.question_text,
              option_a: q.option_a,
              option_b: q.option_b,
              option_c: q.option_c,
              option_d: q.option_d,
              correct_option: q.correct_option || "A",
              marks: q.marks ?? 1,
              explanation: q.explanation || null,
              subject: q.subject || null,
              chapter: q.chapter || null,
              topic: q.topic || null,
            });
          });
        }

        if (allRows.length) {
          const rowsWithExam = allRows.map((q, index) => ({
            mock_exam_id: data.id,
            question_index: index + 1,
            ...q,
          }));
          const { error: qErr } = await supabase.from("mock_exam_questions").insert(rowsWithExam);
          if (qErr) throw qErr;
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Mock Test saved" });
      queryClient.invalidateQueries({ queryKey: ["admin-mock-exams"] });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{mockExam?.id ? "Edit Mock Test" : "New Mock Test"}</CardTitle>
          <CardDescription>Separate from the main Exam system — content authored here only.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            {!mockExam?.id && <TabsTrigger value="csv">CSV Upload</TabsTrigger>}
            {!mockExam?.id && <TabsTrigger value="bank">Question Bank</TabsTrigger>}
            <TabsTrigger value="link">Link Readymade Exam</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mock Test title" />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Physics" />
              </div>
              <div>
                <Label>Chapter</Label>
                <Input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="e.g. Vector" />
              </div>
              <div>
                <Label>Topic</Label>
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Vector Addition" />
              </div>
              <div>
                <Label>Negative mark / question</Label>
                <Input type="number" step="0.01" value={negativeMark} onChange={(e) => setNegativeMark(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Instructions</Label>
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
              <span className="text-sm font-medium">{isPublished ? "Published (visible to students)" : "Draft"}</span>
            </div>
          </TabsContent>

          {!mockExam?.id && (
            <TabsContent value="csv" className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <Label>Bulk questions (CSV)</Label>
                <label className="cursor-pointer">
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  <Button asChild variant="outline" size="sm" type="button">
                    <span><FileUp className="h-4 w-4 mr-1" /> Upload CSV</span>
                  </Button>
                </label>
              </div>
              <div
                className={`relative ${isDragging ? "ring-2 ring-primary rounded-md" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setCsvText(String(ev.target?.result || ""));
                    reader.readAsText(file);
                  }
                }}
              >
                <Textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={8}
                  placeholder='Header: "questions","option1","option2","option3","option4","answer","explanation"'
                />
              </div>
            </TabsContent>
          )}

          {!mockExam?.id && (
            <TabsContent value="bank" className="pt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Pick questions from the existing question bank (exams / readymade / archive) — only the selected
                questions are copied here; the source exam is not linked or modified.
              </p>
              <QuestionBankSelector onSelect={(qs) => setBankQuestions((prev) => [...prev, ...qs])} />
              {bankQuestions.length > 0 && (
                <p className="text-sm mt-2 font-medium">{bankQuestions.length} question(s) selected from bank.</p>
              )}
            </TabsContent>
          )}

          <TabsContent value="link" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              Instead of authoring new questions, you can point this Mock Test at an existing readymade exam by its
              ID. Students will be routed to that exam's content; the two ecosystems remain otherwise separate.
            </p>
            <div>
              <Label>Readymade Exam ID (optional)</Label>
              <Input value={linkedExamId} onChange={(e) => setLinkedExamId(e.target.value)} placeholder="exam UUID" />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !title}>
            {saveMutation.isPending ? "Saving..." : "Save Mock Test"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
