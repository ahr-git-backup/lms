import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Course, Class } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, Video, Calendar, Clock, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { toDhakaTimeISO, fromDhakaTimeToUTC } from "@/lib/dateUtils";
import { SUBJECTS } from "@/lib/constants";
import { MultiSelect } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";

const classSchema = z.object({
  id: z.string().optional(),
  course_id: z.string().min(1, "Course is required"),
  shared_course_ids: z.array(z.string()).default([]),
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

const PAGE_SIZE = 10;

const AdminClasses = () => {
  const [form, setForm] = useState<z.infer<typeof classSchema>>({
    course_id: "",
    shared_course_ids: [],
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
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");

  useEffect(() => {
      const timer = setTimeout(() => {
          setDebouncedSearch(searchQuery);
          if (searchQuery) setPage(0);
      }, 500);
      return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  useEffect(() => {
    document.title = "Admin Classes – Atlas";
  }, []);

  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: classesData, isLoading } = useQuery({
    queryKey: ["admin-classes", page, debouncedSearch, subjectFilter, courseFilter],
    queryFn: async () => {
      let query = supabase
        .from("classes")
        .select("*, course:courses(name)", { count: 'exact' })
        .order("start_at", { ascending: false });

      if (subjectFilter !== "all") {
        query = query.contains("subject", [subjectFilter]);
      }
      if (courseFilter !== "all") {
          query = query.eq("course_id", courseFilter);
      }
      if (debouncedSearch) {
        query = query.ilike("title", `%${debouncedSearch}%`);
      }

      const { data, error, count } = await query
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const classes = classesData?.data || [];
  const totalCount = classesData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const upsertClassMutation = useMutation({
    mutationFn: async (values: z.infer<typeof classSchema>) => {
      const parsed = classSchema.parse(values);
      const payload = {
        course_id: parsed.course_id,
        // @ts-ignore
        shared_course_ids: parsed.shared_course_ids,
        title: parsed.title,
        topic: parsed.topic || null,
        subject: parsed.subject, // Now an array
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
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving class",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Class deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertClassMutation.mutate(form);
  };

  const resetForm = () => {
    setForm({
      course_id: "",
      shared_course_ids: [],
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
  };

  const handleEdit = (cls: any) => {
    // Handle subject being array or string (legacy)
    let subjects: string[] = [];
    if (Array.isArray(cls.subject)) {
        subjects = cls.subject;
    } else if (typeof cls.subject === 'string' && cls.subject) {
        subjects = [cls.subject];
    }

    setForm({
      id: cls.id,
      course_id: cls.course_id,
      // @ts-ignore
      shared_course_ids: cls.shared_course_ids || [],
      title: cls.title,
      topic: cls.topic || "",
      subject: subjects,
      start_at: toDhakaTimeISO(cls.start_at),
      end_at: toDhakaTimeISO(cls.end_at),
      video_url: cls.video_url || "",
      notes_url: cls.notes_url || "",
      class_type: cls.class_type as "live" | "recorded",
      button_text: cls.button_text || "",
      button_url: cls.button_url || "",
    });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin: Class Schedule</h1>
        <p className="text-sm text-muted-foreground">Manage live and recorded classes.</p>
      </header>

      <div className="grid gap-6">
        <Card className="border border-foreground/60 w-full overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">{form.id ? "Edit Class" : "Schedule New Class"}</CardTitle>
            <CardDescription>
              Set class timings in Dhaka Time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 min-w-0">
                <Label htmlFor="course">Course</Label>
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
                <Label htmlFor="video_url">Video URL (Zoom/YouTube/Drive)</Label>
                <Input
                  id="video_url"
                  value={form.video_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, video_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2 min-w-0">
                <Label htmlFor="notes_url">Notes URL (PDF/Drive)</Label>
                <Input
                  id="notes_url"
                  value={form.notes_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2 min-w-0">
                <Label htmlFor="button_text">Special Button Text (Optional)</Label>
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
                {form.id && (
                  <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Classes List */}
        <div className="space-y-4">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <h2 className="text-lg font-semibold">Scheduled Classes</h2>
                 <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Select
                        value={courseFilter}
                        onValueChange={(v) => {
                            setCourseFilter(v);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Course" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Courses</SelectItem>
                            {courses?.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={subjectFilter}
                        onValueChange={(v) => {
                            setSubjectFilter(v);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Subject" />
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
                     <Input
                        placeholder="Search Title..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full sm:w-[200px]"
                     />
                 </div>
             </div>

             {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
             ) : !classes || classes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No classes found.</div>
             ) : (
                <>
                {/* Desktop Table */}
                <div className="hidden md:block rounded-md border border-border/60 bg-card overflow-hidden overflow-x-auto w-full">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Course</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Start Time</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classes.map((cls: Class) => (
                                <TableRow key={cls.id}>
                                    <TableCell className="font-medium whitespace-nowrap">{cls.course?.name}</TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={cls.title}>
                                        <div className="font-semibold">{cls.title}</div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {Array.isArray(cls.subject) && cls.subject.map((s: string) => (
                                                <Badge key={s} variant="outline" className="text-[10px] py-0 h-4">{s}</Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="capitalize">{cls.class_type}</TableCell>
                                    <TableCell className="whitespace-nowrap text-xs">
                                        {new Date(cls.start_at).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(cls)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            {isAdmin && (
                                              <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-8 w-8 text-destructive"
                                                  onClick={() => {
                                                      if (confirm("Delete this class?")) deleteClassMutation.mutate(cls.id);
                                                  }}
                                              >
                                                  <Trash2 className="h-4 w-4" />
                                              </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden grid gap-4">
                    {classes.map((cls: Class) => (
                        <Card key={cls.id} className="w-full">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="space-y-1 min-w-0">
                                        <div className="text-xs font-mono uppercase text-muted-foreground truncate">{cls.course?.name}</div>
                                        <div className="font-semibold leading-tight break-words">{cls.title}</div>
                                    </div>
                                    <div className={`text-[10px] px-2 py-1 rounded-full border uppercase tracking-wider shrink-0 ${cls.class_type === 'live' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-secondary text-secondary-foreground border-transparent'}`}>
                                        {cls.class_type}
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(cls.start_at).toLocaleString()}
                                </div>
                                <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                                     <Button size="sm" variant="outline" className="h-8" onClick={() => handleEdit(cls)}>
                                        Edit
                                    </Button>
                                    {isAdmin && (
                                      <Button
                                          size="sm"
                                          variant="destructive"
                                          className="h-8"
                                          onClick={() => {
                                              if (confirm("Delete this class?")) deleteClassMutation.mutate(cls.id);
                                          }}
                                      >
                                          Delete
                                      </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between pt-4">
                     <div className="text-xs text-muted-foreground">
                         Page {page + 1} of {totalPages || 1} ({totalCount} items)
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
      </div>
    </div>
  );
};

export default AdminClasses;
