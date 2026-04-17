import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import MathText from "@/components/MathText";
import { Loader2, Check, X, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminReports = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    useEffect(() => {
        document.title = "Reports – Atlas Admin";
    }, []);

    const { data: reports, isLoading } = useQuery({
        queryKey: ["admin-reports"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("question_reports")
                .select(`
                    *,
                    question:exam_questions(
                        *,
                        exam:exams(title)
                    ),
                    reporter:profiles(full_name, registration_id)
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data;
        }
    });

    const deleteReportMutation = useMutation({
        mutationFn: async ({ reportId, userId, feedback, reportText }: { reportId: string, userId: string, feedback: string, reportText: string }) => {
            const { error } = await supabase
                .from("question_reports")
                .delete()
                .eq("id", reportId);
            if (error) throw error;


                const notificationBody = `Your report for question \"${reportText}\" was declined.

Feedback: ${feedback}`;
                await supabase.from("user_notifications").insert({
                    user_id: userId,
                    title: "Question Report Declined",
                    body: notificationBody,
                    type: "report_reply"
                });

        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
            toast({ title: "Report cleared & feedback sent" });
        },
        onError: (error) => {
            toast({ title: "Failed to delete report", description: error.message, variant: "destructive" });
        }
    });



    const DeclineDialog = ({ report }: { report: any }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [feedback, setFeedback] = useState("আপনার রিপোর্টটি সঠিক নয়, তাই গ্রহণ করা হলো না।");

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full sm:w-auto">
                        <X className="h-4 w-4 mr-2" />
                        Decline (Delete)
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Decline Report</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to decline and delete this report? You can optionally send feedback to the student.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Feedback to Student</Label>
                            <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} placeholder="Enter your feedback here..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                deleteReportMutation.mutate({ reportId: report.id, userId: report.user_id, feedback, reportText: report.report_text });
                                setIsOpen(false);
                            }}
                            disabled={deleteReportMutation.isPending}
                        >
                            {deleteReportMutation.isPending ? "Declining..." : "Decline & Send Feedback"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    const EditQuestionDialog = ({ report, onClose }: { report: any, onClose: () => void }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [qText, setQText] = useState(report.question.question_text);
        const [optA, setOptA] = useState(report.question.option_a);
        const [optB, setOptB] = useState(report.question.option_b);
        const [optC, setOptC] = useState(report.question.option_c);
        const [optD, setOptD] = useState(report.question.option_d);
        const [correct, setCorrect] = useState(report.question.correct_option);
        const [explanation, setExplanation] = useState(report.question.explanation || "");
        const [feedback, setFeedback] = useState("");
        const updateQuestionMutation = useMutation({
            mutationFn: async () => {
                // 1. Update the question
                const { error: updateError } = await supabase
                    .from("exam_questions")
                    .update({
                        question_text: qText,
                        option_a: optA,
                        option_b: optB,
                        option_c: optC,
                        option_d: optD,
                        correct_option: correct,
                        explanation: explanation
                    })
                    .eq("id", report.question.id);

                if (updateError) throw updateError;

                // 2. Delete the report
                const { error: deleteError } = await supabase
                    .from("question_reports")
                    .delete()
                    .eq("id", report.id);

                if (deleteError) throw deleteError;

                // 3. Send notification

                if (report.user_id && feedback) {
                    const notificationBody = `Your report for question \"${report.report_text}\" was resolved.

Admin Feedback: ${feedback}`;
                    await supabase.from("user_notifications").insert({
                        user_id: report.user_id,
                        title: "Question Report Resolved",
                        body: notificationBody,
                        type: "report_reply"
                    });
                }

            },
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
                toast({ title: "Question updated & report resolved" });
                setIsOpen(false);
                onClose();
            },
            onError: (error) => {
                toast({ title: "Failed to update", description: error.message, variant: "destructive" });
            }
        });

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button variant="default" size="sm" className="w-full sm:w-auto">
                        <Check className="h-4 w-4 mr-2" />
                        Edit & Resolve
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Question</DialogTitle>
                        <DialogDescription>
                            Updating this question will resolve the report.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Question Text</Label>
                            <Textarea value={qText} onChange={e => setQText(e.target.value)} rows={3} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Option A</Label>
                                <Textarea value={optA} onChange={e => setOptA(e.target.value)} rows={2} />
                            </div>
                            <div className="space-y-2">
                                <Label>Option B</Label>
                                <Textarea value={optB} onChange={e => setOptB(e.target.value)} rows={2} />
                            </div>
                            <div className="space-y-2">
                                <Label>Option C</Label>
                                <Textarea value={optC} onChange={e => setOptC(e.target.value)} rows={2} />
                            </div>
                            <div className="space-y-2">
                                <Label>Option D</Label>
                                <Textarea value={optD} onChange={e => setOptD(e.target.value)} rows={2} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Correct Option</Label>
                            <Select value={correct} onValueChange={setCorrect}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="A">A</SelectItem>
                                    <SelectItem value="B">B</SelectItem>
                                    <SelectItem value="C">C</SelectItem>
                                    <SelectItem value="D">D</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Explanation</Label>
                            <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={3} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-primary font-semibold">Feedback to Student</Label>
                            <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={2} placeholder="Optional feedback..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button onClick={() => updateQuestionMutation.mutate()} disabled={updateQuestionMutation.isPending}>
                            {updateQuestionMutation.isPending ? "Saving..." : "Save & Resolve"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    }

    if (!reports || reports.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-4">
                <AlertCircle className="h-12 w-12 text-green-500" />
                <h2 className="text-xl font-bold">All Good!</h2>
                <p>No pending question reports.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 p-2 sm:p-4 mx-auto overflow-x-hidden w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Question Reports</h1>
                    <p className="text-sm text-muted-foreground">Manage user reported mistakes.</p>
                </div>
                <div className="text-sm font-medium bg-secondary px-3 py-1 rounded-full self-start sm:self-auto">
                    {reports.length} Pending
                </div>
            </div>

            <div className="grid gap-6">
                {reports.map((report) => (
                    <Card key={report.id} className="border shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 pb-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                <div>
                                    <CardTitle className="text-base font-medium text-muted-foreground">
                                        Reported by <span className="text-foreground font-bold">{report.reporter?.full_name}</span> ({report.reporter?.registration_id})
                                    </CardTitle>
                                    <CardDescription>
                                        Exam: <span className="font-semibold text-primary">{report.question?.exam?.title}</span>
                                    </CardDescription>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {new Date(report.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4 p-4">
                            {/* The Report */}
                            <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-100 dark:border-orange-900 h-full">
                                <h3 className="text-sm font-bold text-orange-800 dark:text-orange-200 mb-2 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    User Report
                                </h3>
                                <p className="text-sm italic">"{report.report_text}"</p>
                                {report.suggested_correct_option && (
                                    <div className="mt-3 text-sm">
                                        <span className="font-semibold text-muted-foreground">Suggested Option: </span>
                                        <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded font-bold">{report.suggested_correct_option}</span>
                                    </div>
                                )}
                            </div>

                            {/* The Question */}
                            <div className="border rounded-lg p-4 bg-card h-full flex flex-col">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b">
                                    <span className="font-bold text-xs bg-secondary px-2 py-0.5 rounded">Q{report.question?.question_index}</span>
                                    <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded">Correct: <strong>{report.question?.correct_option}</strong></span>
                                </div>
                                <div className="text-sm mb-4 flex-1">
                                    <MathText text={report.question?.question_text || ""} />
                                </div>
                                <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground mt-auto">
                                    <div className={`p-1 rounded ${report.question?.correct_option === "A" ? "bg-green-100 text-green-800 font-bold" : ""}`}>A: <MathText text={report.question?.option_a || ""} /></div>
                                    <div className={`p-1 rounded ${report.question?.correct_option === "B" ? "bg-green-100 text-green-800 font-bold" : ""}`}>B: <MathText text={report.question?.option_b || ""} /></div>
                                    <div className={`p-1 rounded ${report.question?.correct_option === "C" ? "bg-green-100 text-green-800 font-bold" : ""}`}>C: <MathText text={report.question?.option_c || ""} /></div>
                                    <div className={`p-1 rounded ${report.question?.correct_option === "D" ? "bg-green-100 text-green-800 font-bold" : ""}`}>D: <MathText text={report.question?.option_d || ""} /></div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 bg-muted/20 py-3">
                            <DeclineDialog report={report} />

                            <EditQuestionDialog report={report} onClose={() => {}} />
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default AdminReports;
