import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import MathText from "@/components/MathText";
import { SUBJECTS } from "@/lib/constants";

interface QuestionBankSelectorProps {
    open: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelect: (questions: any[]) => void;
}

export const QuestionBankSelector = ({ open, onClose, onSelect }: QuestionBankSelectorProps) => {
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState({
        subject: "",
        chapter: "",
        topic: "",
        exam_code: "",
        year: "",
    });
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 5;
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Fetch Metadata for Filters (Lightweight)
    const { data: metadata } = useQuery({
        queryKey: ["question-bank-metadata-selector-global"],
        queryFn: async () => {
            // Parallel fetches from all relevant tables
            const [
                { data: qbData },
                { data: examsData },
                { data: notesData },
                { data: classesData }
            ] = await Promise.all([
                supabase.from("question_bank").select("subject, chapter, topic, exam_code, year"),
                supabase.from("exams").select("subject, chapter"),
                supabase.from("class_notes").select("subject, chapter, topic"),
                supabase.from("classes").select("subject, chapter, topic")
            ]);

            const subjects = new Set<string>();
            const chapters = new Set<string>();
            const topics = new Set<string>();
            const examCodes = new Set<string>();
            const years = new Set<string>();

            // Add Constants
            SUBJECTS.forEach(s => subjects.add(s));

            // Process Question Bank Data
            qbData?.forEach(item => {
                if (item.subject) subjects.add(item.subject);
                if (item.chapter) chapters.add(item.chapter);
                if (item.topic) topics.add(item.topic);
                if (item.exam_code) examCodes.add(item.exam_code);
                if (item.year) years.add(item.year);
            });

            // Process Exams Data
            examsData?.forEach(item => {
                if (Array.isArray(item.subject)) item.subject.forEach((s: string) => subjects.add(s));
                else if (item.subject) subjects.add(item.subject);

                if (item.chapter) chapters.add(item.chapter);
            });

            // Process Notes Data
            notesData?.forEach(item => {
                if (item.subject) subjects.add(item.subject);
                if (item.chapter) chapters.add(item.chapter);
                if (item.topic) topics.add(item.topic);
            });

            // Process Classes Data
            classesData?.forEach(item => {
                if (Array.isArray(item.subject)) item.subject.forEach((s: string) => subjects.add(s));
                else if (item.subject) subjects.add(item.subject);

                if (item.chapter) chapters.add(item.chapter);
                if (item.topic) topics.add(item.topic);
            });

            return {
                subjects: Array.from(subjects).sort().map(s => ({ label: s, value: s })),
                chapters: Array.from(chapters).sort().map(s => ({ label: s, value: s })),
                topics: Array.from(topics).sort().map(s => ({ label: s, value: s })),
                examCodes: Array.from(examCodes).sort().map(s => ({ label: s, value: s })),
                years: Array.from(years).sort().map(s => ({ label: s, value: s })),
            };
        },
        enabled: open
    });

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
        },
        enabled: open
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
            const mapped = data.map(q => ({
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
            onClose();
            setSelectedIds(new Set());
        };

        fetchSelected();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Select Questions from Bank</DialogTitle>
                    <DialogDescription>Filter and select questions to import into the exam.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div className="col-span-2 md:col-span-1 relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                className="pl-8 h-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={filters.subject} onValueChange={(val) => setFilters(prev => ({ ...prev, subject: val === 'all' ? '' : val }))}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Subject" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Subjects</SelectItem>
                                {metadata?.subjects.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filters.chapter} onValueChange={(val) => setFilters(prev => ({ ...prev, chapter: val === 'all' ? '' : val }))}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Chapter" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Chapters</SelectItem>
                                {metadata?.chapters.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={filters.exam_code} onValueChange={(val) => setFilters(prev => ({ ...prev, exam_code: val === 'all' ? '' : val }))}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Code" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Codes</SelectItem>
                                {metadata?.examCodes.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={filters.year} onValueChange={(val) => setFilters(prev => ({ ...prev, year: val === 'all' ? '' : val }))}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Year" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Years</SelectItem>
                                {metadata?.years.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="border rounded-md min-h-[300px] max-h-[400px] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : (
                            <div className="divide-y">
                                {questionsData?.data?.length === 0 && (
                                    <div className="text-center py-10 text-muted-foreground">No questions found.</div>
                                )}
                                {questionsData?.data?.map((q) => (
                                    <div key={q.id} className="p-3 flex items-start gap-3 hover:bg-muted/50">
                                        <Checkbox
                                            checked={selectedIds.has(q.id)}
                                            onCheckedChange={() => handleToggle(q.id)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1 space-y-1">
                                            <div className="flex flex-wrap gap-2 text-[10px] mb-1">
                                                {q.subject && <Badge variant="outline" className="h-5 px-1">{q.subject}</Badge>}
                                                {q.exam_code && <Badge className="h-5 px-1 bg-purple-100 text-purple-800">{q.exam_code} {q.year}</Badge>}
                                                <Badge variant="outline" className="h-5 px-1 capitalize">{q.difficulty}</Badge>
                                            </div>
                                            <div className="text-sm line-clamp-2">
                                                 <MathText text={q.question_text} inline />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                     {questionsData && questionsData.count > PAGE_SIZE && (
                        <div className="flex justify-center gap-2 pt-2">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                            <span className="flex items-center text-sm">Page {page}</span>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= questionsData.count}>Next</Button>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between w-full">
                    <div className="text-sm text-muted-foreground self-center">
                        {selectedIds.size} selected
                    </div>
                    <div className="flex gap-2">
                         <Button variant="outline" onClick={onClose}>Cancel</Button>
                         <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
                            Add Selected ({selectedIds.size})
                         </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
