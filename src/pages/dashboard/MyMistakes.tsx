import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const MyMistakes = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [filterMode, setFilterMode] = useState<"wrong" | "skipped" | "both">("both");
    const [category, setCategory] = useState<"all" | "live" | "practice" | "readymade">("all");
    const [readymadeSubCategory, setReadymadeSubCategory] = useState<string | null>(null);
    const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 10;

    const { data: exams, isLoading } = useQuery({
        queryKey: ["my-mistakes-exams", user?.id],
        queryFn: async () => {
            if (!user) return [];
            // Fetch exams that user has attempted
            const { data, error } = await supabase
                .from("exam_attempts")
                .select(`
                    exam_id,
                    submitted_at,
                    exams (
                        id,
                        title,
                        subject,
                        exam_type,
                        readymade_topic,
                        time_window_end
                    )
                `)
                .eq("profile_id", user.id)
                .order("submitted_at", { ascending: false });

            if (error) throw error;

            // De-duplicate exams (keep latest attempt info)

            const uniqueExamsMap = new Map();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.forEach((attempt: any) => {
                if (attempt.exams && !uniqueExamsMap.has(attempt.exam_id)) {
                    const examData = attempt.exams;
                    const subjectDisplay = Array.isArray(examData.subject)
                        ? examData.subject.join(", ")
                        : (examData.subject || "General");

                    const isReadymade = !!examData.readymade_topic;
                    const isExpiredLive = examData.exam_type === 'live' && examData.time_window_end && new Date() > new Date(examData.time_window_end);
                    const category = isReadymade ? 'readymade' : (isExpiredLive ? 'practice' : (examData.exam_type === 'live' ? 'live' : 'practice'));

                    uniqueExamsMap.set(attempt.exam_id, {
                        id: examData.id,
                        title: examData.title,
                        subject: subjectDisplay,
                        lastAttempt: attempt.submitted_at,
                        category,
                        readymadeTopic: examData.readymade_topic || null,
                    });
                }
            });
            return Array.from(uniqueExamsMap.values());
        },
        enabled: !!user
    });

    const readymadeTopics = Array.from(new Set((exams || []).filter((e: any) => e.category === 'readymade' && e.readymadeTopic).map((e: any) => e.readymadeTopic)));

    const categoryFilteredExams = (exams || []).filter((e: any) => {
        if (category === 'all') return true;
        if (category === 'readymade') {
            if (e.category !== 'readymade') return false;
            if (readymadeSubCategory) return e.readymadeTopic === readymadeSubCategory;
            return true;
        }
        return e.category === category;
    });

    const handleSelectAll = () => {
        setSelectedExamIds(categoryFilteredExams.map((e: any) => e.id));
    };

    const handleDeselectAll = () => {
        setSelectedExamIds([]);
    };

    const toggleExam = (id: string) => {
        setSelectedExamIds(prev =>
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        );
    };

    const handleStart = () => {
        if (selectedExamIds.length === 0) return;
        navigate("/dashboard/take-mistakes", {
            state: { examIds: selectedExamIds, filterMode }
        });
    };

    const paginatedExams = categoryFilteredExams.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages = Math.ceil((categoryFilteredExams.length || 0) / PAGE_SIZE);

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    }

    return (
        <div className="container mx-auto px-2 py-3 md:px-4 space-y-3">
            <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                    <h1 className="text-lg font-bold leading-tight">My Mistakes</h1>
                    <p className="text-xs text-muted-foreground">Practice questions you missed or skipped.</p>
                </div>
            </div>

            {/* Category Row */}
            <div className="flex flex-wrap gap-1.5">
                {([
                    { key: 'all', label: 'All' },
                    { key: 'live', label: 'Live Exam' },
                    { key: 'practice', label: 'Practice Exam' },
                    { key: 'readymade', label: 'Readymade Exam' },
                ] as const).map(c => (
                    <Button
                        key={c.key}
                        size="sm"
                        variant={category === c.key ? 'default' : 'outline'}
                        className="h-7 px-2.5 text-xs"
                        onClick={() => { setCategory(c.key); setReadymadeSubCategory(null); setPage(0); }}
                    >
                        {c.label}
                    </Button>
                ))}
            </div>

            {/* Readymade Sub-category Row */}
            {category === 'readymade' && readymadeTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                    <Button
                        size="sm"
                        variant={!readymadeSubCategory ? 'secondary' : 'ghost'}
                        className="h-6 px-2 text-[11px]"
                        onClick={() => { setReadymadeSubCategory(null); setPage(0); }}
                    >
                        All Topics
                    </Button>
                    {readymadeTopics.map((topic: string) => (
                        <Button
                            key={topic}
                            size="sm"
                            variant={readymadeSubCategory === topic ? 'secondary' : 'ghost'}
                            className="h-6 px-2 text-[11px]"
                            onClick={() => { setReadymadeSubCategory(topic); setPage(0); }}
                        >
                            {topic}
                        </Button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Configuration Panel */}
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader className="py-2.5 px-3">
                        <CardTitle className="text-sm">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-3 pb-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium">Question Filter</label>
                            <div className="flex flex-col gap-1.5">
                                <div
                                    className={`p-2 border rounded-md cursor-pointer transition-all ${filterMode === 'wrong' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                    onClick={() => setFilterMode('wrong')}
                                >
                                    <div className="text-xs font-medium">Wrong Only</div>
                                    <div className="text-[10px] text-muted-foreground">Questions you attempted but got wrong</div>
                                </div>
                                <div
                                    className={`p-2 border rounded-md cursor-pointer transition-all ${filterMode === 'skipped' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                    onClick={() => setFilterMode('skipped')}
                                >
                                    <div className="text-xs font-medium">Skipped Only</div>
                                    <div className="text-[10px] text-muted-foreground">Questions you didn't answer</div>
                                </div>
                                <div
                                    className={`p-2 border rounded-md cursor-pointer transition-all ${filterMode === 'both' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                    onClick={() => setFilterMode('both')}
                                >
                                    <div className="text-xs font-medium">Both</div>
                                    <div className="text-[10px] text-muted-foreground">All incorrect and unattempted questions</div>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full h-10"
                            disabled={selectedExamIds.length === 0}
                            onClick={handleStart}
                        >
                            <PlayCircle className="mr-2 h-4 w-4" /> Start Practice
                        </Button>
                        <p className="text-[11px] text-center text-muted-foreground">
                            {selectedExamIds.length} exams selected
                        </p>
                    </CardContent>
                </Card>

                {/* Exam Selection List */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2.5 px-3">
                        <CardTitle className="text-sm">Select Exams</CardTitle>
                        <div className="flex gap-1.5">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleSelectAll}>All</Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleDeselectAll}>None</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                        {categoryFilteredExams.length > 0 ? (
                            <div className="space-y-3">
                                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                                    {paginatedExams.map((exam: any) => (
                                        <div
                                            key={exam.id}
                                            className="flex items-start space-x-2 p-2 rounded-md border hover:bg-muted/50 transition-colors"
                                        >
                                            <Checkbox
                                                id={exam.id}
                                                checked={selectedExamIds.includes(exam.id)}
                                                onCheckedChange={() => toggleExam(exam.id)}
                                            />
                                            <div className="grid gap-1 leading-none w-full cursor-pointer" onClick={() => toggleExam(exam.id)}>
                                                <div className="flex justify-between items-start gap-2">
                                                    <label
                                                        htmlFor={exam.id}
                                                        className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {exam.title}
                                                    </label>
                                                    {exam.subject && (
                                                        <Badge variant="outline" className="text-[10px] shrink-0">{exam.subject}</Badge>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Last attempt: {format(new Date(exam.lastAttempt), "PP")}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-2 border-t">
                                        <div className="text-[11px] text-muted-foreground">
                                            Page {page + 1} of {totalPages}
                                        </div>
                                        <div className="flex gap-1.5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                                disabled={page === 0}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                                disabled={page >= totalPages - 1}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-xs text-muted-foreground">
                                No exams found in this category.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default MyMistakes;
