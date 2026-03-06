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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { MultiSelect } from "@/components/ui/multi-select";

const externalExamSchema = z.object({
  id: z.string().optional(),
  course_id: z.string().nullable().optional(),
  title: z.string().trim().min(1, "Title is required"),
  external_exam_link: z.string().trim().min(1, "External Link is required").url("Must be a valid URL"),
  is_published: z.boolean().optional().default(false),
  is_archive: z.boolean().optional().default(false),
  is_readymade: z.boolean().optional().default(false),
});

interface ExternalExamFormProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exam?: any;
    onSuccess: () => void;
    onCancel?: () => void;
    isFreeMode?: boolean;
}

export const ExternalExamForm = ({ exam, onSuccess, onCancel, isFreeMode = false }: ExternalExamFormProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [form, setForm] = useState<z.infer<typeof externalExamSchema>>({
        course_id: "",
        title: "",
        external_exam_link: "",
        is_published: false,
        is_archive: false,
        is_readymade: false,
    });

    useEffect(() => {
        if (exam) {
            setForm({
                id: exam.id,
                course_id: exam.course_id || "",
                title: exam.title ?? "",
                external_exam_link: exam.external_exam_link || "",
                is_published: exam.is_published ?? false,
                is_archive: exam.is_archive ?? false,
                is_readymade: exam.is_readymade ?? false,
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

    const upsertExamMutation = useMutation({
        mutationFn: async (values: z.infer<typeof externalExamSchema>) => {
          const parsed = externalExamSchema.parse(values);

          const payload: Partial<Exam> = {
            course_id: isFreeMode ? null : (parsed.course_id || null),
            title: parsed.title,
            external_exam_link: parsed.external_exam_link,
            is_published: parsed.is_published ?? false,
            is_archive: parsed.is_archive ?? false,
            is_readymade: parsed.is_readymade ?? false,
            exam_type: "practice", // default to practice
            duration_minutes: 0,
            negative_mark_per_question: 0,
          };

          if (parsed.id) {
            const { error } = await supabase
              .from("exams")
              .update(payload)
              .eq("id", parsed.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("exams")
              .insert(payload);
            if (error) throw error;
          }
        },
        onSuccess: () => {
          toast({ title: "External Exam saved" });
          queryClient.invalidateQueries({ queryKey: ["admin-exams"] });
          queryClient.invalidateQueries({ queryKey: ["public-free-exams"] });
          queryClient.invalidateQueries({ queryKey: ["admin-archive-items"] });
          if (!exam) {
              setForm({
                course_id: "",
                title: "",
                external_exam_link: "",
                is_published: false,
                is_archive: false,
                is_readymade: false,
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
        <Card className="border border-foreground/60 mt-6">
          <CardHeader>
            <CardTitle className="text-base">
              {form.id ? "Edit External Exam" : "Create External Exam"}
            </CardTitle>
            <CardDescription>
              Create an exam that redirects students to an external URL. Students will not see that it is external.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              {!isFreeMode && (
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="ext_course">Course (Optional)</Label>
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
                      <SelectTrigger id="ext_course">
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
                  </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ext_title">Title</Label>
                <Input
                  id="ext_title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ext_link">External Exam Link</Label>
                <Input
                  id="ext_link"
                  value={form.external_exam_link}
                  onChange={(e) => setForm((prev) => ({ ...prev, external_exam_link: e.target.value }))}
                  placeholder="https://example.com/exam/123"
                  required
                />
              </div>

              <div className="flex items-center gap-2 md:col-span-2">
                <Switch
                  id="ext_is_published"
                  checked={form.is_published}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_published: checked }))
                  }
                />
                <Label htmlFor="ext_is_published">Exam is published / visible to students</Label>
              </div>

              <div className="flex items-center gap-2 md:col-span-2">
                <Switch
                  id="ext_is_archive"
                  checked={form.is_archive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_archive: checked }))
                  }
                />
                <Label htmlFor="ext_is_archive">Is Archive?</Label>
              </div>

              <div className="flex items-center gap-2 md:col-span-2">
                <Switch
                  id="ext_is_readymade"
                  checked={form.is_readymade}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_readymade: checked }))
                  }
                />
                <Label htmlFor="ext_is_readymade">Is Readymade Exam?</Label>
              </div>

              <div className="flex items-center gap-2 md:col-span-2 mt-4">
                <Button type="submit" size="sm" disabled={upsertExamMutation.isPending}>
                  {upsertExamMutation.isPending ? "Saving..." : form.id ? "Update External Exam" : "Create External Exam"}
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
