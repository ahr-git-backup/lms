import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Announcement, Course } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PostEditor } from "@/components/PostEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";

const announcementSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().min(1, "Body is required").max(4000),
  course_id: z.string().optional().nullable(),
});

const PAGE_SIZE = 10;

const AdminAnnouncements = () => {
  const [form, setForm] = useState<z.infer<typeof announcementSchema>>({
    title: "",
    body: "",
    course_id: null,
  });
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Admin – Announcements – Atlas";
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

  const { data: announcementsData, isLoading } = useQuery({
    queryKey: ["admin-announcements", page],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("announcements")
        .select("*, course:courses(id, name)", { count: 'exact' })
        .order("published_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const announcements = announcementsData?.data || [];
  const totalCount = announcementsData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const resetForm = () => {
    setForm({
      id: undefined,
      title: "",
      body: "",
      course_id: null,
    });
    setIsFormVisible(false);
  };

  const upsertMutation = useMutation({
    mutationFn: async (values: z.infer<typeof announcementSchema>) => {
      const parsed = announcementSchema.parse(values);
      const payload: Partial<Announcement> = {
        title: parsed.title,
        body: parsed.body,
        course_id: parsed.course_id || null,
      };

      if (parsed.id) {
        const { error } = await supabase
          .from("announcements")
          .update(payload)
          .eq("id", parsed.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("announcements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Announcement saved" });
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving announcement",
        description: error.message ?? "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Announcement deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting announcement",
        description: error.message ?? "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (announcement: Announcement) => {
    setForm({
      id: announcement.id,
      title: announcement.title ?? "",
      body: announcement.body ?? "",
      course_id: announcement.course_id ?? null,
    });
    setIsFormVisible(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate(form);
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin: Announcements</h1>
          <p className="text-sm text-muted-foreground">
            Publish and update announcements for all students or specific courses.
          </p>
        </div>
        <Button onClick={() => {
            if (isFormVisible) {
                resetForm();
            } else {
                setIsFormVisible(true);
            }
        }} variant={isFormVisible ? "secondary" : "default"} className="shrink-0">
            {isFormVisible ? "Cancel" : "+ New Notice"}
        </Button>
      </header>

      {isFormVisible && (
        <Card className="border border-foreground/60 animate-in fade-in slide-in-from-top-4 duration-300">
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Edit announcement" : "Create new announcement"}
          </CardTitle>
          <CardDescription>
            Announcements appear on the student dashboard under the Announcements page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course_id">Course (optional)</Label>
              <Select
                value={form.course_id || "all"}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, course_id: value === "all" ? null : value }))
                }
              >
                <SelectTrigger id="course_id">
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courses (general)</SelectItem>
                  {courses?.map((course: Pick<Course, "id" | "name">) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="body">Body</Label>
              <PostEditor
                key={form.id || 'new'}
                initialValue={form.body}
                onChange={(val) => setForm((prev) => ({ ...prev, body: val }))}
              />
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit" size="sm" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending
                  ? "Saving..."
                  : form.id
                  ? "Update announcement"
                  : "Create announcement"}
              </Button>
              {form.id && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={resetForm}
                  disabled={upsertMutation.isPending}
                >
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      <Card className="border border-foreground/60">
        <CardHeader>
          <CardTitle className="text-base">All announcements</CardTitle>
          <CardDescription>Click a row to edit or use the delete button to remove it.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !announcements || announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements created yet.</p>
          ) : (
            <>
            <div className="w-full overflow-x-auto rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((announcement: Announcement) => (
                    <TableRow
                      key={announcement.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => handleEdit(announcement)}
                    >
                      <TableCell className="font-medium">{announcement.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {announcement.course?.name || "All courses"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(announcement.published_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(announcement.id);
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
        </CardContent>
      </Card>
    </section>
  );
};

export default AdminAnnouncements;
