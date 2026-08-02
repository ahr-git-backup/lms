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
  mode?: "readymade" | "archive-class";
}

// Tree node key format: `${subject}|||${chapter}|||${subChapter ?? ''}`
// Groups are Subject -> Chapter -> Sub-chapter (sub-chapter may be null,
// treated as a single "General" leaf under that chapter in that case).
// For archive-class mode there is no sub-chapter level, so "সাধারণ" is
// used as a single synthetic leaf per chapter.

type Row = {
  id: string;
  subject: string[] | string | null;
  chapter: string | null;
  readymade_sub_chapter?: string | null;
  readymade_course_ids?: string[] | null;
  archive_course_ids?: string[] | null;
};

export function ReadymadeAccessManager({ courseId, mode = "readymade" }: ReadymadeAccessManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [pendingSelection, setPendingSelection] = useState<Set<string> | null>(null);

  const table = mode === "archive-class" ? "classes" : "exams";
  const courseIdsField = mode === "archive-class" ? "archive_course_ids" : "readymade_course_ids";
  const fullAccessField = "readymade_full_access"; // course-level flag, only meaningful for mode==="readymade"

  const { data: courseFullAccess, isLoading: loadingFullAccess } = useQuery({
    queryKey: ["course-readymade-full-access", courseId],
    queryFn: async () => {
      if (mode !== "readymade") return false;
      const { data, error } = await supabase.from("courses").select(fullAccessField).eq("id", courseId).maybeSingle();
      if (error) throw error;
      return !!(data as any)?.[fullAccessField];
    },
    enabled: mode === "readymade",
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["readymade-access-rows", mode],
    queryFn: async () => {
      const rowsAcc: Row[] = [];
      const BATCH = 1000;
      let from = 0;
      while (true) {
        let query = supabase
          .from(table)
          .select(mode === "archive-class" ? `id, subject, chapter, ${courseIdsField}` : `id, subject, chapter, readymade_sub_chapter, ${courseIdsField}`)
          .range(from, from + BATCH - 1);
        if (mode === "archive-class") query = query.eq("is_archive", true);
        else query = query.eq("is_readymade", true);
        const { data, error } = await query;
        if (error) throw error;
        rowsAcc.push(...((data || []) as any));
        if (!data || data.length < BATCH) break;
        from += BATCH;
      }
      return rowsAcc;
    },
  });

  // Build Subject -> Chapter -> SubChapter tree with row-id lists per leaf,
  // and figure out which leaves are currently fully accessible to this course.
  const tree = useMemo(() => {
    if (!rows) return null;
    const subjects: Record<string, Record<string, Record<string, string[]>>> = {};
    rows.forEach((row) => {
      const subs = Array.isArray(row.subject) ? row.subject : (typeof row.subject === "string" && row.subject ? [row.subject] : []);
      const chapter = row.chapter || "সাধারণ";
      const subChapter = mode === "archive-class" ? "সাধারণ" : (row.readymade_sub_chapter || "সাধারণ");
      subs.forEach((subject) => {
        if (!subjects[subject]) subjects[subject] = {};
        if (!subjects[subject][chapter]) subjects[subject][chapter] = {};
        if (!subjects[subject][chapter][subChapter]) subjects[subject][chapter][subChapter] = [];
        subjects[subject][chapter][subChapter].push(row.id);
      });
    });
    return subjects;
  }, [rows, mode]);

  // Currently-granted leaf keys: a leaf counts as "selected" if every row
  // under it already has this course in the relevant course-ids field.
  const currentSelection = useMemo(() => {
    if (!tree || !rows) return new Set<string>();
    const rowCourseIds = new Map(rows.map((r: any) => [r.id, r[courseIdsField] || []]));
    const selected = new Set<string>();
    Object.entries(tree).forEach(([subject, chapters]) => {
      Object.entries(chapters).forEach(([chapter, subChapters]) => {
        Object.entries(subChapters).forEach(([subChapter, ids]) => {
          const allGranted = ids.length > 0 && ids.every((id) => (rowCourseIds.get(id) || []).includes(courseId));
          if (allGranted) selected.add(`${subject}|||${chapter}|||${subChapter}`);
        });
      });
    });
    return selected;
  }, [tree, rows, courseId, courseIdsField]);

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

  const [pendingFullAccess, setPendingFullAccess] = useState<boolean | null>(null);
  const fullAccessSelected = pendingFullAccess ?? courseFullAccess ?? false;

  const toggleAll = () => {
    if (!tree) return;
    const allKeys: string[] = [];
    Object.entries(tree).forEach(([subject, chapters]) => {
      Object.entries(chapters).forEach(([chapter, subChapters]) => {
        Object.keys(subChapters).forEach((subChapter) => allKeys.push(`${subject}|||${chapter}|||${subChapter}`));
      });
    });
    const currentlyAllSelected = allKeys.every((k) => selection.has(k)) && (mode !== "readymade" || fullAccessSelected);
    setSelection(() => (currentlyAllSelected ? new Set() : new Set(allKeys)));
    if (mode === "readymade") setPendingFullAccess(!currentlyAllSelected);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tree || !rows) return;
      const finalSelection = selection;
      const idToLeafKey = new Map<string, string>();
      Object.entries(tree).forEach(([subject, chapters]) => {
        Object.entries(chapters).forEach(([chapter, subChapters]) => {
          Object.entries(subChapters).forEach(([subChapter, ids]) => {
            const key = `${subject}|||${chapter}|||${subChapter}`;
            ids.forEach((id) => idToLeafKey.set(id, key));
          });
        });
      });

      const toGrant: string[] = [];
      const toRevoke: string[] = [];
      rows.forEach((row: any) => {
        const leafKey = idToLeafKey.get(row.id);
        if (!leafKey) return;
        const shouldHaveAccess = finalSelection.has(leafKey);
        const currentlyHasAccess = (row[courseIdsField] || []).includes(courseId);
        if (shouldHaveAccess && !currentlyHasAccess) toGrant.push(row.id);
        else if (!shouldHaveAccess && currentlyHasAccess) toRevoke.push(row.id);
      });

      const rowMap = new Map(rows.map((r: any) => [r.id, r[courseIdsField] || []]));

      const runBatched = async (ids: string[], updateFn: (id: string) => Record<string, unknown>) => {
        const CONCURRENCY = 25;
        for (let i = 0; i < ids.length; i += CONCURRENCY) {
          const batch = ids.slice(i, i + CONCURRENCY);
          const results = await Promise.all(
            batch.map((id) => supabase.from(table).update(updateFn(id)).eq("id", id))
          );
          const firstError = results.find((r) => r.error)?.error;
          if (firstError) throw firstError;
        }
      };

      await runBatched(toGrant, (id) => ({ [courseIdsField]: Array.from(new Set([...(rowMap.get(id) || []), courseId])) }));
      await runBatched(toRevoke, (id) => ({ [courseIdsField]: (rowMap.get(id) || []).filter((cid: string) => cid !== courseId) }));

      if (mode === "readymade" && pendingFullAccess !== null) {
        const { error: courseErr } = await supabase.from("courses").update({ [fullAccessField]: pendingFullAccess }).eq("id", courseId);
        if (courseErr) throw courseErr;
      }

      // Sync selected leaves into course_readymade_access so future exams/classes
      // added under an already-granted subject/chapter/sub-chapter are auto-unlocked
      // without needing to re-save access here.
      const { data: existingGrants } = await supabase
        .from("course_readymade_access")
        .select("id, subject, chapter, sub_chapter")
        .eq("course_id", courseId)
        .eq("mode", mode);
      const existingKeySet = new Map((existingGrants || []).map((g: any) => [`${g.subject}|||${g.chapter}|||${g.sub_chapter}`, g.id]));

      const toInsert: { subject: string; chapter: string; sub_chapter: string }[] = [];
      finalSelection.forEach((key) => {
        if (!existingKeySet.has(key)) {
          const [subject, chapter, subChapter] = key.split("|||");
          toInsert.push({ subject, chapter, sub_chapter: subChapter });
        }
      });
      const toDeleteIds: string[] = [];
      existingKeySet.forEach((id, key) => { if (!finalSelection.has(key)) toDeleteIds.push(id); });

      if (toInsert.length) {
        const { error: insErr } = await supabase.from("course_readymade_access").insert(
          toInsert.map((r) => ({ course_id: courseId, mode, ...r }))
        );
        if (insErr) throw insErr;
      }
      if (toDeleteIds.length) {
        const { error: delErr } = await supabase.from("course_readymade_access").delete().in("id", toDeleteIds);
        if (delErr) throw delErr;
      }
    },
    onSuccess: () => {
      toast({ title: "Access updated" });
      queryClient.invalidateQueries({ queryKey: ["readymade-access-rows", mode] });
      queryClient.invalidateQueries({ queryKey: ["course-readymade-full-access", courseId] });
      setPendingSelection(null);
      setPendingFullAccess(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update access", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || loadingFullAccess || !tree) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading {mode === "archive-class" ? "archive class" : "readymade exam"} structure...</div>;
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
          <Checkbox checked={allSelected && (mode !== "readymade" || fullAccessSelected)} onCheckedChange={toggleAll} id={`access-all-${mode}`} />
          <label htmlFor={`access-all-${mode}`} className="text-sm font-semibold cursor-pointer">{mode === "archive-class" ? "All Archive Classes" : "All Readymade Exams"}</label>
          {mode === "readymade" && fullAccessSelected && (
            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Auto-includes future exams</span>
          )}
        </div>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || (!pendingSelection && pendingFullAccess === null)}>
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
                      const isSingleGeneralLeaf = Object.keys(subChapters).length === 1 && Object.keys(subChapters)[0] === "সাধারণ";

                      return (
                        <div key={chapter}>
                          <div className="flex items-center gap-2 px-3 py-2 pl-8 cursor-pointer hover:bg-muted/30" onClick={() => { if (isSingleGeneralLeaf) toggleLeaf(leafKeys[0]); else setExpandedChapters((prev) => { const n = new Set(prev); n.has(chapterKey) ? n.delete(chapterKey) : n.add(chapterKey); return n; }); }}>
                            {!isSingleGeneralLeaf && (chapterExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />)}
                            <Checkbox
                              checked={chapterAllSelected ? true : (chapterSomeSelected ? "indeterminate" : false)}
                              onCheckedChange={() => toggleChapter(subject, chapter, leafKeys)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-sm">{chapter}</span>
                            {isSingleGeneralLeaf && <span className="text-xs text-muted-foreground ml-auto">{subChapters["সাধারণ"].length} item{subChapters["সাধারণ"].length !== 1 ? "s" : ""}</span>}
                          </div>

                          {!isSingleGeneralLeaf && chapterExpanded && (
                            <div className="pl-14 pb-1">
                              {Object.entries(subChapters).map(([subChapter, ids]) => {
                                const key = `${subject}|||${chapter}|||${subChapter}`;
                                return (
                                  <div key={subChapter} className="flex items-center gap-2 py-1.5">
                                    <Checkbox checked={selection.has(key)} onCheckedChange={() => toggleLeaf(key)} id={key} />
                                    <label htmlFor={key} className="text-sm cursor-pointer flex-1">{subChapter}</label>
                                    <span className="text-xs text-muted-foreground">{ids.length} item{ids.length !== 1 ? "s" : ""}</span>
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

