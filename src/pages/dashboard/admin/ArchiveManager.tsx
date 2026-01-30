import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Filter, Video, Trophy, Plus, Edit, Trash2, MoreHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClassForm } from "@/components/admin/ClassForm";
import { ExamForm } from "@/components/admin/ExamForm";

const ArchiveManager = () => {
    useEffect(() => {
        document.title = "Archive Manager – Atlas";
    }, []);

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Archive Manager</h1>
                    <p className="text-muted-foreground">Manage archived content visibility for courses. Assign past content to current courses as archive material.</p>
                </div>
            </header>

            <Tabs defaultValue="classes" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="classes" className="gap-2"><Video className="h-4 w-4" /> Classes</TabsTrigger>
                    <TabsTrigger value="exams" className="gap-2"><Trophy className="h-4 w-4" /> Exams</TabsTrigger>
                </TabsList>
                <TabsContent value="classes">
                    <ContentArchiveManager type="classes" />
                </TabsContent>
                <TabsContent value="exams">
                    <ContentArchiveManager type="exams" />
                </TabsContent>
            </Tabs>
        </div>
    );
};

const ContentArchiveManager = ({ type }: { type: "classes" | "exams" }) => {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [targetCourses, setTargetCourses] = useState<string[]>([]);
    const [isApplying, setIsApplying] = useState(false);

    // Fetch Courses for selection
    const { data: courses } = useQuery({
        queryKey: ["admin-courses-list-archive"],
        queryFn: async () => {
            const { data } = await supabase.from("courses").select("id, name").order("name");
            return data?.map(c => ({ label: c.name, value: c.id })) || [];
        }
    });

    // Fetch Content
    const { data: items, isLoading } = useQuery({
        queryKey: ["admin-archive-items", type, searchQuery],
        queryFn: async () => {
            let query = supabase
                .from(type)
                .select("id, title, course:courses(name), archive_course_ids, is_archive")
                .order("created_at", { ascending: false })
                .limit(50); // Pagination ideal but limit for now

            if (searchQuery) {
                query = query.ilike("title", `%${searchQuery}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        }
    });

    const handleApply = async () => {
        if (selectedItems.length === 0 || targetCourses.length === 0) {
            toast({ title: "Selection missing", description: "Select items and target courses.", variant: "destructive" });
            return;
        }

        setIsApplying(true);
        try {
            // Fetch current archive_course_ids for selected items to merge
            const { data: currentData } = await supabase
                .from(type)
                .select("id, archive_course_ids")
                .in("id", selectedItems);

            const updates = currentData?.map(item => {
                const current = item.archive_course_ids || [];
                // Merge unique
                const updated = Array.from(new Set([...current, ...targetCourses]));
                return {
                    id: item.id,
                    archive_course_ids: updated
                };
            }) || [];

            await Promise.all(updates.map(u =>
                supabase.from(type).update({ archive_course_ids: u.archive_course_ids }).eq("id", u.id)
            ));

            toast({ title: "Archive Updated", description: `Updated ${updates.length} items.` });
            setSelectedItems([]);
            setTargetCourses([]);
            queryClient.invalidateQueries({ queryKey: ["admin-archive-items"] });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsApplying(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this item? This action cannot be undone.")) return;
        try {
            // Check dependency manually if needed, but usually cascade handles it
            if (type === 'exams') {
                 await supabase.from("exam_questions").delete().eq("exam_id", id);
                 await supabase.from("exam_attempts").delete().eq("exam_id", id);
            }
            const { error } = await supabase.from(type).delete().eq("id", id);
            if (error) throw error;
            toast({ title: "Deleted", description: "Item deleted successfully." });
            queryClient.invalidateQueries({ queryKey: ["admin-archive-items"] });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    };

    const handleToggleArchive = async (id: string, checked: boolean) => {
        try {
            // @ts-ignore
            const { error } = await supabase.from(type).update({ is_archive: checked }).eq("id", id);
            if (error) throw error;
            toast({ title: "Updated", description: `Marked as ${checked ? "Archive" : "Public/Normal"}.` });
            queryClient.invalidateQueries({ queryKey: ["admin-archive-items"] });
        } catch (err: any) {
             toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                <div className="w-full md:w-1/3">
                    <Input
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-2/3 items-end overflow-x-auto pb-1">
                    <div className="flex-1 min-w-[200px]">
                        <Label className="text-xs mb-1 block">Assign to Archive of:</Label>
                        <MultiSelect
                            options={courses || []}
                            selected={targetCourses}
                            onChange={setTargetCourses}
                            placeholder="Select Courses..."
                        />
                    </div>
                    <Button onClick={handleApply} disabled={isApplying || selectedItems.length === 0} className="shrink-0">
                        {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" /> Apply
                    </Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button variant="secondary" className="shrink-0">
                                <Plus className="mr-2 h-4 w-4" /> New {type === 'classes' ? 'Class' : 'Exam'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create New {type === 'classes' ? 'Class' : 'Exam'} for Archive</DialogTitle>
                                <DialogDescription>
                                    Create a new item and assign it directly to archives.
                                </DialogDescription>
                            </DialogHeader>
                            {type === 'classes' ? (
                                <ClassForm onSuccess={() => { setIsCreateOpen(false); queryClient.invalidateQueries({ queryKey: ["admin-archive-items"] }); }} isArchiveMode={true} />
                            ) : (
                                <ExamForm onSuccess={() => { setIsCreateOpen(false); queryClient.invalidateQueries({ queryKey: ["admin-archive-items"] }); }} isArchiveMode={true} />
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="border rounded-md">
                {isLoading ? (
                    <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
                ) : (
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-muted/50">
                                <tr>
                                    <th className="p-4 w-10">
                                        <Checkbox
                                            checked={items && items.length > 0 && selectedItems.length === items.length}
                                            onCheckedChange={(checked) => {
                                                if (checked) setSelectedItems(items?.map((i: any) => i.id) || []);
                                                else setSelectedItems([]);
                                            }}
                                        />
                                    </th>
                                    <th className="p-4">Title</th>
                                    <th className="p-4">Original Course</th>
                                    <th className="p-4">Is Archive</th>
                                    <th className="p-4">Archived For</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items?.map((item: any) => (
                                    <tr key={item.id} className="border-b hover:bg-muted/10">
                                        <td className="p-4">
                                            <Checkbox
                                                checked={selectedItems.includes(item.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) setSelectedItems(prev => [...prev, item.id]);
                                                    else setSelectedItems(prev => prev.filter(id => id !== item.id));
                                                }}
                                            />
                                        </td>
                                        <td className="p-4 font-medium">{item.title}</td>
                                        <td className="p-4 text-muted-foreground">{item.course?.name || "Public"}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={!!item.is_archive}
                                                    onCheckedChange={(checked) => handleToggleArchive(item.id, checked)}
                                                />
                                                <span className="text-xs text-muted-foreground">{item.is_archive ? "Archive" : "Normal"}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {item.archive_course_ids?.length > 0 ? (
                                                    <Badge variant="outline">{item.archive_course_ids.length} Courses</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => setEditingItem(item)}>
                                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(item.id)}>
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit {type === 'classes' ? 'Class' : 'Exam'}</DialogTitle>
                    </DialogHeader>
                    {editingItem && (
                        type === 'classes' ? (
                            <ClassForm
                                classItem={editingItem}
                                onSuccess={() => { setEditingItem(null); queryClient.invalidateQueries({ queryKey: ["admin-archive-items"] }); }}
                                isArchiveMode={true}
                            />
                        ) : (
                            <ExamForm
                                exam={editingItem}
                                onSuccess={() => { setEditingItem(null); queryClient.invalidateQueries({ queryKey: ["admin-archive-items"] }); }}
                                isArchiveMode={true}
                            />
                        )
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ArchiveManager;
