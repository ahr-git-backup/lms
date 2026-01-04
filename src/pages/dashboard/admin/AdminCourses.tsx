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
import { ChevronLeft, ChevronRight, Trash2, Ticket, Copy, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const demoContentSchema = z.object({
  type: z.enum(["video", "pdf", "note"]),
  title: z.string().min(1, "Title required"),
  url: z.string().url("Valid URL required"),
  is_locked: z.boolean().default(false),
});

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
  demo_content: z.array(demoContentSchema).optional().default([]),
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
    demo_content: [],
    image_url: "",
    bkash_number: "",
    nagad_number: "",
    contact_info: "",
    is_active: true,
    is_public: true,
  });
  const [page, setPage] = useState(0);
  const [isCouponDialogOpen, setIsCouponDialogOpen] = useState(false);
  const [selectedCourseForCoupon, setSelectedCourseForCoupon] = useState<Course | null>(null);
  const [couponCode, setCouponCode] = useState("");
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
      demo_content: [],
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        name: parsed.name,
        short_description: parsed.short_description || null,
        full_description: parsed.full_description || null,
        price: parsed.price ? Number(parsed.price) : null,
        what_you_get: parsed.what_you_get
          ? [parsed.what_you_get]
          : null,
        demo_content: parsed.demo_content,
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
      demo_content: course.demo_content ?? [],
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

  const generateCouponMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourseForCoupon) return;
      const code = couponCode || `${selectedCourseForCoupon.name?.substring(0, 3).toUpperCase()}-FREE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const { error } = await supabase.from("promo_codes").insert({
        code: code,
        discount_type: "percentage",
        discount_amount: 100,
        course_id: selectedCourseForCoupon.id,
        is_active: true,
        usage_limit: 1 // Default to 1 use for safety, user can change in promo page
      });

      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      toast({
        title: "Free Coupon Created",
        description: `Code: ${code} (100% Off, Single Use)`
      });
      setIsCouponDialogOpen(false);
      setCouponCode("");
      setSelectedCourseForCoupon(null);
    },
    onError: (error) => {
      toast({
        title: "Error creating coupon",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const openCouponDialog = (course: Course, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedCourseForCoupon(course);
      const randomCode = `${course.name?.replace(/\s+/g, '').substring(0, 4).toUpperCase()}-FREE-${Math.floor(1000 + Math.random() * 9000)}`;
      setCouponCode(randomCode);
      setIsCouponDialogOpen(true);
  };

  return (
    <section className="space-y-6">
      <Dialog open={isCouponDialogOpen} onOpenChange={setIsCouponDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Generate Free Coupon</DialogTitle>
                <DialogDescription>
                    Create a 100% off coupon for <strong>{selectedCourseForCoupon?.name}</strong>.
                    <br/>This will create a single-use promo code.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Coupon Code</Label>
                    <div className="flex gap-2">
                        <Input
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            placeholder="ENTER-CODE"
                        />
                        <Button size="icon" variant="outline" onClick={() => {
                             navigator.clipboard.writeText(couponCode);
                             toast({ title: "Copied to clipboard" });
                        }}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Default: 100% discount, 1 usage limit. You can edit this later in "Promo Codes" page.
                    </p>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsCouponDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => generateCouponMutation.mutate()} disabled={generateCouponMutation.isPending}>
                    {generateCouponMutation.isPending ? "Creating..." : "Create Coupon"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="content">Curriculum</TabsTrigger>
                <TabsTrigger value="demos">Demo Content</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
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
                </div>
              </TabsContent>

              <TabsContent value="description" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="short_description">Short description</Label>
                  <Textarea
                    id="short_description"
                    rows={2}
                    value={form.short_description}
                    onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_description">Full description</Label>
                  <Textarea
                    id="full_description"
                    rows={8}
                    value={form.full_description}
                    onChange={(e) => setForm((prev) => ({ ...prev, full_description: e.target.value }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="content" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="what_you_get">
                    What students get (Markdown Supported)
                  </Label>
                  <Textarea
                    id="what_you_get"
                    rows={15}
                    value={form.what_you_get}
                    onChange={(e) => setForm((prev) => ({ ...prev, what_you_get: e.target.value }))}
                    placeholder={"# Markdown Supported\n- Paste your full passage here\n- Bullet points work too\n- **Bold text** supported"}
                  />
                  <p className="text-xs text-muted-foreground">You can paste a Markdown passage here. It will be rendered nicely on the course details page.</p>
                </div>
              </TabsContent>

              <TabsContent value="demos" className="space-y-4">
                <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold">Preview Content</h4>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                const newContent = [
                                    ...(form.demo_content || []),
                                    { type: "video" as const, title: "", url: "", is_locked: false }
                                ];
                                setForm({ ...form, demo_content: newContent });
                            }}
                        >
                            <Plus className="w-4 h-4 mr-1" /> Add Item
                        </Button>
                    </div>

                    {form.demo_content?.length === 0 && (
                         <div className="text-center py-8 text-muted-foreground text-sm">
                             No demo content added. Add videos or PDFs for users to preview.
                         </div>
                    )}

                    <div className="space-y-3">
                        {form.demo_content?.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-start border p-3 rounded-md bg-background">
                                <div className="grid gap-2 flex-1">
                                    <div className="flex gap-2">
                                        <div className="w-1/4">
                                             <Label className="text-xs">Type</Label>
                                             <Select
                                                value={item.type}
                                                onValueChange={(val) => {
                                                    const updated = [...(form.demo_content || [])];
                                                    updated[idx] = { ...updated[idx], type: val as "video" | "pdf" | "note" };
                                                    setForm({ ...form, demo_content: updated });
                                                }}
                                             >
                                                <SelectTrigger className="h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="video">Video</SelectItem>
                                                    <SelectItem value="pdf">PDF</SelectItem>
                                                    <SelectItem value="note">Note</SelectItem>
                                                </SelectContent>
                                             </Select>
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs">Title</Label>
                                            <Input
                                                value={item.title}
                                                onChange={(e) => {
                                                    const updated = [...(form.demo_content || [])];
                                                    updated[idx] = { ...updated[idx], title: e.target.value };
                                                    setForm({ ...form, demo_content: updated });
                                                }}
                                                className="h-8"
                                                placeholder="e.g. Intro Class"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                         <Label className="text-xs">URL</Label>
                                         <Input
                                            value={item.url}
                                            onChange={(e) => {
                                                const updated = [...(form.demo_content || [])];
                                                updated[idx] = { ...updated[idx], url: e.target.value };
                                                setForm({ ...form, demo_content: updated });
                                            }}
                                            className="h-8"
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive mt-6"
                                    onClick={() => {
                                         const updated = form.demo_content?.filter((_, i) => i !== idx);
                                         setForm({ ...form, demo_content: updated });
                                    }}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
              </TabsContent>

              <div className="mt-6 flex items-center gap-2">
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending ? "Saving..." : form.id ? "Update Course" : "Create Course"}
                </Button>
                {form.id && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    disabled={upsertMutation.isPending}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </Tabs>
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
                      <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Generate Free Coupon"
                            onClick={(e) => openCouponDialog(course, e)}
                          >
                             <Ticket className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm("Delete this course? This cannot be undone.")) {
                                deleteMutation.mutate(course.id);
                              }
                            }}
                          >
                             <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                      </div>
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
