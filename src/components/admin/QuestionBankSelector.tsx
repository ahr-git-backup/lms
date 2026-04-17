import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, ChevronLeft, ChevronRight, BookOpen, Clock, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import MathText from "@/components/MathText";
import { QuestionData } from "@/types/exam";
import { useGlobalMetadata } from "@/hooks/useGlobalMetadata";
import { Card } from "@/components/ui/card";

interface QuestionBankSelectorProps {
    onSelect: (questions: QuestionData[]) => void;
}

export const QuestionBankSelector = ({ onSelect }: QuestionBankSelectorProps) => {
    const [view, setView] = useState<'category' | 'subjects' | 'exams' | 'questions'>('category');

    // Selection state
    const [selectedCategory, setSelectedCategory] = useState<'exams' | 'readymade' | 'archive' | null>(null);
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
    const [selectedExamTitle, setSelectedExamTitle] = useState<string>("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Search and pagination (for questions view)
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 50;

    // Reset flow
    const resetFlow = () => {
        setView('category');
        setSelectedCategory(null);
        setSelectedSubjects([]);
        setSelectedExamId(null);
        setSelectedIds(new Set());
    };
    // Fetch subjects for the selected category (from exams)
    const { data: subjectsData, isLoading: isLoadingSubjects } = useQuery({
        queryKey: ["qb-subjects", selectedCategory],
        enabled: view === 'subjects' && !!selectedCategory,
        queryFn: async () => {
            let query = supabase.from("exams").select("subject");

            if (selectedCategory === 'readymade') {
                query = query.eq('is_readymade', true);
            } else if (selectedCategory === 'archive') {
                query = query.eq('is_archive', true);
            } else {
                query = query.eq('is_readymade', false).eq('is_archive', false);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Extract unique subjects
            const subjectsSet = new Set<string>();
            data.forEach((exam: any) => {
                if (exam.subject && Array.isArray(exam.subject)) {
                    exam.subject.forEach((s: string) => subjectsSet.add(s));
                }
            });

            return Array.from(subjectsSet).sort();
        }
    });

    // Fetch exams for selected subjects and category
    const { data: examsData, isLoading: isLoadingExams } = useQuery({
        queryKey: ["qb-exams", selectedCategory, selectedSubjects],
        enabled: view === 'exams' && !!selectedCategory && selectedSubjects.length > 0,
        queryFn: async () => {
            let query = supabase.from("exams").select("id, title, is_readymade, is_archive, subject");

            if (selectedCategory === 'readymade') {
                query = query.eq('is_readymade', true);
            } else if (selectedCategory === 'archive') {
                query = query.eq('is_archive', true);
            } else {
                query = query.eq('is_readymade', false).eq('is_archive', false);
            }

            // In Supabase, filtering array columns by intersection can be tricky.
            // We'll fetch exams and filter in memory if array overlaps aren't supported directly easily.
            // Using cs (contains) is possible, but multiple subjects -> we want any match (overlap).
            if (selectedSubjects.length > 0) {
                 query = query.overlaps('subject', selectedSubjects);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    // Fetch questions for selected exam
    const { data: questionsData, isLoading: isLoadingQuestions } = useQuery({
        queryKey: ["qb-questions", selectedExamId, page, search],
        enabled: view === 'questions' && !!selectedExamId,
        queryFn: async () => {
            let query = supabase
                .from("exam_questions")
                .select("*", { count: 'exact' })
                .eq('exam_id', selectedExamId);

            if (search) {
                query = query.ilike('question_text', `%${search}%`);
            }

            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error, count } = await query
                .order('question_index', { ascending: true })
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
                .from("exam_questions")
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
            // Don't reset selected IDs immediately, let them continue or we can clear
            setSelectedIds(new Set());
        };

        fetchSelected();
    };

    return (
        <div className="flex flex-col h-full bg-card border rounded-xl shadow-sm overflow-hidden">
            {/* Header / Breadcrumb */}
            <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {view !== 'category' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
                            if (view === 'questions') setView('exams');
                            else if (view === 'exams') setView('subjects');
                            else if (view === 'subjects') setView('category');
                        }}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <span
                        className={`cursor-pointer hover:text-foreground transition-colors ${view === 'category' ? 'text-foreground font-semibold' : ''}`}
                        onClick={() => setView('category')}
                    >
                        Category
                    </span>

                    {(view === 'subjects' || view === 'exams' || view === 'questions') && (
                        <>
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <span
                                className={`cursor-pointer hover:text-foreground transition-colors capitalize ${view === 'subjects' ? 'text-foreground font-semibold' : ''}`}
                                onClick={() => setView('subjects')}
                            >
                                {selectedCategory || "..."}
                            </span>
                        </>
                    )}

                    {(view === 'exams' || view === 'questions') && (
                        <>
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <span
                                className={`cursor-pointer hover:text-foreground transition-colors ${view === 'exams' ? 'text-foreground font-semibold' : ''}`}
                                onClick={() => setView('exams')}
                            >
                                Subjects ({selectedSubjects.length})
                            </span>
                        </>
                    )}

                    {view === 'questions' && (
                        <>
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <span className="text-foreground font-semibold truncate max-w-[150px] sm:max-w-[200px]" title={selectedExamTitle}>
                                {selectedExamTitle}
                            </span>
                        </>
                    )}
                </div>

                {selectedIds.size > 0 && view === 'questions' && (
                    <Button size="sm" className="h-7 text-xs shrink-0" onClick={handleConfirm}>
                        Add ({selectedIds.size})
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-background/50 p-4">
                {/* View 1: Category Selection */}
                {view === 'category' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-4">
                        <Card
                            className="p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all text-center flex flex-col items-center gap-3"
                            onClick={() => { setSelectedCategory('exams'); setView('subjects'); }}
                        >
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                                <BookOpen className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Regular Exams</h3>
                                <p className="text-sm text-muted-foreground mt-1">Live and practice exams of courses</p>
                            </div>
                        </Card>

                        <Card
                            className="p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all text-center flex flex-col items-center gap-3"
                            onClick={() => { setSelectedCategory('readymade'); setView('subjects'); }}
                        >
                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                                <Clock className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Readymade</h3>
                                <p className="text-sm text-muted-foreground mt-1">Exams marked as readymade</p>
                            </div>
                        </Card>

                        <Card
                            className="p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all text-center flex flex-col items-center gap-3"
                            onClick={() => { setSelectedCategory('archive'); setView('subjects'); }}
                        >
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                                <Archive className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Archive</h3>
                                <p className="text-sm text-muted-foreground mt-1">Past and archived exams</p>
                            </div>
                        </Card>
                    </div>
                )}

                {/* View 2: Subjects Selection */}
                {view === 'subjects' && (
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Select Subjects</h3>
                            <Button
                                onClick={() => setView('exams')}
                                disabled={selectedSubjects.length === 0}
                            >
                                Continue ({selectedSubjects.length})
                            </Button>
                        </div>

                        {isLoadingSubjects ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                        ) : subjectsData?.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">No subjects found in this category.</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {subjectsData?.map((subject: string) => (
                                    <div
                                        key={subject}
                                        onClick={() => {
                                            setSelectedSubjects(prev =>
                                                prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
                                            );
                                        }}
                                        className={`p-3 rounded-lg border cursor-pointer text-center text-sm font-medium transition-all ${
                                            selectedSubjects.includes(subject)
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-card hover:border-primary/50 hover:bg-muted/50'
                                        }`}
                                    >
                                        {subject}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* View 3: Exams Selection */}
                {view === 'exams' && (
                    <div className="max-w-4xl mx-auto">
                        <h3 className="text-lg font-semibold mb-4">Select an Exam</h3>

                        {isLoadingExams ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                        ) : examsData?.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">No exams found for the selected subjects.</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {examsData?.map((exam: any) => (
                                    <div
                                        key={exam.id}
                                        onClick={() => {
                                            setSelectedExamId(exam.id);
                                            setSelectedExamTitle(exam.title);
                                            setPage(1);
                                            setSearch("");
                                            setView('questions');
                                        }}
                                        className="p-4 rounded-lg border bg-card cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all flex flex-col gap-2"
                                    >
                                        <div className="font-medium line-clamp-2">{exam.title}</div>
                                        <div className="flex flex-wrap gap-1 mt-auto">
                                            {exam.subject?.slice(0, 3).map((sub: string) => (
                                                <Badge key={sub} variant="secondary" className="text-[10px] py-0">{sub}</Badge>
                                            ))}
                                            {(exam.subject?.length || 0) > 3 && (
                                                <Badge variant="secondary" className="text-[10px] py-0">+{exam.subject.length - 3}</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* View 4: Questions Selection */}
                {view === 'questions' && (
                    <div className="h-full flex flex-col">
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search questions..."
                                className="pl-9 bg-background"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>

                        {isLoadingQuestions ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                        ) : questionsData?.data?.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">No questions found in this exam.</div>
                        ) : (
                            <div className="space-y-3 pb-4">
                                {questionsData?.data?.map((q: any) => (
                                    <div
                                        key={q.id}
                                        className={`p-4 rounded-lg border transition-all cursor-pointer ${selectedIds.has(q.id) ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-card hover:border-primary/30'}`}
                                        onClick={() => handleToggle(q.id)}
                                    >
                                        <div className="flex gap-3">
                                            <div className="pt-1">
                                                <Checkbox
                                                    checked={selectedIds.has(q.id)}
                                                    onCheckedChange={() => handleToggle(q.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div className="flex-1 space-y-3 min-w-0">
                                                <div className="text-sm font-medium">
                                                    <span className="text-muted-foreground mr-2">{q.question_index}.</span>
                                                    <MathText text={q.question_text} />
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                    <div className={`p-2 rounded border ${q.correct_option === 'A' ? 'bg-green-100/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-muted/30'}`}>
                                                        <span className="font-semibold mr-2">A.</span> <MathText text={q.option_a} inline />
                                                    </div>
                                                    <div className={`p-2 rounded border ${q.correct_option === 'B' ? 'bg-green-100/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-muted/30'}`}>
                                                        <span className="font-semibold mr-2">B.</span> <MathText text={q.option_b} inline />
                                                    </div>
                                                    <div className={`p-2 rounded border ${q.correct_option === 'C' ? 'bg-green-100/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-muted/30'}`}>
                                                        <span className="font-semibold mr-2">C.</span> <MathText text={q.option_c} inline />
                                                    </div>
                                                    <div className={`p-2 rounded border ${q.correct_option === 'D' ? 'bg-green-100/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-muted/30'}`}>
                                                        <span className="font-semibold mr-2">D.</span> <MathText text={q.option_d} inline />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Questions Pagination Footer */}
            {view === 'questions' && questionsData && questionsData.count > PAGE_SIZE && (
                <div className="p-2 sm:p-3 border-t bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                        <span className="text-[10px] sm:text-xs min-w-[40px] text-center">Pg {page}</span>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= questionsData.count}>Next</Button>
                    </div>
                    <div className="text-xs text-muted-foreground hidden sm:block">
                        Total {questionsData.count} questions
                    </div>
                </div>
            )}
        </div>
    );
};
