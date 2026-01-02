import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Course } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

const courseSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  short_description: z.string().trim().max(300).optional().or(z.literal("")),
  full_description: z.string().trim().max(4000).optional().or(z.literal("")),
  price: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || !isNaN(Number(val)), { message: "Price must be a number" }),
  what_you_get: z
    .string()
    .trim()
    .max(10000)
    .optional()
    .or(z.literal("")),
  image_url: z.string().trim().max(500).optional().or(z.literal("")),
  bkash_number: z.string().trim().max(50).optional().or(z.literal("")),
  nagad_number: z.string().trim().max(50).optional().or(z.literal("")),
  contact_info: z.string().trim().max(500).optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true),
  is_public: z.boolean().optional().default(true),
});

const PAGE_SIZE = 10;

const AdminCourses = () => {
  const [form, setForm] = useState<z.infer<typeof courseSchema>>({
    name: "",
    short_description: "",
    full_description: "",
    price: "",
    what_you_get: "",
    image_url: "",
    bkash_number: "",
    nagad_number: "",
    contact_info: "",
    is_active: true,
    is_public: true,
  });
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Admin   Courses   Udvash LMS";
  }, []);

  const { data: coursesData, isLoading } = useQuery({
    queryKey: ["admin-courses", page],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("courses")
        .select("*", { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const courses = coursesData?.data || [];
  const totalCount = coursesData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const resetForm = () => {
    setForm({
      name: "",
      short_description: "",
      full_description: "",
      price: "",
      what_you_get: "",
      image_url: "",
      bkash_number: "",
      nagad_number: "",
      contact_info: "",
      is_active: true,
      is_public: true,
    });
  };

  const upsertMutation = useMutation({
    mutationFn: async (values: z.infer<typeof courseSchema>) => {
      const parsed = courseSchema.parse(values);
      const payload: Partial<Course> = {
        name: parsed.name,
        short_description: parsed.short_description || null,
        full_description: parsed.full_description || null,
        price: parsed.price ? Number(parsed.price) : null,
        what_you_get: parsed.what_you_get
          ? [parsed.what_you_get]
          : null,
        image_url: parsed.image_url || null,
        bkash_number: parsed.bkash_number || null,
        nagad_number: parsed.nagad_number || null,
        contact_info: parsed.contact_info || null,
        is_active: parsed.is_active ?? true,
        is_public: parsed.is_public ?? true,
      };

      if (parsed.id) {
        const { error } = await supabase
          .from("courses")
          .update(payload)
          .eq("id", parsed.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Course saved" });
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving course",
        description: error.message ?? "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Course deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting course",
        description: error.message ?? "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (course: Course) => {
    setForm({
      id: course.id,
      name: course.name ?? "",
      short_description: course.short_description ?? "",
      full_description: course.full_description ?? "",
      price: course.price != null ? String(course.price) : "",
      what_you_get: Array.isArray(course.what_you_get) ? course.what_you_get.join("\n") : "",
      image_url: course.image_url ?? "",
      bkash_number: course.bkash_number ?? "",
      nagad_number: course.nagad_number ?? "",
      contact_info: course.contact_info ?? "",
      is_active: course.is_active ?? true,
      is_public: course.is_public ?? true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate(form);
  };

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin: Courses</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage courses shown on the public site and dashboard.
        </p>
      </header>

      <Card className="border border-foreground/60">
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Edit course" : "Create new course"}
          </CardTitle>
          <CardDescription>
            Control visibility, descriptions, pricing, and the "what you get" bullet list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (৳)</Label>
              <Input
                id="price"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="Ex: 3000"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="short_description">Short description</Label>
              <Textarea
                id="short_description"
                rows={2}
                value={form.short_description}
                onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="full_description">Full description</Label>
              <Textarea
                id="full_description"
                rows={4}
                value={form.full_description}
                onChange={(e) => setForm((prev) => ({ ...prev, full_description: e.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="what_you_get">
                What students get (Markdown Supported)
              </Label>
              <Textarea
                id="what_you_get"
                rows={10}
                value={form.what_you_get}
                onChange={(e) => setForm((prev) => ({ ...prev, what_you_get: e.target.value }))}
                placeholder={"# Markdown Supported\n- Paste your full passage here\n- Bullet points work too\n- **Bold text** supported"}
              />
              <p className="text-xs text-muted-foreground">You can paste a Markdown passage here. It will be rendered nicely.</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="image_url">Course image URL (optional, 16:9)</Label>
              <Input
                id="image_url"
                value={form.image_url}
                onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bkash_number">bKash number (optional)</Label>
              <Input
                id="bkash_number"
                value={form.bkash_number}
                onChange={(e) => setForm((prev) => ({ ...prev, bkash_number: e.target.value }))}
                placeholder="01XXXXXXXXX"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nagad_number">Nagad number (optional)</Label>
              <Input
                id="nagad_number"
                value={form.nagad_number}
                onChange={(e) => setForm((prev) => ({ ...prev, nagad_number: e.target.value }))}
                placeholder="01XXXXXXXXX"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contact_info">Contact info for payment confirmation (optional)</Label>
              <Input
                id="contact_info"
                value={form.contact_info}
                onChange={(e) => setForm((prev) => ({ ...prev, contact_info: e.target.value }))}
                placeholder="e.g. Telegram @handle or phone number"
              />
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label htmlFor="is_active">Course is active / visible to students</Label>
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <Switch
                id="is_public"
                checked={form.is_public}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_public: checked }))
                }
              />
              <Label htmlFor="is_public">Publicly listed (Show on homepage catalog)</Label>
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit" size="sm" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Saving..." : form.id ? "Update course" : "Create course"}
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
          <CardTitle className="text-base">All courses</CardTitle>
          <CardDescription>
            These courses appear on the public site and drive enrollments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading courses...</div>
          ) : !courses || courses.length === 0 ? (
            <div className="text-sm text-muted-foreground">No courses defined yet.</div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Public</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course: Course) => (
                  <TableRow key={course.id} className="cursor-pointer" onClick={() => handleEdit(course)}>
                    <TableCell className="font-medium">{course.name}</TableCell>
                    <TableCell>
                      {course.price != null ? `৳${course.price}` : <span className="text-xs text-muted-foreground">Not set</span>}
                    </TableCell>
                    <TableCell>
                      {course.is_public !== false ? "Yes" : <span className="text-xs text-muted-foreground">No</span>}
                    </TableCell>
                    <TableCell>
                      {course.is_active ? (
                        <span className="text-xs">Active</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Delete this course? This cannot be undone.")) {
                            deleteMutation.mutate(course.id);
                          }
                        }}
                      >
                         <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

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

export default AdminCourses;
