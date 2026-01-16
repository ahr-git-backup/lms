import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Course, Exam } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { FileUp } from "lucide-react";
import { SUBJECTS } from "@/lib/constants";
import { toDhakaTimeISO, fromDhakaTimeToUTC } from "@/lib/dateUtils";
import { MultiSelect } from "@/components/ui/multi-select";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { useGlobalMetadata, useAddGlobalMetadata } from "@/hooks/useGlobalMetadata";
import Papa from "papaparse";

const examSchema = z.object({
  id: z.string().optional(),
  course_id: z.string().nullable().optional(),
  shared_course_ids: z.array(z.string()).default([]),
  archive_course_ids: z.array(z.string()).default([]),
  title: z.string().trim().min(1, "Title is required"),
  subject: z.array(z.string()).default([]),
  chapter: z.string().trim().optional().or(z.literal("")),
  exam_type: z.enum(["live", "practice"]),
  duration_minutes: z
    .string()
    .trim()
    .min(1, "Duration is required")
    .refine((val) => !isNaN(Number(val)), { message: "Duration must be a number" }),
  total_marks: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || !isNaN(Number(val)), { message: "Total marks must be a number" }),
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
  is_visible_on_free: z.boolean().optional().default(true),
  restrict_solution: z.boolean().optional().default(false),
  questions_json: z.string().trim().optional().or(z.literal("")),
  questions_csv: z.string().trim().optional().or(z.literal("")),
});

interface ExamFormProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exam?: any;
    onSuccess: () => void;
    onCancel?: () => void;
    isFreeMode?: boolean;
    isArchiveMode?: boolean;
}

export const ExamForm = ({ exam, onSuccess, onCancel, isFreeMode = false, isArchiveMode = false }: ExamFormProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Global Metadata Hook
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: globalMeta } = useGlobalMetadata() as any;
    const addMetadata = useAddGlobalMetadata();

    const handleCreateMeta = (type: 'subject' | 'chapter', value: string) => {
        addMetadata.mutate({ type, value });
    };

    const [form, setForm] = useState<z.infer<typeof examSchema>>({
        course_id: "",
        shared_course_ids: [],
        archive_course_ids: [],
        title: "",
        subject: [],
        chapter: "",
        exam_type: "live",
        duration_minutes: "60",
        total_marks: "",
        negative_mark_per_question: "0",
        instructions: "",
        time_window_start: "",
        time_window_end: "",
        is_published: false,
        is_visible_on_free: true,
        restrict_solution: false,
        questions_json: "",
        questions_csv: "",
    });

    useEffect(() => {
        if (exam) {
            let subjects: string[] = [];
            if (Array.isArray(exam.subject)) {
                subjects = exam.subject;
            } else if (typeof exam.subject === 'string' && exam.subject) {
                subjects = [exam.subject];
            }

            setForm({
                id: exam.id,
                course_id: exam.course_id || "",
                // @ts-ignore
                shared_course_ids: exam.shared_course_ids || [],
                // @ts-ignore
                archive_course_ids: exam.archive_course_ids || [],
                title: exam.title ?? "",
                subject: subjects,
                chapter: exam.chapter || "",
                exam_type: exam.exam_type === "practice" ? "practice" : "live",
                duration_minutes: exam.duration_minutes != null ? String(exam.duration_minutes) : "60",
                total_marks: exam.total_marks != null ? String(exam.total_marks) : "",
                negative_mark_per_question:
                    exam.negative_mark_per_question != null
                    ? String(exam.negative_mark_per_question)
                    : "0",
                instructions: exam.instructions ?? "",
                time_window_start: exam.time_window_start ? toDhakaTimeISO(exam.time_window_start) : "",
                time_window_end: exam.time_window_end ? toDhakaTimeISO(exam.time_window_end) : "",
                is_published: exam.is_published ?? false,
                is_visible_on_free: exam.is_visible_on_free ?? true,
                restrict_solution: exam.restrict_solution ?? false,
                questions_json: "",
                questions_csv: "",
            });
        }
    }, [exam]);

    const { data: courses } = useQuery({
        queryKey: ["admin-courses-form"],
        queryFn: async () => {
            const { data, error } = await supabase.from("courses").select("id, name");
            if (error) throw error;
            return data || [];
        },
    });

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
        e.target.value = '';
    };

    const upsertExamMutation = useMutation({
        mutationFn: async (values: z.infer<typeof examSchema>) => {
          const parsed = examSchema.parse(values);

          const payload: Partial<Exam> = {
            course_id: isFreeMode ? null : (parsed.course_id || null),
            // @ts-ignore
            shared_course_ids: parsed.shared_course_ids,
            // @ts-ignore
            archive_course_ids: parsed.archive_course_ids,
            title: parsed.title,
            subject: parsed.subject,
            chapter: parsed.chapter || null,
            exam_type: parsed.exam_type,
            duration_minutes: Number(parsed.duration_minutes),
            total_marks: parsed.total_marks ? Number(parsed.total_marks) : null,
            negative_mark_per_question: parsed.negative_mark_per_question
              ? Number(parsed.negative_mark_per_question)
              : 0,
            instructions: parsed.instructions || null,
            time_window_start: parsed.time_window_start ? fromDhakaTimeToUTC(parsed.time_window_start) : null,
            time_window_end: parsed.time_window_end ? fromDhakaTimeToUTC(parsed.time_window_end) : null,
            is_published: parsed.is_published ?? false,
            is_visible_on_free: parsed.is_visible_on_free ?? true,
            restrict_solution: parsed.restrict_solution ?? false,
          };

          // Helper functions for questions (copied from original)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const normaliseQuestions = (input: Array<any>) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            const { data, errors } = Papa.parse(csv, {
              header: true,
              skipEmptyLines: true,
              newline: "",
            });

            if (errors.length > 0) {
              console.warn("CSV parse errors:", errors);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rows: any[] = [];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.forEach((row: any) => {
              // Expected headers: questions,option1,option2,option3,option4,option5,answer,explanation,type,section
              const qText = row["questions"];
              if (!qText) return;

              const o1 = row["option1"];
              const o2 = row["option2"];
              const o3 = row["option3"];
              const o4 = row["option4"];
              const answer = row["answer"];
              const explanation = row["explanation"];
              const type = row["type"];
              const section = row["section"];

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
            });

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
          queryClient.invalidateQueries({ queryKey: ["public-free-exams"] });
          queryClient.invalidateQueries({ queryKey: ["admin-archive-items"] });
          queryClient.invalidateQueries({ queryKey: ["global-metadata"] }); // Invalidate global metadata
          if (!exam) {
              setForm({
                course_id: "",
                shared_course_ids: [],
                archive_course_ids: [],
                title: "",
                subject: [],
                chapter: "",
                exam_type: "live",
                duration_minutes: "60",
                total_marks: "",
                negative_mark_per_question: "0",
                instructions: "",
                time_window_start: "",
                time_window_end: "",
                is_published: false,
                is_visible_on_free: true,
                restrict_solution: false,
                questions_json: "",
                questions_csv: "",
              });
          }
          onSuccess();
        },
        onError: (error: Error) => {
          toast({
            title: "Error saving exam",
            description: error.message ?? "Please check your input and try again",
            variant: "destructive",
          });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        upsertExamMutation.mutate(form);
    };

    return (
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
              {!isFreeMode && !isArchiveMode && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="course">Course (Optional)</Label>
                        {form.course_id && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-5 px-2 text-xs"
                                onClick={() => setForm(prev => ({ ...prev, course_id: "" }))}
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                    <Select
                      value={form.course_id || ""}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, course_id: value }))}
                    >
                      <SelectTrigger id="course">
                        <SelectValue placeholder="Select course (or leave empty for Public)" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses?.map((course: Pick<Course, "id" | "name">) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!form.course_id && <p className="text-[10px] text-muted-foreground">This exam will be public (no course restriction).</p>}
                  </div>
              )}

              {isArchiveMode && (
                  <div className="space-y-2 md:col-span-2">
                      <Label>Archive For Courses (Select one or more)</Label>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <MultiSelect
                          options={courses?.map((c: any) => ({ label: c.name, value: c.id })) || []}
                          selected={form.archive_course_ids}
                          onChange={(vals) => {
                              const first = vals.length > 0 ? vals[0] : "";
                              setForm(prev => ({
                                  ...prev,
                                  archive_course_ids: vals,
                                  course_id: prev.course_id || first
                              }));
                          }}
                          placeholder="Select courses..."
                      />
                      <p className="text-[10px] text-muted-foreground">
                          These exams will appear in the Archive section for selected courses.
                          (Primary course set to: {courses?.find(c => c.id === form.course_id)?.name || "None"})
                      </p>
                  </div>
              )}

              {!isFreeMode && !isArchiveMode && form.course_id && (
                  <div className="space-y-2">
                      <Label>Also Share With (Optional)</Label>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <MultiSelect
                          options={courses?.map((c: any) => ({ label: c.name, value: c.id })) || []}
                          selected={form.shared_course_ids}
                          onChange={(vals) => setForm(prev => ({ ...prev, shared_course_ids: vals }))}
                          placeholder="Select additional courses..."
                      />
                  </div>
              )}

              {!isArchiveMode && (
                  <div className="space-y-2">
                      <Label>Add to Archive of (Optional)</Label>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <MultiSelect
                          options={courses?.map((c: any) => ({ label: c.name, value: c.id })) || []}
                          selected={form.archive_course_ids}
                          onChange={(vals) => setForm(prev => ({ ...prev, archive_course_ids: vals }))}
                          placeholder="Select courses to archive for..."
                      />
                  </div>
              )}

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
                    options={globalMeta?.subject || []}
                    selected={form.subject}
                    onChange={(selected) => setForm((prev) => ({ ...prev, subject: selected }))}
                    onCreate={(val) => {
                         handleCreateMeta('subject', val);
                         setForm(prev => ({ ...prev, subject: [...prev.subject, val] }));
                    }}
                    placeholder="Select or Create subjects..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chapter">Chapter</Label>
                <CreatableSelect
                  options={globalMeta?.chapter || []}
                  value={form.chapter || ""}
                  onChange={(val) => setForm((prev) => ({ ...prev, chapter: val }))}
                  onCreate={(val) => {
                      handleCreateMeta('chapter', val);
                      setForm((prev) => ({ ...prev, chapter: val }));
                  }}
                  placeholder="Select or Create Chapter"
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
                <Label htmlFor="total_marks">Total Marks (Manual Override)</Label>
                <Input
                  id="total_marks"
                  value={form.total_marks}
                  onChange={(e) => setForm((prev) => ({ ...prev, total_marks: e.target.value }))}
                  placeholder="Ex: 100 (Optional)"
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

              {(isFreeMode || (!form.course_id)) && (
                  <div className="flex items-center gap-2 md:col-span-2">
                      <Switch
                          id="is_visible_on_free"
                          checked={form.is_visible_on_free}
                          onCheckedChange={(checked) =>
                              setForm((prev) => ({ ...prev, is_visible_on_free: checked }))
                          }
                      />
                      <Label htmlFor="is_visible_on_free">Show on "Free Exams" Page (Public)</Label>
                  </div>
              )}

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
                {onCancel && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onCancel}
                    disabled={upsertExamMutation.isPending}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
    );
};
