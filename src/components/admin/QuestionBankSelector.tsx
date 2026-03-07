import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2 } from "lucide-react";
import MathText from "@/components/MathText";
import { useGlobalMetadata } from "@/hooks/useGlobalMetadata";
import { CreatableSelect } from "@/components/ui/creatable-select";

interface QuestionBankSelectorProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelect: (questions: any[]) => void;
}

export const QuestionBankSelector = ({ onSelect }: QuestionBankSelectorProps) => {
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState({
        subject: "",
        chapter: "",
        topic: "",
        exam_code: "",
        year: "",
    });
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 50;
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Global Metadata Hook
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: globalMeta } = useGlobalMetadata() as any;

    const { data: questionsData, isLoading } = useQuery({
        queryKey: ["question-bank-selector", page, search, filters],
        queryFn: async () => {
            let query = supabase
                .from("question_bank")
                .select("*", { count: 'exact' });

            if (search) {
                query = query.ilike('question_text', `%${search}%`);
            }

            if (filters.subject) query = query.eq('subject', filters.subject);
            if (filters.chapter) query = query.eq('chapter', filters.chapter);
            if (filters.topic) query = query.eq('topic', filters.topic);
            if (filters.exam_code) query = query.eq('exam_code', filters.exam_code);
            if (filters.year) query = query.eq('year', filters.year);

            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            return { data, count };
        }
    });

    const handleToggle = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleConfirm = () => {
        if (selectedIds.size === 0) return;

        const fetchSelected = async () => {
            const { data, error } = await supabase
                .from("question_bank")
                .select("*")
                .in("id", Array.from(selectedIds));

            if (error) {
                console.error(error);
                return;
            }

            // Map to Question format expected by ExamCreator
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped = data.map((q: any) => ({
                question: q.question_text,
                options: {
                    A: q.option_a,
                    B: q.option_b,
                    C: q.option_c,
                    D: q.option_d,
                },
                correct_answer: q.correct_option,
                explanation: q.explanation || ""
            }));

            onSelect(mapped);
            setSelectedIds(new Set());
        };

        fetchSelected();
    };

    return (
        <div className="flex flex-col h-full bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="p-2 sm:p-3 border-b bg-muted/20">
                <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            className="pl-7 h-8 text-xs sm:text-sm"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-2 sm:flex gap-2">
                        <CreatableSelect
                            options={[{ label: "Subject", value: "all" }, ...(globalMeta?.subject || [])]}
                            value={filters.subject}
                            onChange={(val) => {
                                setFilters(prev => ({ ...prev, subject: val === 'all' ? '' : val }));
                                setPage(1);
                            }}
                            placeholder="Subject"
                            className="h-8 text-xs sm:text-sm min-w-[100px]"
                        />
                        <CreatableSelect
                            options={[{ label: "Chapter", value: "all" }, ...(globalMeta?.chapter || [])]}
                            value={filters.chapter}
                            onChange={(val) => {
                                setFilters(prev => ({ ...prev, chapter: val === 'all' ? '' : val }));
                                setPage(1);
                            }}
                            placeholder="Chapter"
                            className="h-8 text-xs sm:text-sm min-w-[100px]"
                        />
                        <CreatableSelect
                            options={[{ label: "Code", value: "all" }, ...(globalMeta?.exam_code || [])]}
                            value={filters.exam_code}
                            onChange={(val) => {
                                setFilters(prev => ({ ...prev, exam_code: val === 'all' ? '' : val }));
                                setPage(1);
                            }}
                            placeholder="Code"
                            className="h-8 text-xs sm:text-sm min-w-[90px]"
                        />
                        <CreatableSelect
                            options={[{ label: "Year", value: "all" }, ...(globalMeta?.year || [])]}
                            value={filters.year}
                            onChange={(val) => {
                                setFilters(prev => ({ ...prev, year: val === 'all' ? '' : val }));
                                setPage(1);
                            }}
                            placeholder="Year"
                            className="h-8 text-xs sm:text-sm min-w-[90px]"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-background/50">
                <div className="p-2 sm:p-3">
                        {isLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                        ) : (
                            <div className="divide-y">
                                {questionsData?.data?.length === 0 && (
                                    <div className="text-center py-6 text-sm text-muted-foreground">No questions found.</div>
                                )}
                                {questionsData?.data?.map((q) => (
                                    <div key={q.id} className="p-2 flex items-start gap-2 hover:bg-muted/50 rounded-md transition-colors">
                                        <Checkbox
                                            checked={selectedIds.has(q.id)}
                                            onCheckedChange={() => handleToggle(q.id)}
                                            className="mt-0.5"
                                        />
                                        <div className="flex-1 space-y-0.5 min-w-0">
                                            <div className="flex flex-wrap gap-1 text-[9px] sm:text-[10px]">
                                                {q.subject && <Badge variant="outline" className="h-4 px-1 py-0">{q.subject}</Badge>}
                                                {q.exam_code && <Badge className="h-4 px-1 py-0 bg-purple-100 text-purple-800">{q.exam_code} {q.year}</Badge>}
                                                <Badge variant="outline" className="h-4 px-1 py-0 capitalize">{q.difficulty}</Badge>
                                            </div>
                                            <div className="text-xs sm:text-sm line-clamp-2">
                                                 <MathText text={q.question_text} inline />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                </div>
            </div>

            <div className="p-2 sm:p-3 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2 order-2 sm:order-1 w-full sm:w-auto justify-between sm:justify-start">
                     {questionsData && questionsData.count > PAGE_SIZE && (
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                            <span className="text-[10px] sm:text-xs min-w-[40px] text-center">Pg {page}</span>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= questionsData.count}>Next</Button>
                        </div>
                    )}
                    <div className="text-xs font-medium sm:hidden">
                        {selectedIds.size} selected
                    </div>
                </div>

                <div className="flex items-center gap-3 order-1 sm:order-2 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-xs font-medium hidden sm:block">
                        {selectedIds.size} selected
                    </div>
                    <Button size="sm" className="h-8 w-full sm:w-auto text-xs" onClick={handleConfirm} disabled={selectedIds.size === 0}>
                       Add ({selectedIds.size})
                    </Button>
                </div>
            </div>
        </div>
    );
};
