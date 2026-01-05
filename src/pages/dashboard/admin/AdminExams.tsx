import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Exam, Course } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { FileUp, Trash2, Trophy, FileQuestion, Clock, CheckCircle, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { SUBJECTS } from "@/lib/constants";
import { toDhakaTimeISO, fromDhakaTimeToUTC } from "@/lib/dateUtils";
import { MultiSelect } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";

const examSchema = z.object({
  id: z.string().optional(),
  course_id: z.string().min(1, "Course is required"),
  title: z.string().trim().min(1, "Title is required"),
  subject: z.array(z.string()).default([]),
  exam_type: z.enum(["live", "practice"]),
  duration_minutes: z
    .string()
    .trim()
    .min(1, "Duration is required")
    .refine((val) => !isNaN(Number(val)), { message: "Duration must be a number" }),
  negative_mark_per_question: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || !isNaN(Number(val)), { message: "Negative mark must be a number" }),
  instructions: z.string().trim().max(4000).optional().or(z.literal("")),
  time_window_start: z.string().optional(),
  time_window_end: z.string().optional(),
  is_published: z.boolean().optional().default(false),
  restrict_solution: z.boolean().optional().default(false),
  questions_json: z.string().trim().optional().or(z.literal("")),
  questions_csv: z.string().trim().optional().or(z.literal("")),
});

const PAGE_SIZE = 10;

const AdminExams = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<z.infer<typeof examSchema>>({
    course_id: "",
    title: "",
    subject: [],
    exam_type: "live",
    duration_minutes: "60",
    negative_mark_per_question: "0",
    instructions: "",
    time_window_start: "",
    time_window_end: "",
    is_published: false,
    restrict_solution: false,
    restrict_solution: false,
    questions_json: "",
    questions_csv: "",
  });
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Admin   Exams   Udvash LMS";
  }, []);

  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: examsData, isLoading } = useQuery({
    queryKey: ["admin-exams", subjectFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("exams")
        .select("*, course:courses(id, name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (subjectFilter !== "all") {
        query = query.contains("subject", [subjectFilter]);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const exams = examsData?.data || [];
  const totalCount = examsData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const resetForm = () => {
    setForm({
      course_id: "",
      title: "",
      subject: [],
      exam_type: "live",
      duration_minutes: "60",
      negative_mark_per_question: "0",
      instructions: "",
      time_window_start: "",
      time_window_end: "",
      is_published: false,
      questions_json: "",
      questions_csv: "",
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'json' | 'csv') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (type === 'json') {
        setForm(prev => ({ ...prev, questions_json: content }));
      } else {
        setForm(prev => ({ ...prev, questions_csv: content }));
      }
      toast({ title: `Loaded ${type.toUpperCase()} file successfully` });
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const upsertExamMutation = useMutation({
    mutationFn: async (values: z.infer<typeof examSchema>) => {
      const parsed = examSchema.parse(values);

      const payload: Partial<Exam> = {
        course_id: parsed.course_id,
        title: parsed.title,
        subject: parsed.subject, // Array
        exam_type: parsed.exam_type,
        duration_minutes: Number(parsed.duration_minutes),
        negative_mark_per_question: parsed.negative_mark_per_question
          ? Number(parsed.negative_mark_per_question)
          : 0,
        instructions: parsed.instructions || null,
        time_window_start: parsed.time_window_start ? fromDhakaTimeToUTC(parsed.time_window_start) : null,
        time_window_end: parsed.time_window_end ? fromDhakaTimeToUTC(parsed.time_window_end) : null,
        is_published: parsed.is_published ?? false,
        restrict_solution: parsed.restrict_solution ?? false,
      };

      // Helper to normalise questions from JSON/CSV into exam_questions rows (without exam_id/index)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normaliseQuestions = (input: Array<any>) => {
        return input.map((q) => {
          const questionText = String(
            q.question_text ?? q.question ?? "",
          );

          const optionA = String(
            q.option_a ?? q.a ?? q.option1 ?? q.options?.A ?? "",
          );
          const optionB = String(
            q.option_b ?? q.b ?? q.option2 ?? q.options?.B ?? "",
          );
          const optionC = String(
            q.option_c ?? q.c ?? q.option3 ?? q.options?.C ?? "",
          );
          const optionD = String(
            q.option_d ?? q.d ?? q.option4 ?? q.options?.D ?? "",
          );

          let correct: string | null = null;
          if (typeof q.correct_option === "string" && q.correct_option.trim()) {
            correct = q.correct_option.trim().charAt(0).toUpperCase();
          } else if (typeof q.correct_answer === "string" && q.correct_answer.trim()) {
            correct = q.correct_answer.trim().charAt(0).toUpperCase();
          } else if (q.answer != null) {
            const idx = Number(q.answer);
            if (idx >= 1 && idx <= 4) {
              correct = ["A", "B", "C", "D"][idx - 1];
            }
          }

          const explanation = typeof q.explanation === "string" ? q.explanation : null;

          return {
            question_text: questionText,
            option_a: optionA,
            option_b: optionB,
            option_c: optionC,
            option_d: optionD,
            correct_option: (correct || "A") as string,
            marks: q.marks != null ? Number(q.marks) : 1,
            explanation,
            question_type: q.type != null ? String(q.type) : null,
            section: q.section != null ? String(q.section) : null,
          };
        });
      };

      const parseCsvQuestions = (csv: string) => {
        const rows: any[] = [];
        const lines = csv
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (!lines.length) return rows;

        const header = lines[0].replace(/^"|"$/g, "");
        const expectedHeader =
          "questions,option1,option2,option3,option4,option5,answer,explanation,type,section";
        if (header.toLowerCase().replace(/\s+/g, "") !== expectedHeader) {
          throw new Error("CSV header does not match expected format.");
        }

        const parseLine = (line: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === "," && !inQuotes) {
              result.push(current);
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current);

          return result.map((v) => v.replace(/^"|"$/g, ""));
        };

        for (let i = 1; i < lines.length; i++) {
          const cols = parseLine(lines[i]);
          if (cols.length < 8) continue;

          const [qText, o1, o2, o3, o4, _o5, answer, explanation, type, section] = cols;
          const ansIdx = Number(answer);
          const correct = ansIdx >= 1 && ansIdx <= 4 ? ["A", "B", "C", "D"][ansIdx - 1] : "A";

          rows.push({
            question_text: qText,
            option_a: o1,
            option_b: o2,
            option_c: o3,
            option_d: o4,
            correct_option: correct,
            marks: 1,
            explanation: explanation || null,
            question_type: type || null,
            section: section || null,
          });
        }

        return rows;
      };

      if (parsed.id) {
        const { error } = await supabase
          .from("exams")
          .update(payload)
          .eq("id", parsed.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("exams")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allQuestionRows: any[] = [];

        if (parsed.questions_json) {
          try {
            const jsonData = JSON.parse(parsed.questions_json);
            if (!Array.isArray(jsonData)) {
              throw new Error("Questions JSON must be an array.");
            }
            allQuestionRows.push(...normaliseQuestions(jsonData));
          } catch (err) {
            if (err instanceof Error) {
                throw new Error(`Invalid questions JSON: ${err.message}`);
            }
             throw new Error(`Invalid questions JSON: ${String(err)}`);
          }
        }

        if (parsed.questions_csv) {
          allQuestionRows.push(...parseCsvQuestions(parsed.questions_csv));
        }

        if (allQuestionRows.length) {
          const rowsWithExam = allQuestionRows.map((q, index) => ({
            exam_id: data.id,
            question_index: index + 1,
            ...q,
          }));

          const { error: qError } = await supabase
            .from("exam_questions")
            .insert(rowsWithExam);
          if (qError) throw qError;
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Exam saved" });
      queryClient.invalidateQueries({ queryKey: ["admin-exams"] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving exam",
        description: error.message ?? "Please check your input and try again",
        variant: "destructive",
      });
    },
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (id: string) => {
      // Note: If ON DELETE CASCADE is set on foreign keys in DB, deleting exam is enough.
      // If not, we should manually delete questions/attempts.
      // Assuming CASCADE is set or we do best effort cleanup here.
      // First, delete questions to be safe (if no cascade)
      await supabase.from("exam_questions").delete().eq("exam_id", id);
      await supabase.from("exam_attempts").delete().eq("exam_id", id);

      const { error } = await supabase.from("exams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Exam deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-exams"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting exam",
        description: error.message ?? "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (exam: Exam) => {
    // Handle subject being array or string (legacy)
    let subjects: string[] = [];
    if (Array.isArray(exam.subject)) {
        subjects = exam.subject;
    } else if (typeof exam.subject === 'string' && exam.subject) {
        subjects = [exam.subject];
    }

    setForm({
      id: exam.id,
      course_id: exam.course_id,
      title: exam.title ?? "",
      subject: subjects,
      exam_type: exam.exam_type === "practice" ? "practice" : "live",
      duration_minutes: exam.duration_minutes != null ? String(exam.duration_minutes) : "60",
      negative_mark_per_question:
        exam.negative_mark_per_question != null
          ? String(exam.negative_mark_per_question)
          : "0",
      instructions: exam.instructions ?? "",
      time_window_start: exam.time_window_start ? toDhakaTimeISO(exam.time_window_start) : "",
      time_window_end: exam.time_window_end ? toDhakaTimeISO(exam.time_window_end) : "",
      is_published: exam.is_published ?? false,
      restrict_solution: exam.restrict_solution ?? false,
      questions_json: "",
      questions_csv: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertExamMutation.mutate(form);
  };

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Admin: Exams</h1>
                <p className="text-sm text-muted-foreground">
                Configure exams and optionally bulk-import questions from JSON.
                </p>
            </div>
            <Button onClick={() => navigate("/dashboard/admin/exams/question-maker")}>
                Open Question Maker
            </Button>
        </div>
      </header>

      <div className="grid gap-6">
        <Card className="border border-foreground/60">
          <CardHeader>
            <CardTitle className="text-base">
              {form.id ? "Edit exam" : "Create new exam"}
            </CardTitle>
            <CardDescription>
              Live exams allow one attempt; practice exams allow unlimited retakes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="course">Course</Label>
                <Select
                  value={form.course_id}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, course_id: value }))}
                >
                  <SelectTrigger id="course">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map((course: Pick<Course, "id" | "name">) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam_type">Exam type</Label>
                <Select
                  value={form.exam_type}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, exam_type: value as "live" | "practice" }))
                  }
                >
                  <SelectTrigger id="exam_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live exam</SelectItem>
                    <SelectItem value="practice">Practice exam</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subjects</Label>
                <MultiSelect
                    options={SUBJECTS.map(s => ({ label: s, value: s }))}
                    selected={form.subject}
                    onChange={(selected) => setForm((prev) => ({ ...prev, subject: selected }))}
                    placeholder="Select subjects..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                <Input
                  id="duration_minutes"
                  value={form.duration_minutes}
                  onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="negative_mark_per_question">Negative mark per wrong answer</Label>
                <Input
                  id="negative_mark_per_question"
                  value={form.negative_mark_per_question}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, negative_mark_per_question: e.target.value }))
                  }
                  placeholder="Ex: 0.25"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  rows={3}
                  value={form.instructions}
                  onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_window_start">Time window start</Label>
                <Input
                  id="time_window_start"
                  type="datetime-local"
                  value={form.time_window_start}
                  onChange={(e) => setForm((prev) => ({ ...prev, time_window_start: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_window_end">Time window end</Label>
                <Input
                  id="time_window_end"
                  type="datetime-local"
                  value={form.time_window_end}
                  onChange={(e) => setForm((prev) => ({ ...prev, time_window_end: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 md:col-span-2">
                <Switch
                  id="is_published"
                  checked={form.is_published}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_published: checked }))
                  }
                />
                <Label htmlFor="is_published">Exam is published / visible to students</Label>
              </div>

              <div className="flex items-center gap-2 md:col-span-2 border p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200">
                <Switch
                  id="restrict_solution"
                  checked={form.restrict_solution}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, restrict_solution: checked }))
                  }
                />
                <Label htmlFor="restrict_solution" className="flex flex-col">
                    <span>Restrict Solution (Solvesheet)</span>
                    <span className="text-xs text-muted-foreground font-normal">
                        If enabled, students cannot see the detailed solution or correct answers after the exam. They will only see their marks and stats.
                    </span>
                </Label>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="questions_json">Bulk questions (JSON)</Label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => handleFileUpload(e, 'json')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button type="button" variant="outline" size="sm" className="pointer-events-none">
                      <FileUp className="h-4 w-4 mr-2" />
                      Upload JSON
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="questions_json"
                  rows={6}
                  value={form.questions_json}
                  onChange={(e) => setForm((prev) => ({ ...prev, questions_json: e.target.value }))}
                  placeholder={
                    "Paste an array of JSON questions. Supported formats include your coaching JSON with options A–D and correct_answer."
                  }
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  On create, questions will be imported into exam_questions. Editing an existing exam does not change existing
                  questions yet.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="questions_csv">Bulk questions (CSV)</Label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => handleFileUpload(e, 'csv')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button type="button" variant="outline" size="sm" className="pointer-events-none">
                      <FileUp className="h-4 w-4 mr-2" />
                      Upload CSV
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="questions_csv"
                  rows={6}
                  value={form.questions_csv}
                  onChange={(e) => setForm((prev) => ({ ...prev, questions_csv: e.target.value }))}
                  placeholder={
                    'Header: "questions","option1","option2","option3","option4","option5","answer","explanation","type","section"'
                  }
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  One question per line. Answer is 1–4 mapping to option1–4. Explanation, type, and section are optional.
                </p>
              </div>

              <div className="flex items-center gap-2 md:col-span-2">
                <Button type="submit" size="sm" disabled={upsertExamMutation.isPending}>
                  {upsertExamMutation.isPending ? "Saving..." : form.id ? "Update exam" : "Create exam"}
                </Button>
                {form.id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={resetForm}
                    disabled={upsertExamMutation.isPending}
                  >
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Exams List */}
        <Card className="border border-foreground/60 overflow-hidden">
        <div className="p-6 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                <h2 className="text-lg font-semibold">Exams</h2>
                <p className="text-sm text-muted-foreground">
                    Existing exams by course, with type, duration, and publish status.
                </p>
                </div>
                <div className="w-full md:w-[200px]">
                <Select
                    value={subjectFilter}
                    onValueChange={(v) => {
                        setSubjectFilter(v);
                        setPage(0);
                    }}
                >
                    <SelectTrigger>
                    <SelectValue placeholder="Filter by subject" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {SUBJECTS.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                        {subject}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                </div>
            </div>

            {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading exams...</div>
            ) : !exams || exams.length === 0 ? (
                <div className="text-sm text-muted-foreground">No exams defined yet.</div>
            ) : (
                <>
                {/* Desktop Table View */}
                <div className="hidden md:block rounded-md border border-border/60 bg-card overflow-hidden overflow-x-auto no-scrollbar scroll-smooth">
                    <Table className="w-full">
                        <TableHeader>
                        <TableRow>
                            <TableHead className="whitespace-nowrap">Course</TableHead>
                            <TableHead className="whitespace-nowrap">Title</TableHead>
                            <TableHead className="whitespace-nowrap">Subject</TableHead>
                            <TableHead className="whitespace-nowrap">Type</TableHead>
                            <TableHead className="whitespace-nowrap">Duration</TableHead>
                            <TableHead className="whitespace-nowrap">Negative</TableHead>
                            <TableHead className="whitespace-nowrap">Published</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {exams.map((exam: Exam) => (
                            <TableRow key={exam.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleEdit(exam)}>
                            <TableCell className="whitespace-nowrap font-medium">{exam.course?.name}</TableCell>
                            <TableCell className="whitespace-nowrap">{exam.title}</TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                <div className="flex flex-wrap gap-1">
                                    {Array.isArray(exam.subject) && exam.subject.map((s: string) => (
                                        <Badge key={s} variant="outline" className="text-[10px] py-0 h-4">{s}</Badge>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="capitalize whitespace-nowrap">{exam.exam_type}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{exam.duration_minutes} min</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                                {exam.negative_mark_per_question ?? 0}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                                {exam.is_published ? "Yes" : "No"}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                                {exam.restrict_solution ? <Lock className="h-3 w-3 text-red-500 inline mr-1" /> : ""}
                                {exam.restrict_solution ? "Yes" : "No"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8"
                                    onClick={() => navigate(`/dashboard/admin/exams/question-maker/${exam.id}`)}
                                >
                                    <FileQuestion className="h-4 w-4 mr-1" /> Questions
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8"
                                    onClick={() => navigate(`/dashboard/leaderboard/${exam.id}`)}
                                >
                                    <Trophy className="h-4 w-4 mr-1 text-yellow-500" /> Rank
                                </Button>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => {
                                    if (window.confirm("Delete this exam? This cannot be undone. Questions and results will be deleted.")) {
                                        deleteExamMutation.mutate(exam.id);
                                    }
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                </div>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden grid gap-4">
                    {exams.map((exam: Exam) => (
                        <Card key={exam.id} onClick={() => handleEdit(exam)} className="cursor-pointer hover:border-primary/50 transition-colors">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="font-semibold text-sm text-primary">{exam.course?.name}</div>
                                        <h3 className="font-bold leading-tight">{exam.title}</h3>
                                        {Array.isArray(exam.subject) && (
                                            <div className="flex flex-wrap gap-1">
                                                {exam.subject.map((s: string) => (
                                                    <span key={s} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`text-xs px-2 py-1 rounded-full font-medium ${exam.is_published ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                                        {exam.is_published ? 'Published' : 'Draft'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {exam.duration_minutes} min
                                    </div>
                                    <div className="flex items-center gap-1 capitalize">
                                        {exam.exam_type === 'live' ? <CheckCircle className="h-3 w-3 text-red-500" /> : <CheckCircle className="h-3 w-3" />}
                                        {exam.exam_type}
                                    </div>
                                    {exam.restrict_solution && (
                                        <div className="flex items-center gap-1 text-red-500">
                                            <Lock className="h-3 w-3" />
                                            Restricted
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t mt-2" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-8 text-xs"
                                        onClick={() => navigate(`/dashboard/admin/exams/question-maker/${exam.id}`)}
                                    >
                                        <FileQuestion className="h-3 w-3 mr-1" /> Questions
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-8 text-xs"
                                        onClick={() => navigate(`/dashboard/leaderboard/${exam.id}`)}
                                    >
                                        <Trophy className="h-3 w-3 mr-1 text-yellow-500" /> Rank
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="destructive"
                                        className="h-8 w-8"
                                        onClick={() => {
                                        if (window.confirm("Delete this exam? This cannot be undone. Questions and results will be deleted.")) {
                                            deleteExamMutation.mutate(exam.id);
                                        }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t pt-4">
                     <div className="text-xs text-muted-foreground">
                         Page {page + 1} of {totalPages || 1}
                     </div>
                     <div className="flex gap-2">
                         <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                         >
                             <ChevronLeft className="h-4 w-4" />
                             Previous
                         </Button>
                         <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= totalPages - 1}
                         >
                             Next
                             <ChevronRight className="h-4 w-4" />
                         </Button>
                     </div>
                </div>
                </>
            )}
        </div>
        </Card>
      </div>
    </section>
  );
};

export default AdminExams;
