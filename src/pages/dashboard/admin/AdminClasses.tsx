import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Class } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, Calendar, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { SUBJECTS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassForm } from "@/components/admin/ClassForm";
import { ClassSortableList } from "@/components/admin/ClassSortableList";
import { TutorialSortableList } from "@/components/admin/TutorialSortableList";
import { AdminCourseView } from "@/components/admin/AdminCourseView";
import { ArrowUpDown, Plus, List, LayoutGrid, Video as VideoIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const PAGE_SIZE = 30;

const AdminClasses = () => {
  const [editingClass, setEditingClass] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [showTutorialDialog, setShowTutorialDialog] = useState(false);
  const [tutorialCaptionInput, setTutorialCaptionInput] = useState("");
  const [tutorialUrlInput, setTutorialUrlInput] = useState("");
  const [editingTutorialId, setEditingTutorialId] = useState<string | null>(null);
  const [showTutorialReorder, setShowTutorialReorder] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "course">("list");
  const [isReordering, setIsReordering] = useState(false);
  const [reorderCourseId, setReorderCourseId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "live" | "recorded" | "archive">("all");

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
    queryKey: ["admin-classes", page, debouncedSearch, subjectFilter, courseFilter, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("classes")
        .select("*, course:courses(name)", { count: 'exact' })
        .order("start_at", { ascending: false }); // Always newest first in list view

      if (subjectFilter !== "all") {
        query = query.contains("subject", [subjectFilter]);
      }
      if (courseFilter !== "all") {
          query = query.eq("course_id", courseFilter);
      }
      if (categoryFilter === "archive") {
          query = query.eq("is_archive", true);
      } else if (categoryFilter === "live" || categoryFilter === "recorded") {
          query = query.eq("class_type", categoryFilter).not("is_archive", "is", true);
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

  const { data: tutorialVideos } = useQuery({
    queryKey: ["admin-tutorial-videos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tutorial_videos").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: showTutorialDialog,
  });

  const resetTutorialForm = () => {
    setEditingTutorialId(null);
    setTutorialCaptionInput("");
    setTutorialUrlInput("");
  };

  const saveTutorialVideoMutation = useMutation({
    mutationFn: async () => {
      if (editingTutorialId) {
        const { error } = await supabase.from("tutorial_videos").update({ caption: tutorialCaptionInput.trim(), video_url: tutorialUrlInput.trim() }).eq("id", editingTutorialId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tutorial_videos").insert({ caption: tutorialCaptionInput.trim(), video_url: tutorialUrlInput.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingTutorialId ? "Tutorial video updated" : "Tutorial video added" });
      queryClient.invalidateQueries({ queryKey: ["admin-tutorial-videos"] });
      queryClient.invalidateQueries({ queryKey: ["tutorial-videos"] });
      resetTutorialForm();
    },
    onError: () => {
      toast({ title: "Failed to save tutorial video", variant: "destructive" });
    },
  });

  const deleteTutorialVideoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutorial_videos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Tutorial video deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-tutorial-videos"] });
      queryClient.invalidateQueries({ queryKey: ["tutorial-videos"] });
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-xl font-semibold tracking-tight">Admin: Class Schedule</h1>
            <p className="text-sm text-muted-foreground">Manage live and recorded classes.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full sm:w-auto">
                <TabsList className="flex flex-wrap h-auto w-full justify-start">
                    <TabsTrigger value="list"><List className="h-4 w-4 mr-2" /> List</TabsTrigger>
                    <TabsTrigger value="course"><LayoutGrid className="h-4 w-4 mr-2" /> Courses</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setShowForm(!showForm)} className="shrink-0" variant={showForm || editingClass ? "secondary" : "default"}>
              {showForm || editingClass ? "Close Form" : <><Plus className="h-4 w-4 mr-2" /> Add Class</>}
          </Button>
          <Button onClick={() => setShowTutorialDialog(true)} className="shrink-0" variant="outline">
              <VideoIcon className="h-4 w-4 mr-2" /> Watch Tutorial Videos
          </Button>
      </div>

      <Dialog open={showTutorialDialog} onOpenChange={(open) => { setShowTutorialDialog(open); if (!open) resetTutorialForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Watch Tutorial Videos</DialogTitle>
          </DialogHeader>
          {showTutorialReorder ? (
            <TutorialSortableList videos={tutorialVideos || []} onClose={() => setShowTutorialReorder(false)} />
          ) : (
          <>
          <div className="space-y-2 py-2 border-b pb-4">
            <Label htmlFor="tutorial-caption">Caption</Label>
            <Input
              id="tutorial-caption"
              placeholder="যেমন: কিভাবে Exam দিবেন"
              value={tutorialCaptionInput}
              onChange={(e) => setTutorialCaptionInput(e.target.value)}
            />
            <Label htmlFor="tutorial-video-url">YouTube Video Link</Label>
            <Input
              id="tutorial-video-url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={tutorialUrlInput}
              onChange={(e) => setTutorialUrlInput(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              {editingTutorialId && (
                <Button variant="outline" size="sm" onClick={resetTutorialForm}>Cancel Edit</Button>
              )}
              <Button
                size="sm"
                disabled={saveTutorialVideoMutation.isPending || !tutorialCaptionInput.trim() || !tutorialUrlInput.trim()}
                onClick={() => saveTutorialVideoMutation.mutate()}
              >
                {editingTutorialId ? "Update" : "Add Video"}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {tutorialVideos && tutorialVideos.length > 1 && (
              <Button size="sm" variant="outline" className="w-full" onClick={() => setShowTutorialReorder(true)}>
                <ArrowUpDown className="h-3.5 w-3.5 mr-2" /> Manage Order
              </Button>
            )}
            {tutorialVideos?.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">কোনো tutorial video নেই।</p>
            )}
            {tutorialVideos?.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                <span className="text-sm truncate">{v.caption}</span>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditingTutorialId(v.id); setTutorialCaptionInput(v.caption); setTutorialUrlInput(v.video_url); }}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteTutorialVideoMutation.mutate(v.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTutorialDialog(false)}>Close</Button>
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-6">
        {(showForm || editingClass) && (
            <div className="bg-card border rounded-lg shadow-sm mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <ClassForm
                    classItem={editingClass}
                    onSuccess={() => { setEditingClass(null); setShowForm(false); }}
                    onCancel={() => { setEditingClass(null); setShowForm(false); }}
                />
            </div>
        )}

        {viewMode === "course" ? (
            <AdminCourseView resourceType="classes" />
        ) : (
        <div className="space-y-4">
             {/* Classes List */}
             <div className="flex flex-col gap-2">
                 <div className="grid grid-cols-3 gap-1.5">
                    <Select
                        value={courseFilter}
                        onValueChange={(v) => {
                            setCourseFilter(v);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="w-full text-[11px] sm:text-sm px-1.5 sm:px-2">
                            <SelectValue placeholder="Course" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Courses</SelectItem>
                            {courses?.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={categoryFilter}
                        onValueChange={(v) => {
                            setCategoryFilter(v as "all" | "live" | "recorded" | "archive");
                            setSubjectFilter("all");
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="w-full text-[11px] sm:text-sm px-1.5 sm:px-2">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="live">Live</SelectItem>
                            <SelectItem value="recorded">Recorded</SelectItem>
                            <SelectItem value="archive">Archive</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={subjectFilter}
                        onValueChange={(v) => {
                            setSubjectFilter(v);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="w-full text-[11px] sm:text-sm px-1.5 sm:px-2">
                            <SelectValue placeholder="Subject" />
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
                 </div>
             <Input
                placeholder="Search Title..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-[240px]"
             />
             </div>
             <div className="flex justify-end">
                 {courseFilter !== 'all' ? (
                   <Button variant="outline" size="sm" onClick={() => { setReorderCourseId(courseFilter); setIsReordering(true); }} disabled={!classes || classes.length === 0} title="Reorder classes for this course">
                       <ArrowUpDown className="h-4 w-4 mr-2" /> Reorder
                   </Button>
                 ) : (
                   <Button variant="outline" size="sm" onClick={() => setIsReordering(true)} disabled={!classes || classes.length === 0}>
                       <ArrowUpDown className="h-4 w-4 mr-2" /> Reorder Page
                   </Button>
                 )}
             </div>

             {categoryFilter !== "all" && (
                 <div className="grid grid-cols-2 gap-2">
                     <Card
                         className={`cursor-pointer transition-colors ${subjectFilter === "all" ? "border-primary bg-primary/5" : ""}`}
                         onClick={() => { setSubjectFilter("all"); setPage(0); }}
                     >
                         <CardContent className="p-3 text-center text-sm font-medium">
                             All Subjects
                         </CardContent>
                     </Card>
                     {SUBJECTS.map((subject) => (
                         <Card
                             key={subject}
                             className={`cursor-pointer transition-colors ${subjectFilter === subject ? "border-primary bg-primary/5" : ""}`}
                             onClick={() => { setSubjectFilter(subject); setPage(0); }}
                         >
                             <CardContent className="p-3 text-center text-sm font-medium">
                                 {subject}
                             </CardContent>
                         </Card>
                     ))}
                 </div>
             )}

             {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
             ) : !classes || classes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No classes found.</div>
             ) : isReordering ? (
                <ClassSortableList
                  classes={classes}
                  onClose={() => { setIsReordering(false); setReorderCourseId(null); }}
                  sortColumn="sort_order"
                />
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
                                <TableRow key={cls.id} className="hover:bg-muted/50">
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
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8"
                                                title="Edit Class"
                                                onClick={() => { setEditingClass(cls); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                            >
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
                                     <Button size="sm" variant="outline" className="h-8" onClick={() => { setEditingClass(cls); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
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
        )}
      </div>
    </div>
  );
};

export default AdminClasses;
