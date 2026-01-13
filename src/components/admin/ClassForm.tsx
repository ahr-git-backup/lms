import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Course } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { fromDhakaTimeToUTC, toDhakaTimeISO } from "@/lib/dateUtils";
import { SUBJECTS } from "@/lib/constants";
import { MultiSelect } from "@/components/ui/multi-select";

const classSchema = z.object({
  id: z.string().optional(),
  course_id: z.string().min(1, "Course is required"),
  shared_course_ids: z.array(z.string()).default([]),
  archive_course_ids: z.array(z.string()).default([]),
  title: z.string().trim().min(1, "Title is required"),
  topic: z.string().trim().optional().or(z.literal("")),
  subject: z.array(z.string()).default([]),
  start_at: z.string().min(1, "Start time is required"),
  end_at: z.string().min(1, "End time is required"),
  video_url: z.string().trim().optional().or(z.literal("")),
  notes_url: z.string().trim().optional().or(z.literal("")),
  class_type: z.enum(["live", "recorded"]).default("live"),
  button_text: z.string().trim().optional().or(z.literal("")),
  button_url: z.string().trim().optional().or(z.literal("")),
});

interface ClassFormProps {
    classItem?: any;
    onSuccess: () => void;
    onCancel?: () => void;
    isArchiveMode?: boolean;
}

export const ClassForm = ({ classItem, onSuccess, onCancel, isArchiveMode = false }: ClassFormProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [form, setForm] = useState<z.infer<typeof classSchema>>({
        course_id: "",
        shared_course_ids: [],
        archive_course_ids: [],
        title: "",
        topic: "",
        subject: [],
        start_at: "",
        end_at: "",
        video_url: "",
        notes_url: "",
        class_type: "live",
        button_text: "",
        button_url: "",
    });

    useEffect(() => {
        if (classItem) {
            let subjects: string[] = [];
            if (Array.isArray(classItem.subject)) {
                subjects = classItem.subject;
            } else if (typeof classItem.subject === 'string' && classItem.subject) {
                subjects = [classItem.subject];
            }

            setForm({
                id: classItem.id,
                course_id: classItem.course_id,
                // @ts-ignore
                shared_course_ids: classItem.shared_course_ids || [],
                // @ts-ignore
                archive_course_ids: classItem.archive_course_ids || [],
                title: classItem.title,
                topic: classItem.topic || "",
                subject: subjects,
                start_at: toDhakaTimeISO(classItem.start_at),
                end_at: toDhakaTimeISO(classItem.end_at),
                video_url: classItem.video_url || "",
                notes_url: classItem.notes_url || "",
                class_type: classItem.class_type as "live" | "recorded",
                button_text: classItem.button_text || "",
                button_url: classItem.button_url || "",
            });
        }
    }, [classItem]);

    const { data: courses } = useQuery({
        queryKey: ["admin-courses-form"],
        queryFn: async () => {
            const { data, error } = await supabase.from("courses").select("id, name");
            if (error) throw error;
            return data || [];
        },
    });

    const upsertClassMutation = useMutation({
        mutationFn: async (values: z.infer<typeof classSchema>) => {
            const parsed = classSchema.parse(values);
            const payload = {
                course_id: parsed.course_id,
                // @ts-ignore
                shared_course_ids: parsed.shared_course_ids,
                // @ts-ignore
                archive_course_ids: parsed.archive_course_ids,
                title: parsed.title,
                topic: parsed.topic || null,
                subject: parsed.subject,
                start_at: fromDhakaTimeToUTC(parsed.start_at),
                end_at: fromDhakaTimeToUTC(parsed.end_at),
                video_url: parsed.video_url || null,
                notes_url: parsed.notes_url || null,
                class_type: parsed.class_type,
                button_text: parsed.button_text || null,
                button_url: parsed.button_url || null,
            };

            if (parsed.id) {
                const { error } = await supabase.from("classes").update(payload).eq("id", parsed.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("classes").insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast({ title: "Class saved successfully" });
            queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
            queryClient.invalidateQueries({ queryKey: ["admin-archive-items"] });
            if (!classItem) {
                setForm({
                    course_id: "",
                    shared_course_ids: [],
                    archive_course_ids: [],
                    title: "",
                    topic: "",
                    subject: [],
                    start_at: "",
                    end_at: "",
                    video_url: "",
                    notes_url: "",
                    class_type: "live",
                    button_text: "",
                    button_url: "",
                });
            }
            onSuccess();
        },
        onError: (error: Error) => {
            toast({
                title: "Error saving class",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        upsertClassMutation.mutate(form);
    };

    return (
        <Card className="border border-foreground/60 w-full overflow-hidden">
            <CardHeader>
                <CardTitle className="text-base">{form.id ? "Edit Class" : "Schedule New Class"}</CardTitle>
                <CardDescription>Set class timings in Dhaka Time.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="course">Primary Course</Label>
                        <Select
                            value={form.course_id}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, course_id: val }))}
                        >
                            <SelectTrigger id="course" className="w-full">
                                <SelectValue placeholder="Select Course" />
                            </SelectTrigger>
                            <SelectContent>
                                {courses?.map((c: Pick<Course, "id" | "name">) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="class_type">Type</Label>
                        <Select
                            value={form.class_type}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, class_type: val as "live" | "recorded" }))}
                        >
                            <SelectTrigger id="class_type" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="live">Live Class</SelectItem>
                                <SelectItem value="recorded">Recorded Class</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {form.course_id && (
                        <div className="space-y-2 min-w-0">
                            <Label>Also Share With (Optional)</Label>
                            <MultiSelect
                                options={courses?.map((c: any) => ({ label: c.name, value: c.id })) || []}
                                selected={form.shared_course_ids}
                                onChange={(vals) => setForm(prev => ({ ...prev, shared_course_ids: vals }))}
                                placeholder="Select additional courses..."
                            />
                        </div>
                    )}

                    <div className="space-y-2 min-w-0">
                        <Label>Add to Archive of (Optional)</Label>
                        <MultiSelect
                            options={courses?.map((c: any) => ({ label: c.name, value: c.id })) || []}
                            selected={form.archive_course_ids}
                            onChange={(vals) => setForm(prev => ({ ...prev, archive_course_ids: vals }))}
                            placeholder="Select courses to archive for..."
                        />
                    </div>

                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            value={form.title}
                            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="subject">Subjects</Label>
                        <MultiSelect
                            options={SUBJECTS.map(s => ({ label: s, value: s }))}
                            selected={form.subject}
                            onChange={(selected) => setForm((prev) => ({ ...prev, subject: selected }))}
                            placeholder="Select subjects..."
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2 min-w-0">
                        <Label htmlFor="topic">Topic (Optional)</Label>
                        <Input
                            id="topic"
                            value={form.topic}
                            onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="start_at">Start Time</Label>
                        <Input
                            id="start_at"
                            type="datetime-local"
                            value={form.start_at}
                            onChange={(e) => setForm((prev) => ({ ...prev, start_at: e.target.value }))}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="end_at">End Time</Label>
                        <Input
                            id="end_at"
                            type="datetime-local"
                            value={form.end_at}
                            onChange={(e) => setForm((prev) => ({ ...prev, end_at: e.target.value }))}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="video_url">Video URL</Label>
                        <Input
                            id="video_url"
                            value={form.video_url}
                            onChange={(e) => setForm((prev) => ({ ...prev, video_url: e.target.value }))}
                            placeholder="https://..."
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="notes_url">Notes URL</Label>
                        <Input
                            id="notes_url"
                            value={form.notes_url}
                            onChange={(e) => setForm((prev) => ({ ...prev, notes_url: e.target.value }))}
                            placeholder="https://..."
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="button_text">Special Button Text</Label>
                        <Input
                            id="button_text"
                            value={form.button_text}
                            onChange={(e) => setForm((prev) => ({ ...prev, button_text: e.target.value }))}
                            placeholder="e.g. Join Zoom"
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="button_url">Special Button URL</Label>
                        <Input
                            id="button_url"
                            value={form.button_url}
                            onChange={(e) => setForm((prev) => ({ ...prev, button_url: e.target.value }))}
                            placeholder="https://..."
                            className="w-full"
                        />
                    </div>

                    <div className="flex items-center gap-2 md:col-span-2 pt-2">
                        <Button type="submit" size="sm" disabled={upsertClassMutation.isPending}>
                            {upsertClassMutation.isPending ? "Saving..." : form.id ? "Update Class" : "Create Class"}
                        </Button>
                        {onCancel && (
                            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};
