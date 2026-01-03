import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, Tag } from "lucide-react";

const promoSchema = z.object({
  code: z.string().min(3, "Code must be at least 3 characters").toUpperCase().trim(),
  discount_amount: z.coerce.number().min(1, "Amount must be positive"),
  discount_type: z.enum(["flat", "percentage"]),
  course_id: z.string().optional().or(z.literal("")),
  usage_limit: z.coerce.number().optional().or(z.literal("")), // optional number
  is_active: z.boolean().default(true),
});

type PromoFormValues = z.infer<typeof promoSchema>;

const AdminPromoCodes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Manage Promo Codes – Admin";
  }, []);

  const form = useForm<PromoFormValues>({
    resolver: zodResolver(promoSchema),
    defaultValues: {
      code: "",
      discount_amount: 0,
      discount_type: "flat",
      course_id: "",
      usage_limit: "",
      is_active: true,
    },
  });

  const { data: promos, isLoading } = useQuery({
    queryKey: ["admin-promos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*, course:courses(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
        const { data } = await supabase.from("courses").select("id, name");
        return data || [];
    }
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: PromoFormValues) => {
      const payload = {
        code: values.code,
        discount_amount: values.discount_amount,
        discount_type: values.discount_type,
        course_id: (values.course_id === "" || values.course_id === "all") ? null : values.course_id,
        usage_limit: (values.usage_limit === "" || values.usage_limit === null || isNaN(Number(values.usage_limit))) ? null : Number(values.usage_limit),
        is_active: values.is_active,
      };

      if (editingId) {
        const { error } = await supabase
          .from("promo_codes")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("promo_codes")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Promo code updated" : "Promo code created" });
      queryClient.invalidateQueries({ queryKey: ["admin-promos"] });
      setIsDialogOpen(false);
      form.reset();
      setEditingId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promo_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Promo code deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-promos"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: PromoFormValues) => {
    upsertMutation.mutate(values);
  };

  const handleEdit = (promo: any) => {
    setEditingId(promo.id);
    form.reset({
      code: promo.code,
      discount_amount: promo.discount_amount,
      discount_type: promo.discount_type,
      course_id: promo.course_id || "",
      usage_limit: promo.usage_limit || "",
      is_active: promo.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    form.reset({
      code: "",
      discount_amount: 0,
      discount_type: "flat",
      course_id: "",
      usage_limit: "",
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Promo Codes</h2>
          <p className="text-muted-foreground">Manage discount codes for courses.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" /> Create Promo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Promo Code" : "Create Promo Code"}</DialogTitle>
              <DialogDescription>
                Set up the discount details.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Code (e.g. DISCOUNT50)</FormLabel>
                        <FormControl>
                            <Input placeholder="SUMMER24" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="course_id"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Course (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="All Courses" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="">All Courses</SelectItem>
                                {courses?.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="discount_type"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="flat">Flat Amount (৳)</SelectItem>
                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="discount_amount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                            <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="usage_limit"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Usage Limit (Optional)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="Unlimited" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormField
                        control={form.control}
                        name="is_active"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-auto">
                                <div className="space-y-0.5">
                                    <FormLabel>Active Status</FormLabel>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>

                <Button type="submit" className="w-full" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Update Promo" : "Create Promo"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : promos?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No promo codes found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                promos?.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="font-mono font-bold flex items-center gap-2">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        {promo.code}
                    </TableCell>
                    <TableCell>
                        {promo.discount_type === 'flat' ? `৳${promo.discount_amount}` : `${promo.discount_amount}%`}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                        {promo.course ? promo.course.name : "All Courses"}
                    </TableCell>
                    <TableCell>
                        {promo.used_count} / {promo.usage_limit || "∞"}
                    </TableCell>
                    <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${promo.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {promo.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(promo)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this promo code?")) {
                              deleteMutation.mutate(promo.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPromoCodes;
