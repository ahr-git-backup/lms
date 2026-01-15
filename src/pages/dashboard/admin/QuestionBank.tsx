import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QuestionEditor, QuestionData } from "@/components/admin/QuestionEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Search, Filter, Edit2, Trash2, ArrowLeft } from "lucide-react";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { MultiSelect } from "@/components/ui/multi-select";
import MathText from "@/components/MathText";

interface QuestionBankItem extends QuestionData {
    subject: string;
    chapter: string;
    topic: string;
    exam_code: string;
    year: string;
    difficulty: string;
    tags: string[];
    // Mapped fields for display
    question_text?: string;
    option_a?: string;
    option_b?: string;
    option_c?: string;
    option_d?: string;
    correct_option?: string;
    created_at?: string;
}

const QuestionBank = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState({
        subject: "",
        chapter: "",
        topic: "",
        exam_code: "",
        year: "",
    });
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Editing State
    const emptyQuestion: QuestionBankItem = {
        question: "",
        options: { A: "", B: "", C: "", D: "" },
        correct_answer: "",
        explanation: "",
        subject: "",
        chapter: "",
        topic: "",
        exam_code: "",
        year: "",
        difficulty: "medium",
        tags: []
    };
    const [formData, setFormData] = useState<QuestionBankItem>(emptyQuestion);

    // Fetch Metadata for Filters
    const { data: metadata } = useQuery({
        queryKey: ["question-bank-metadata"],
        queryFn: async () => {
            const { data, error } = await supabase.from("question_bank").select("subject, chapter, topic, exam_code, year, tags");
            if (error) throw error;

            const subjects = new Set<string>();
            const chapters = new Set<string>();
            const topics = new Set<string>();
            const examCodes = new Set<string>();
            const years = new Set<string>();
            const tags = new Set<string>();

            data?.forEach(item => {
                if (item.subject) subjects.add(item.subject);
                if (item.chapter) chapters.add(item.chapter);
                if (item.topic) topics.add(item.topic);
                if (item.exam_code) examCodes.add(item.exam_code);
                if (item.year) years.add(item.year);
                if (Array.isArray(item.tags)) item.tags.forEach((t: string) => tags.add(t));
            });

            return {
                subjects: Array.from(subjects).sort().map(s => ({ label: s, value: s })),
                chapters: Array.from(chapters).sort().map(s => ({ label: s, value: s })),
                topics: Array.from(topics).sort().map(s => ({ label: s, value: s })),
                examCodes: Array.from(examCodes).sort().map(s => ({ label: s, value: s })),
                years: Array.from(years).sort().map(s => ({ label: s, value: s })),
                tags: Array.from(tags).sort().map(s => ({ label: s, value: s })),
            };
        }
    });

    // Fetch Questions
    const { data: questionsData, isLoading } = useQuery({
        queryKey: ["question-bank", page, search, filters],
        queryFn: async () => {
            let query = supabase
                .from("question_bank")
                .select("*", { count: 'exact' });

            if (search) {
                // Simple search on text
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

    const upsertMutation = useMutation({
        mutationFn: async (values: QuestionBankItem) => {
            const payload = {
                question_text: values.question,
                option_a: values.options.A,
                option_b: values.options.B,
                option_c: values.options.C,
                option_d: values.options.D,
                correct_option: values.correct_answer,
                explanation: values.explanation,
                subject: values.subject || null,
                chapter: values.chapter || null,
                topic: values.topic || null,
                exam_code: values.exam_code || null,
                year: values.year || null,
                difficulty: values.difficulty,
                tags: values.tags
            };

            if (values.id) {
                const { error } = await supabase.from("question_bank").update(payload).eq("id", values.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("question_bank").insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast({ title: "Question saved successfully" });
            queryClient.invalidateQueries({ queryKey: ["question-bank"] });
            queryClient.invalidateQueries({ queryKey: ["question-bank-metadata"] });
            setViewMode('list');
            setEditingId(null);
            setFormData(emptyQuestion);
        },
        onError: (err) => {
            toast({ title: "Error saving question", description: err.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("question_bank").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Question deleted" });
            queryClient.invalidateQueries({ queryKey: ["question-bank"] });
        },
        onError: (err) => {
            toast({ title: "Error deleting", description: err.message, variant: "destructive" });
        }
    });

    const handleEdit = (question: any) => {
        setFormData({
            id: question.id,
            question: question.question_text,
            options: {
                A: question.option_a,
                B: question.option_b,
                C: question.option_c,
                D: question.option_d,
            },
            correct_answer: question.correct_option,
            explanation: question.explanation || "",
            subject: question.subject || "",
            chapter: question.chapter || "",
            topic: question.topic || "",
            exam_code: question.exam_code || "",
            year: question.year || "",
            difficulty: question.difficulty || "medium",
            tags: question.tags || []
        });
        setEditingId(question.id);
        setViewMode('edit');
    };

    const handleCreate = () => {
        setEditingId(null);
        setFormData(emptyQuestion);
        setViewMode('edit');
    };

    if (viewMode === 'edit') {
        return (
            <div className="max-w-5xl mx-auto space-y-6">
                 <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => setViewMode('list')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">{editingId ? "Edit Question" : "Create Question"}</h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-6 rounded-xl border shadow-sm">
                    <div className="space-y-2">
                        <Label>Subject</Label>
                        <CreatableSelect
                            options={metadata?.subjects || []}
                            value={formData.subject}
                            onChange={(val) => setFormData(prev => ({ ...prev, subject: val }))}
                            onCreate={(val) => setFormData(prev => ({ ...prev, subject: val }))}
                            placeholder="Select or create Subject"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Chapter</Label>
                        <CreatableSelect
                            options={metadata?.chapters || []}
                            value={formData.chapter}
                            onChange={(val) => setFormData(prev => ({ ...prev, chapter: val }))}
                            onCreate={(val) => setFormData(prev => ({ ...prev, chapter: val }))}
                            placeholder="Select or create Chapter"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Topic</Label>
                        <CreatableSelect
                            options={metadata?.topics || []}
                            value={formData.topic}
                            onChange={(val) => setFormData(prev => ({ ...prev, topic: val }))}
                            onCreate={(val) => setFormData(prev => ({ ...prev, topic: val }))}
                            placeholder="Select or create Topic"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Exam Code (e.g. DU)</Label>
                        <CreatableSelect
                            options={metadata?.examCodes || []}
                            value={formData.exam_code}
                            onChange={(val) => setFormData(prev => ({ ...prev, exam_code: val }))}
                            onCreate={(val) => setFormData(prev => ({ ...prev, exam_code: val }))}
                            placeholder="Select or create Code"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Year</Label>
                        <CreatableSelect
                            options={metadata?.years || []}
                            value={formData.year}
                            onChange={(val) => setFormData(prev => ({ ...prev, year: val }))}
                            onCreate={(val) => setFormData(prev => ({ ...prev, year: val }))}
                            placeholder="Select or create Year"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Difficulty</Label>
                        <Select value={formData.difficulty} onValueChange={(val) => setFormData(prev => ({ ...prev, difficulty: val }))}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="easy">Easy</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label>Tags</Label>
                        <MultiSelect
                            options={metadata?.tags || []}
                            selected={formData.tags}
                            onChange={(val) => setFormData(prev => ({ ...prev, tags: val }))}
                            onCreate={(val) => setFormData(prev => ({ ...prev, tags: [...prev.tags, val] }))}
                            placeholder="Select or create Tags"
                        />
                    </div>
                </div>

                <div className="bg-card p-6 rounded-xl border shadow-sm">
                    <QuestionEditor
                        data={formData}
                        onChange={setFormData}
                        onSave={() => upsertMutation.mutate(formData)}
                        onCancel={() => setViewMode('list')}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
                    <p className="text-muted-foreground">Manage your reusable questions database.</p>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add Question
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search questions..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={filters.subject} onValueChange={(val) => setFilters(prev => ({ ...prev, subject: val === 'all' ? '' : val }))}>
                    <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {metadata?.subjects.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.chapter} onValueChange={(val) => setFilters(prev => ({ ...prev, chapter: val === 'all' ? '' : val }))}>
                    <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Chapters</SelectItem>
                        {metadata?.chapters.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.topic} onValueChange={(val) => setFilters(prev => ({ ...prev, topic: val === 'all' ? '' : val }))}>
                    <SelectTrigger><SelectValue placeholder="Topic" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Topics</SelectItem>
                        {metadata?.topics.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <Select value={filters.exam_code} onValueChange={(val) => setFilters(prev => ({ ...prev, exam_code: val === 'all' ? '' : val }))}>
                    <SelectTrigger><SelectValue placeholder="Exam Code" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Codes</SelectItem>
                        {metadata?.examCodes.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
                <div className="grid gap-4">
                    {questionsData?.data?.length === 0 && (
                        <div className="text-center py-20 text-muted-foreground">No questions found.</div>
                    )}
                    {questionsData?.data?.map((q) => (
                        <Card key={q.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <CardHeader className="p-4 bg-muted/20 border-b flex flex-row items-center justify-between">
                                <div className="flex flex-wrap gap-2 text-xs">
                                    {q.subject && <Badge variant="outline">{q.subject}</Badge>}
                                    {q.chapter && <Badge variant="secondary">{q.chapter}</Badge>}
                                    {q.topic && <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">{q.topic}</Badge>}
                                    {q.exam_code && <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">{q.exam_code} {q.year}</Badge>}
                                    <Badge variant="outline" className="capitalize">{q.difficulty}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(q)}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => {
                                        if (confirm("Delete this question?")) deleteMutation.mutate(q.id);
                                    }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <MathText text={q.question_text} className="prose prose-sm max-w-none dark:prose-invert mb-4" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    <div className={q.correct_option === 'A' ? 'font-bold text-green-600' : ''}>A: <MathText text={q.option_a} inline /></div>
                                    <div className={q.correct_option === 'B' ? 'font-bold text-green-600' : ''}>B: <MathText text={q.option_b} inline /></div>
                                    <div className={q.correct_option === 'C' ? 'font-bold text-green-600' : ''}>C: <MathText text={q.option_c} inline /></div>
                                    <div className={q.correct_option === 'D' ? 'font-bold text-green-600' : ''}>D: <MathText text={q.option_d} inline /></div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Pagination */}
                    {questionsData?.count > PAGE_SIZE && (
                        <div className="flex justify-center gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                            <span className="flex items-center text-sm">Page {page}</span>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= questionsData.count}>Next</Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QuestionBank;
