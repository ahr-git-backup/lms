import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Resource, Course } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SUBJECTS } from "@/lib/constants";
import { ChevronLeft, ChevronRight } from "lucide-react";

const resourceSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  subject: z.string().optional().or(z.literal("")),
  url: z.string().trim().optional().or(z.literal("")),
  resource_type: z.string().trim().min(1, "Type is required").max(100),
  course_id: z.string().optional().nullable(),
});

const PAGE_SIZE = 10;

const AdminResources = () => {
  const [form, setForm] = useState<z.infer<typeof resourceSchema>>({
    title: "",
    description: "",
    subject: "",
    url: "",
    resource_type: "PDF",
    course_id: null,
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const subjectFilter = searchParams.get("subject") || "all";
  const courseFilter = searchParams.get("course") || "all";
  const page = parseInt(searchParams.get("page") || "0");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const setPage = (newPage: number) => {
      setSearchParams(prev => {
          prev.set("page", newPage.toString());
          return prev;
      });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(searchQuery);
        if (searchQuery) setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const setCourseFilter = (course: string) => {
      setSearchParams(prev => {
          prev.set("course", course);
          prev.set("page", "0");
          return prev;
      });
  };

  const setSubjectFilter = (subject: string) => {
      setSearchParams(prev => {
          prev.set("subject", subject);
          prev.set("page", "0");
          return prev;
      });
  };

  useEffect(() => {
    document.title = "Admin – Resources – Atlas";
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

  const { data: resourcesData, isLoading } = useQuery({
    queryKey: ["admin-resources", subjectFilter, courseFilter, page, debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("resources")
        .select("*, course:courses(id, name)", { count: 'exact' })
        .order("created_at", { ascending: false });

      if (subjectFilter !== "all") {
        query = query.eq("subject", subjectFilter);
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

  const resources = resourcesData?.data || [];
  const totalCount = resourcesData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const resetForm = () => {
    setForm({
      id: undefined,
      title: "",
      description: "",
      subject: "",
      url: "",
      resource_type: "PDF",
      course_id: null,
    });
  };

  const upsertMutation = useMutation({
    mutationFn: async (values: z.infer<typeof resourceSchema>) => {
      const parsed = resourceSchema.parse(values);

      // Normalize URL: if missing protocol, prepend https://
      let url = parsed.url.trim();
      if (url && !/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }

      const payload: Partial<Resource> = {
        title: parsed.title,
        description: parsed.description || null,
        subject: parsed.subject || null,
        url,
        resource_type: parsed.resource_type,
        course_id: parsed.course_id || null,
      };

      if (parsed.id) {
        const { error } = await supabase
          .from("resources")
          .update(payload)
          .eq("id", parsed.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resources").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Resource saved" });
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving resource",
        description: error.message ?? "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Resource deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting resource",
        description: error.message ?? "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (resource: Resource) => {
    setForm({
      id: resource.id,
      title: resource.title ?? "",
      description: resource.description ?? "",
      subject: resource.subject ?? "",
      url: resource.url ?? "",
      resource_type: resource.resource_type ?? "PDF",
      course_id: resource.course_id ?? null,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate(form);
  };

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin: Resources</h1>
        <p className="text-sm text-muted-foreground">
          Upload and manage helpful links, PDFs, videos and other study materials.
        </p>
      </header>

      <Card className="border border-foreground/60">
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Edit resource" : "Create new resource"}
          </CardTitle>
          <CardDescription>
            Resources appear on the student Resources page, filtered by course.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resource_type">Type</Label>
              <Select
                value={form.resource_type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, resource_type: value }))}
              >
                <SelectTrigger id="resource_type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="Video">Video</SelectItem>
                  <SelectItem value="Link">Link</SelectItem>
                  <SelectItem value="Document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Select
                value={form.subject}
                onValueChange={(value) => setForm((prev) => ({ ...prev, subject: value }))}
              >
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={form.url}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2 md:max-w-sm">
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

            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit" size="sm" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending
                  ? "Saving..."
                  : form.id
                  ? "Update resource"
                  : "Create resource"}
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

      <Card className="border border-foreground/60">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">All resources</CardTitle>
              <CardDescription>Click a row to edit or use the delete button to remove it.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Select
                value={courseFilter}
                onValueChange={(v) => setCourseFilter(v)}
              >
                 <SelectTrigger className="w-full sm:w-[180px]">
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
                onValueChange={(v) => setSubjectFilter(v)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
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

              <Input
                placeholder="Search Title..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-[200px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !resources || resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resources created yet.</p>
          ) : (
            <>
            <div className="w-full overflow-x-auto rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map((resource: Resource) => (
                    <TableRow
                      key={resource.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => handleEdit(resource)}
                    >
                      <TableCell className="font-medium">{resource.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {resource.resource_type}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {resource.subject || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {resource.course?.name || "All courses"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {resource.url}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(resource.id);
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
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                     >
                         <ChevronLeft className="h-4 w-4" />
                         Previous
                     </Button>
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
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

export default AdminResources;
