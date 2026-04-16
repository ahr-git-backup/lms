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
                        subject
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

                    uniqueExamsMap.set(attempt.exam_id, {
                        id: examData.id,
                        title: examData.title,
                        subject: subjectDisplay,
                        lastAttempt: attempt.submitted_at
                    });
                }
            });
            return Array.from(uniqueExamsMap.values());
        },
        enabled: !!user
    });

    const handleSelectAll = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (exams) setSelectedExamIds(exams.map((e: any) => e.id));
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

    const paginatedExams = exams?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages = Math.ceil((exams?.length || 0) / PAGE_SIZE);

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">My Mistakes</h1>
                    <p className="text-muted-foreground">Practice questions you missed or skipped.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Question Filter</label>
                            <div className="flex flex-col gap-2">
                                <div
                                    className={`p-3 border rounded-lg cursor-pointer transition-all ${filterMode === 'wrong' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                    onClick={() => setFilterMode('wrong')}
                                >
                                    <div className="font-medium">Wrong Only</div>
                                    <div className="text-xs text-muted-foreground">Questions you attempted but got wrong</div>
                                </div>
                                <div
                                    className={`p-3 border rounded-lg cursor-pointer transition-all ${filterMode === 'skipped' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                    onClick={() => setFilterMode('skipped')}
                                >
                                    <div className="font-medium">Skipped Only</div>
                                    <div className="text-xs text-muted-foreground">Questions you didn't answer</div>
                                </div>
                                <div
                                    className={`p-3 border rounded-lg cursor-pointer transition-all ${filterMode === 'both' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                    onClick={() => setFilterMode('both')}
                                >
                                    <div className="font-medium">Both</div>
                                    <div className="text-xs text-muted-foreground">All incorrect and unattempted questions</div>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full text-lg h-12"
                            disabled={selectedExamIds.length === 0}
                            onClick={handleStart}
                        >
                            <PlayCircle className="mr-2 h-5 w-5" /> Start Practice
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                            {selectedExamIds.length} exams selected
                        </p>
                    </CardContent>
                </Card>

                {/* Exam Selection List */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <CardTitle>Select Exams</CardTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleSelectAll}>All</Button>
                            <Button variant="ghost" size="sm" onClick={handleDeselectAll}>None</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {exams && exams.length > 0 ? (
                            <div className="space-y-4">
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {paginatedExams?.map((exam: any) => (
                                        <div
                                            key={exam.id}
                                            className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                        >
                                            <Checkbox
                                                id={exam.id}
                                                checked={selectedExamIds.includes(exam.id)}
                                                onCheckedChange={() => toggleExam(exam.id)}
                                            />
                                            <div className="grid gap-1.5 leading-none w-full cursor-pointer" onClick={() => toggleExam(exam.id)}>
                                                <div className="flex justify-between items-start gap-2">
                                                    <label
                                                        htmlFor={exam.id}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {exam.title}
                                                    </label>
                                                    {exam.subject && (
                                                        <Badge variant="outline" className="text-[10px] shrink-0">{exam.subject}</Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Last attempt: {format(new Date(exam.lastAttempt), "PP")}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-2 border-t">
                                        <div className="text-xs text-muted-foreground">
                                            Page {page + 1} of {totalPages}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                                disabled={page === 0}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
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
                            <div className="text-center py-8 text-muted-foreground">
                                No past exams found.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default MyMistakes;
