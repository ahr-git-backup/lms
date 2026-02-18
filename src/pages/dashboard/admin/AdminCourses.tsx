import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PostEditor } from "@/components/PostEditor";
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
import { ChevronLeft, ChevronRight, Trash2, Ticket, Copy, Plus, X, Eye, Edit2, ExternalLink } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { MultiSelect, Option } from "@/components/ui/multi-select";
import { ImageUploader } from "@/components/ui/image-uploader";

const demoContentSchema = z.object({
  title: z.string().min(1, "Title required"),
  video_url: z.string().trim().optional().or(z.literal("")),
  note_url: z.string().trim().optional().or(z.literal("")),
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
  original_price: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || !isNaN(Number(val)), { message: "Original Price must be a number" }),
  what_you_get: z
    .string()
    .trim()
    .max(10000)
    .optional()
    .or(z.literal("")),
  demo_content: z.array(demoContentSchema).optional().default([]),
  image_url: z.string().trim().max(500).optional().or(z.literal("")),
  video_url: z.string().trim().optional().or(z.literal("")),
  bkash_number: z.string().trim().max(50).optional().or(z.literal("")),
  nagad_number: z.string().trim().max(50).optional().or(z.literal("")),
  contact_info: z.string().trim().max(500).optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true),
  is_public: z.boolean().optional().default(true),
  category: z.array(z.string()).default([]),
  sub_category: z.array(z.string()).default([]),
  priority: z.number().optional().default(0),
  linked_course_ids: z.array(z.string()).default([]),
});

const PAGE_SIZE = 10;

const AdminCourses = () => {
  const [form, setForm] = useState<z.infer<typeof courseSchema>>({
    name: "",
    short_description: "",
    full_description: "",
    price: "",
    original_price: "",
    what_you_get: "",
    demo_content: [],
    image_url: "",
    video_url: "",
    bkash_number: "",
    nagad_number: "",
    contact_info: "",
    is_active: true,
    is_public: true,
    category: [],
    sub_category: [],
    priority: 0,
    linked_course_ids: [],
  });
  const [page, setPage] = useState(0);
  const [isCouponDialogOpen, setIsCouponDialogOpen] = useState(false);
  const [selectedCourseForCoupon, setSelectedCourseForCoupon] = useState<Course | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [activeTab, setActiveTab] = useState("basic");

  // Local state for dropdown options (will be populated from DB)
  const [existingCategories, setExistingCategories] = useState<Option[]>([]);
  const [existingSubCategories, setExistingSubCategories] = useState<Option[]>([]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Admin – Courses – Atlas";
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

  // Fetch all courses for the linked courses dropdown
  const { data: allCoursesList } = useQuery({
      queryKey: ["admin-all-courses-list"],
      queryFn: async () => {
          const { data } = await supabase.from("courses").select("id, name");
          return data?.map(c => ({ label: c.name, value: c.id })) || [];
      }
  });

  // Fetch unique categories and subcategories for the filters
  useQuery({
    queryKey: ["admin-course-tags"],
    queryFn: async () => {
        const { data, error } = await supabase
            .from("courses")
            .select("category, sub_category");
        if (error) return null;

        const cats = new Set<string>();
        const subs = new Set<string>();

        data?.forEach((row: any) => {
            if (Array.isArray(row.category)) row.category.forEach((c: string) => cats.add(c));
            // Handle legacy single string values if migration missed them or for safety
            else if (typeof row.category === 'string') cats.add(row.category);

            if (Array.isArray(row.sub_category)) row.sub_category.forEach((s: string) => subs.add(s));
             else if (typeof row.sub_category === 'string') subs.add(row.sub_category);
        });

        setExistingCategories(Array.from(cats).map(c => ({ label: c, value: c })));
        setExistingSubCategories(Array.from(subs).map(s => ({ label: s, value: s })));
        return null;
    }
  });


  // Fetch classes for the current editing course to display in Syllabus tab
  const { data: linkedClasses } = useQuery({
    queryKey: ["admin-course-classes", form.id],
    queryFn: async () => {
        if (!form.id) return [];
        const { data, error } = await supabase
            .from("classes")
            .select("id, title, class_type, start_at")
            .eq("course_id", form.id)
            .order("start_at", { ascending: true });
        if (error) throw error;
        return data;
    },
    enabled: !!form.id
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
      original_price: "",
      what_you_get: "",
      demo_content: [],
      image_url: "",
      bkash_number: "",
      nagad_number: "",
      contact_info: "",
      is_active: true,
      is_public: true,
      category: [],
      sub_category: [],
      priority: 0,
      linked_course_ids: [],
    });
    setActiveTab("basic");
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
        original_price: parsed.original_price ? Number(parsed.original_price) : null,
        what_you_get: parsed.what_you_get
          ? [parsed.what_you_get]
          : null,
        demo_content: parsed.demo_content,
        image_url: parsed.image_url || null,
        video_url: parsed.video_url || null,
        bkash_number: parsed.bkash_number || null,
        nagad_number: parsed.nagad_number || null,
        contact_info: parsed.contact_info || null,
        is_active: parsed.is_active ?? true,
        is_public: parsed.is_public ?? true,
        category: parsed.category,
        sub_category: parsed.sub_category,
        priority: parsed.priority ?? 0,
        linked_course_ids: parsed.linked_course_ids,
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
      queryClient.invalidateQueries({ queryKey: ["admin-course-tags"] }); // Refresh tags
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
    // Handle array or string for category/sub_category legacy compatibility
    const cats = Array.isArray(course.category)
        ? course.category
        : (typeof course.category === 'string' ? [course.category] : []);

    const subs = Array.isArray(course.sub_category)
        ? course.sub_category
        : (typeof course.sub_category === 'string' ? [course.sub_category] : []);

    setForm({
      id: course.id,
      name: course.name ?? "",
      short_description: course.short_description ?? "",
      full_description: course.full_description ?? "",
      price: course.price != null ? String(course.price) : "",
      original_price: course.original_price != null ? String(course.original_price) : "",
      what_you_get: Array.isArray(course.what_you_get) ? course.what_you_get.join("\n") : "",
      demo_content: course.demo_content ?? [],
      image_url: course.image_url ?? "",
      // @ts-ignore
      video_url: course.video_url ?? "",
      bkash_number: course.bkash_number ?? "",
      nagad_number: course.nagad_number ?? "",
      contact_info: course.contact_info ?? "",
      is_active: course.is_active ?? true,
      is_public: course.is_public ?? true,
      category: cats,
      sub_category: subs,
      priority: course.priority ?? 0,
      // @ts-ignore
      linked_course_ids: course.linked_course_ids || [],
    });
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleCreateCategory = (val: string) => {
      if (!existingCategories.find(c => c.value === val)) {
          setExistingCategories(prev => [...prev, { label: val, value: val }]);
      }
      setForm(prev => ({ ...prev, category: [...prev.category, val] }));
  };

  const handleCreateSubCategory = (val: string) => {
      if (!existingSubCategories.find(c => c.value === val)) {
          setExistingSubCategories(prev => [...prev, { label: val, value: val }]);
      }
      setForm(prev => ({ ...prev, sub_category: [...prev.sub_category, val] }));
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

      <Card className="border border-foreground/60 shadow-sm">
        <CardHeader className="bg-muted/10 pb-4">
          <CardTitle className="text-lg">
            {form.id ? "Edit Course" : "Create New Course"}
          </CardTitle>
          <CardDescription>
            Use the tabs below to configure all aspects of the course.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <form onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="overflow-x-auto border-b bg-muted/5 px-4 pt-2">
                  <TabsList className="h-auto w-full justify-start gap-2 bg-transparent p-0">
                    <TabsTrigger value="basic" className="data-[state=active]:bg-background border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-3">Basic Info</TabsTrigger>
                    <TabsTrigger value="description" className="data-[state=active]:bg-background border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-3">Description</TabsTrigger>
                    <TabsTrigger value="content" className="data-[state=active]:bg-background border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-3">Curriculum Info</TabsTrigger>
                    <TabsTrigger value="demos" className="data-[state=active]:bg-background border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-3">Demo Content</TabsTrigger>
                  </TabsList>
              </div>

              <div className="p-6">
                <TabsContent value="basic" className="mt-0 space-y-4">
                    <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">Course Name</Label>
                        <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="text-lg font-medium"
                        placeholder="e.g. Engineering Admission 2024"
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

                    <div className="space-y-2">
                        <Label htmlFor="original_price">Original / Fake Price (৳)</Label>
                        <Input
                        id="original_price"
                        value={form.original_price}
                        onChange={(e) => setForm((prev) => ({ ...prev, original_price: e.target.value }))}
                        placeholder="Ex: 5000 (Shows as strikethrough)"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="image_url">Course image URL (optional, 16:9)</Label>
                        <ImageUploader
                            value={form.image_url || ""}
                            onChange={(val) => setForm((prev) => ({ ...prev, image_url: val }))}
                            placeholder="https://... or upload"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="video_url">Course Video URL (Optional)</Label>
                        <Input
                            id="video_url"
                            value={form.video_url}
                            onChange={(e) => setForm((prev) => ({ ...prev, video_url: e.target.value }))}
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

                    <div className="space-y-2">
                        <Label htmlFor="category">Batch Category (Tags)</Label>
                        <MultiSelect
                            options={existingCategories}
                            selected={form.category}
                            onChange={(val) => setForm(prev => ({ ...prev, category: val }))}
                            onCreate={handleCreateCategory}
                            placeholder="Select batches..."
                        />
                        <p className="text-xs text-muted-foreground">Type a new batch name in the search box to create it.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sub_category">Type / Sub Category (Tags)</Label>
                         <MultiSelect
                            options={existingSubCategories}
                            selected={form.sub_category}
                            onChange={(val) => setForm(prev => ({ ...prev, sub_category: val }))}
                            onCreate={handleCreateSubCategory}
                            placeholder="Select types..."
                        />
                        <p className="text-xs text-muted-foreground">Type a new category name in the search box to create it.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Include Extra Courses (Bundles)</Label>
                        <MultiSelect
                            options={allCoursesList?.filter(c => c.value !== form.id) || []}
                            selected={form.linked_course_ids}
                            onChange={(val) => setForm(prev => ({ ...prev, linked_course_ids: val }))}
                            placeholder="Select courses to include..."
                        />
                        <p className="text-xs text-muted-foreground">Users enrolling in this course will also get access to selected courses.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="priority">Priority (Order)</Label>
                        <Input
                        id="priority"
                        type="number"
                        value={form.priority}
                        onChange={(e) => setForm((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                        />
                        <p className="text-xs text-muted-foreground">Lower numbers appear first.</p>
                    </div>

                    <div className="flex items-center gap-4 md:col-span-2 border p-4 rounded-lg bg-muted/20">
                        <div className="flex items-center gap-2">
                            <Switch
                            id="is_active"
                            checked={form.is_active}
                            onCheckedChange={(checked) =>
                                setForm((prev) => ({ ...prev, is_active: checked }))
                            }
                            />
                            <Label htmlFor="is_active">Is Active</Label>
                        </div>
                        <div className="w-px h-6 bg-border mx-2"></div>
                        <div className="flex items-center gap-2">
                            <Switch
                            id="is_public"
                            checked={form.is_public}
                            onCheckedChange={(checked) =>
                                setForm((prev) => ({ ...prev, is_public: checked }))
                            }
                            />
                            <Label htmlFor="is_public">Publicly Listed</Label>
                        </div>
                    </div>
                    </div>
                </TabsContent>

                <TabsContent value="description" className="mt-0 space-y-4">
                    <div className="space-y-2">
                    <Label htmlFor="short_description">Short description</Label>
                    <Textarea
                        id="short_description"
                        rows={3}
                        value={form.short_description}
                        onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))}
                        placeholder="A brief overview shown on course cards..."
                    />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="full_description">Full description</Label>
                        <PostEditor
                            initialValue={form.full_description}
                            onChange={(val) => setForm((prev) => ({ ...prev, full_description: val }))}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="content" className="mt-0 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <Label htmlFor="what_you_get">
                            "What you get" Section
                        </Label>
                    </div>

                    <PostEditor
                        initialValue={form.what_you_get}
                        onChange={(val) => setForm((prev) => ({ ...prev, what_you_get: val }))}
                    />
                </TabsContent>

                <TabsContent value="demos" className="mt-0 space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <div className="space-y-1">
                             <h4 className="text-sm font-semibold">Demo / Preview Content</h4>
                             <p className="text-xs text-muted-foreground">Add demo classes with video and/or note links.</p>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                                const newContent = [
                                    ...(form.demo_content || []),
                                    { title: "", video_url: "", note_url: "", is_locked: false }
                                ];
                                setForm({ ...form, demo_content: newContent });
                            }}
                        >
                            <Plus className="w-4 h-4 mr-1" /> Add Class
                        </Button>
                    </div>

                    {form.demo_content?.length === 0 && (
                         <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                             No demo content added yet.
                         </div>
                    )}

                    <div className="grid gap-4">
                        {form.demo_content?.map((item, idx) => (
                            <Card key={idx} className="overflow-hidden">
                                <CardContent className="p-4 flex gap-4 flex-col md:flex-row md:items-start">
                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <Label className="text-xs text-muted-foreground mb-1 block">Title</Label>
                                            <Input
                                                value={item.title}
                                                onChange={(e) => {
                                                    const updated = [...(form.demo_content || [])];
                                                    updated[idx] = { ...updated[idx], title: e.target.value };
                                                    setForm({ ...form, demo_content: updated });
                                                }}
                                                className="h-8"
                                                placeholder="e.g. Introduction Class"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-xs text-muted-foreground mb-1 block">Video URL</Label>
                                                <Input
                                                    value={item.video_url || ""}
                                                    onChange={(e) => {
                                                        const updated = [...(form.demo_content || [])];
                                                        updated[idx] = { ...updated[idx], video_url: e.target.value };
                                                        setForm({ ...form, demo_content: updated });
                                                    }}
                                                    className="h-8 font-mono text-xs"
                                                    placeholder="https://youtube.com..."
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-muted-foreground mb-1 block">Note/PDF URL</Label>
                                                <Input
                                                    value={item.note_url || ""}
                                                    onChange={(e) => {
                                                        const updated = [...(form.demo_content || [])];
                                                        updated[idx] = { ...updated[idx], note_url: e.target.value };
                                                        setForm({ ...form, demo_content: updated });
                                                    }}
                                                    className="h-8 font-mono text-xs"
                                                    placeholder="https://drive.google.com..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex md:flex-col justify-end gap-2 mt-2 md:mt-0">
                                         <Button
                                            type="button"
                                            size="sm"
                                            variant="destructive"
                                            className="h-8 w-full md:w-auto"
                                            onClick={() => {
                                                 const updated = form.demo_content?.filter((_, i) => i !== idx);
                                                 setForm({ ...form, demo_content: updated });
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4 md:mr-2" />
                                            <span className="md:inline hidden">Remove</span>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
              </div>

              <div className="flex items-center gap-2 p-6 pt-0">
                <Button type="submit" disabled={upsertMutation.isPending} className="w-full md:w-auto">
                  {upsertMutation.isPending ? "Saving..." : form.id ? "Update Course" : "Create Course"}
                </Button>
                {form.id && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    disabled={upsertMutation.isPending}
                    className="w-full md:w-auto"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </Tabs>
          </form>
        </CardContent>
      </Card>

      {/* Courses List Section - Collapsible or separate card */}
      <Card className="border border-foreground/60">
        <CardHeader>
          <CardTitle className="text-base">All Courses</CardTitle>
          <CardDescription>
            Manage existing courses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading courses...</div>
          ) : !courses || courses.length === 0 ? (
            <div className="text-sm text-muted-foreground">No courses defined yet.</div>
          ) : (
            <>
            <div className="rounded-md border overflow-x-auto">
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
                    <TableRow key={course.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium whitespace-nowrap">{course.name}</TableCell>
                        <TableCell>
                        {course.price != null ? `৳${course.price}` : <span className="text-xs text-muted-foreground">Not set</span>}
                        </TableCell>
                        <TableCell>
                        {course.is_public !== false ? "Yes" : <span className="text-xs text-muted-foreground">No</span>}
                        </TableCell>
                        <TableCell>
                        {course.is_active ? (
                            <Badge variant="default" className="text-[10px] bg-green-600 hover:bg-green-700">Active</Badge>
                        ) : (
                            <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                        )}
                        </TableCell>
                        <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(course)}
                                title="Edit Course"
                            >
                                <Edit2 className="h-4 w-4" />
                            </Button>
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

export default AdminCourses;
