import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface ReadymadeAccessManagerProps {
  courseId: string;
}

// Tree node key format: `${subject}|||${chapter}|||${subChapter ?? ''}`
// Groups are Subject -> Chapter -> Sub-chapter (sub-chapter may be null,
// treated as a single "General" leaf under that chapter in that case).

type ExamRow = {
  id: string;
  subject: string[] | null;
  chapter: string | null;
  readymade_sub_chapter: string | null;
  readymade_course_ids: string[] | null;
};

export function ReadymadeAccessManager({ courseId }: ReadymadeAccessManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [pendingSelection, setPendingSelection] = useState<Set<string> | null>(null);

  const { data: examRows, isLoading } = useQuery({
    queryKey: ["readymade-access-exams"],
    queryFn: async () => {
      const rows: ExamRow[] = [];
      const BATCH = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("exams")
          .select("id, subject, chapter, readymade_sub_chapter, readymade_course_ids")
          .eq("is_readymade", true)
          .range(from, from + BATCH - 1);
        if (error) throw error;
        rows.push(...((data || []) as any));
        if (!data || data.length < BATCH) break;
        from += BATCH;
      }
      return rows;
    },
  });

  // Build Subject -> Chapter -> SubChapter tree with exam-id lists per leaf,
  // and figure out which leaves are currently fully accessible to this course.
  const tree = useMemo(() => {
    if (!examRows) return null;
    const subjects: Record<string, Record<string, Record<string, string[]>>> = {};
    examRows.forEach((row) => {
      const subs = Array.isArray(row.subject) ? row.subject : [];
      const chapter = row.chapter || "সাধারণ";
      const subChapter = row.readymade_sub_chapter || "সাধারণ";
      subs.forEach((subject) => {
        if (!subjects[subject]) subjects[subject] = {};
        if (!subjects[subject][chapter]) subjects[subject][chapter] = {};
        if (!subjects[subject][chapter][subChapter]) subjects[subject][chapter][subChapter] = [];
        subjects[subject][chapter][subChapter].push(row.id);
      });
    });
    return subjects;
  }, [examRows]);

  // Currently-granted leaf keys: a leaf counts as "selected" if every exam
  // under it already has this course in readymade_course_ids.
  const currentSelection = useMemo(() => {
    if (!tree || !examRows) return new Set<string>();
    const examCourseIds = new Map(examRows.map((r) => [r.id, r.readymade_course_ids || []]));
    const selected = new Set<string>();
    Object.entries(tree).forEach(([subject, chapters]) => {
      Object.entries(chapters).forEach(([chapter, subChapters]) => {
        Object.entries(subChapters).forEach(([subChapter, examIds]) => {
          const allGranted = examIds.length > 0 && examIds.every((id) => (examCourseIds.get(id) || []).includes(courseId));
          if (allGranted) selected.add(`${subject}|||${chapter}|||${subChapter}`);
        });
      });
    });
    return selected;
  }, [tree, examRows, courseId]);

  const selection = pendingSelection ?? currentSelection;
  const setSelection = (updater: (prev: Set<string>) => Set<string>) => {
    setPendingSelection((prev) => updater(prev ?? currentSelection));
  };

  const toggleLeaf = (key: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleChapter = (subject: string, chapter: string, leafKeys: string[]) => {
    setSelection((prev) => {
      const next = new Set(prev);
      const allSelected = leafKeys.every((k) => next.has(k));
      leafKeys.forEach((k) => { if (allSelected) next.delete(k); else next.add(k); });
      return next;
    });
  };

  const toggleAll = () => {
    if (!tree) return;
    setSelection((prev) => {
      const allKeys: string[] = [];
      Object.entries(tree).forEach(([subject, chapters]) => {
        Object.entries(chapters).forEach(([chapter, subChapters]) => {
          Object.keys(subChapters).forEach((subChapter) => allKeys.push(`${subject}|||${chapter}|||${subChapter}`));
        });
      });
      const allSelected = allKeys.every((k) => prev.has(k));
      return allSelected ? new Set() : new Set(allKeys);
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tree || !examRows) return;
      const finalSelection = selection;
      const examIdToLeafKey = new Map<string, string>();
      Object.entries(tree).forEach(([subject, chapters]) => {
        Object.entries(chapters).forEach(([chapter, subChapters]) => {
          Object.entries(subChapters).forEach(([subChapter, examIds]) => {
            const key = `${subject}|||${chapter}|||${subChapter}`;
            examIds.forEach((id) => examIdToLeafKey.set(id, key));
          });
        });
      });

      const toGrant: string[] = [];
      const toRevoke: string[] = [];
      examRows.forEach((row) => {
        const leafKey = examIdToLeafKey.get(row.id);
        if (!leafKey) return;
        const shouldHaveAccess = finalSelection.has(leafKey);
        const currentlyHasAccess = (row.readymade_course_ids || []).includes(courseId);
        if (shouldHaveAccess && !currentlyHasAccess) toGrant.push(row.id);
        else if (!shouldHaveAccess && currentlyHasAccess) toRevoke.push(row.id);
      });

      const examMap = new Map(examRows.map((r) => [r.id, r.readymade_course_ids || []]));

      for (const id of toGrant) {
        const updated = Array.from(new Set([...(examMap.get(id) || []), courseId]));
        const { error } = await supabase.from("exams").update({ readymade_course_ids: updated }).eq("id", id);
        if (error) throw error;
      }
      for (const id of toRevoke) {
        const updated = (examMap.get(id) || []).filter((cid) => cid !== courseId);
        const { error } = await supabase.from("exams").update({ readymade_course_ids: updated }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Readymade access updated" });
      queryClient.invalidateQueries({ queryKey: ["readymade-access-exams"] });
      setPendingSelection(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update access", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || !tree) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading readymade exam structure...</div>;
  }

  const subjectEntries = Object.entries(tree);
  const allLeafCount = subjectEntries.reduce((sum, [, chapters]) => sum + Object.values(chapters).reduce((s, sc) => s + Object.keys(sc).length, 0), 0);
  const allSelected = allLeafCount > 0 && subjectEntries.every(([subject, chapters]) =>
    Object.entries(chapters).every(([chapter, subChapters]) =>
      Object.keys(subChapters).every((subChapter) => selection.has(`${subject}|||${chapter}|||${subChapter}`))
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="rm-access-all" />
          <label htmlFor="rm-access-all" className="text-sm font-semibold cursor-pointer">All Readymade Exams</label>
        </div>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !pendingSelection}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Save Access
        </Button>
      </div>

      <div className="space-y-2">
        {subjectEntries.map(([subject, chapters]) => {
          const subjectExpanded = expandedSubjects.has(subject);
          const chapterEntries = Object.entries(chapters);
          const subjectLeafKeys = chapterEntries.flatMap(([chapter, subChapters]) => Object.keys(subChapters).map((sc) => `${subject}|||${chapter}|||${sc}`));
          const subjectAllSelected = subjectLeafKeys.length > 0 && subjectLeafKeys.every((k) => selection.has(k));
          const subjectSomeSelected = !subjectAllSelected && subjectLeafKeys.some((k) => selection.has(k));

          return (
            <Card key={subject} className="border">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/40" onClick={() => setExpandedSubjects((prev) => { const n = new Set(prev); n.has(subject) ? n.delete(subject) : n.add(subject); return n; })}>
                  {subjectExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <Checkbox
                    checked={subjectAllSelected ? true : (subjectSomeSelected ? "indeterminate" : false)}
                    onCheckedChange={() => toggleChapter(subject, "__all__", subjectLeafKeys)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="font-semibold text-sm whitespace-pre-line">{subject}</span>
                </div>

                {subjectExpanded && (
                  <div className="border-t divide-y">
                    {chapterEntries.map(([chapter, subChapters]) => {
                      const chapterKey = `${subject}__${chapter}`;
                      const chapterExpanded = expandedChapters.has(chapterKey);
                      const leafKeys = Object.keys(subChapters).map((sc) => `${subject}|||${chapter}|||${sc}`);
                      const chapterAllSelected = leafKeys.every((k) => selection.has(k));
                      const chapterSomeSelected = !chapterAllSelected && leafKeys.some((k) => selection.has(k));

                      return (
                        <div key={chapter}>
                          <div className="flex items-center gap-2 px-3 py-2 pl-8 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedChapters((prev) => { const n = new Set(prev); n.has(chapterKey) ? n.delete(chapterKey) : n.add(chapterKey); return n; })}>
                            {chapterExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            <Checkbox
                              checked={chapterAllSelected ? true : (chapterSomeSelected ? "indeterminate" : false)}
                              onCheckedChange={() => toggleChapter(subject, chapter, leafKeys)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-sm">{chapter}</span>
                          </div>

                          {chapterExpanded && (
                            <div className="pl-14 pb-1">
                              {Object.entries(subChapters).map(([subChapter, examIds]) => {
                                const key = `${subject}|||${chapter}|||${subChapter}`;
                                return (
                                  <div key={subChapter} className="flex items-center gap-2 py-1.5">
                                    <Checkbox checked={selection.has(key)} onCheckedChange={() => toggleLeaf(key)} id={key} />
                                    <label htmlFor={key} className="text-sm cursor-pointer flex-1">{subChapter}</label>
                                    <span className="text-xs text-muted-foreground">{examIds.length} exam{examIds.length !== 1 ? "s" : ""}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
