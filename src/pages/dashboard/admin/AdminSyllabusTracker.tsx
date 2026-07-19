import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface SyllabusItem {
  id: number;
  title: string;
  description: string | null;
  subject: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const emptyForm = { title: "", description: "", subject: "", link_url: "" };

const AdminSyllabusTracker = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Syllabus Tracker Manager – Atlas";
  }, []);

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-syllabus-tracker"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("syllabus_tracker_items")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SyllabusItem[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-syllabus-tracker"] });

  const addItem = async () => {
    if (!form.title.trim()) {
      toast({ title: "শিরোনাম দিন", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const nextOrder = (items && items.length > 0) ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const { error } = await (supabase.from as any)("syllabus_tracker_items").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        subject: form.subject.trim() || null,
        link_url: form.link_url.trim() || null,
        sort_order: nextOrder,
        is_active: true,
      });
      if (error) throw error;
      setForm(emptyForm);
      toast({ title: "যুক্ত হয়েছে" });
      refresh();
    } catch (e: any) {
      toast({ title: "ব্যর্থ হয়েছে", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: SyllabusItem) => {
    const { error } = await (supabase.from as any)("syllabus_tracker_items")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) {
      toast({ title: "ব্যর্থ হয়েছে", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const deleteItem = async (id: number) => {
    if (!confirm("এই আইটেম মুছে ফেলবেন?")) return;
    const { error } = await (supabase.from as any)("syllabus_tracker_items").delete().eq("id", id);
    if (error) {
      toast({ title: "ব্যর্থ হয়েছে", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "মুছে ফেলা হয়েছে" });
    refresh();
  };

  const moveItem = async (item: SyllabusItem, direction: -1 | 1) => {
    if (!items) return;
    const idx = items.findIndex((i) => i.id === item.id);
    const swapWith = items[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      (supabase.from as any)("syllabus_tracker_items").update({ sort_order: swapWith.sort_order }).eq("id", item.id),
      (supabase.from as any)("syllabus_tracker_items").update({ sort_order: item.sort_order }).eq("id", swapWith.id),
    ]);
    refresh();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Syllabus Tracker Manager</h1>
        <p className="text-muted-foreground">
          হোমপেজের Syllabus Tracker বাটনে যে কনটেন্ট দেখাবে তা এখান থেকে যোগ/এডিট/মুছে ফেলুন।
        </p>
      </header>

      {/* Add new item form */}
      <Card className="p-4 space-y-3">
        <h2 className="font-bold text-sm">নতুন আইটেম যোগ করুন</h2>
        <Input
          placeholder="শিরোনাম (যেমন: পদার্থবিজ্ঞান ১ম পত্র সিলেবাস)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <Input
          placeholder="বিষয় (ঐচ্ছিক)"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
        <Textarea
          placeholder="বিস্তারিত (ঐচ্ছিক)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
        />
        <Input
          placeholder="লিংক (ঐচ্ছিক — PDF/Doc URL ইত্যাদি)"
          value={form.link_url}
          onChange={(e) => setForm({ ...form, link_url: e.target.value })}
        />
        <Button onClick={() => void addItem()} disabled={saving} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> যোগ করুন
        </Button>
      </Card>

      {/* Existing items */}
      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>}
        {!isLoading && (!items || items.length === 0) && (
          <p className="text-sm text-muted-foreground">এখনো কোনো আইটেম যোগ করা হয়নি।</p>
        )}
        {items?.map((item, idx) => (
          <Card key={item.id} className="p-3 flex items-start gap-3">
            <div className="flex flex-col gap-1 pt-1">
              <button
                onClick={() => void moveItem(item, -1)}
                disabled={idx === 0}
                className="text-muted-foreground disabled:opacity-30"
                title="উপরে সরান"
              >
                <GripVertical className="h-3.5 w-3.5 rotate-90" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">{item.title}</div>
              {item.subject && <div className="text-xs text-primary font-semibold">{item.subject}</div>}
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
              )}
              {item.link_url && (
                <a href={item.link_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline break-all">
                  {item.link_url}
                </a>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <Switch checked={item.is_active} onCheckedChange={() => void toggleActive(item)} />
              <button
                onClick={() => void deleteItem(item.id)}
                className="h-7 w-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminSyllabusTracker;
