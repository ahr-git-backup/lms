const fs = require('fs');

const path = 'src/pages/dashboard/admin/AdminReports.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update deleteReportMutation
const oldDeleteMutation = `    const deleteReportMutation = useMutation({
        mutationFn: async (reportId: string) => {
            const { error } = await supabase
                .from("question_reports")
                .delete()
                .eq("id", reportId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
            toast({ title: "Report cleared" });
        },
        onError: (error) => {
            toast({ title: "Failed to delete report", description: error.message, variant: "destructive" });
        }
    });`;

const newDeleteMutation = `    const deleteReportMutation = useMutation({
        mutationFn: async ({ reportId, userId, feedback }: { reportId: string, userId: string, feedback: string }) => {
            const { error } = await supabase
                .from("question_reports")
                .delete()
                .eq("id", reportId);
            if (error) throw error;

            if (userId && feedback) {
                await supabase.from("user_notifications").insert({
                    user_id: userId,
                    title: "Question Report Declined",
                    body: feedback,
                    type: "general"
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
            toast({ title: "Report cleared & feedback sent" });
        },
        onError: (error) => {
            toast({ title: "Failed to delete report", description: error.message, variant: "destructive" });
        }
    });`;

content = content.replace(oldDeleteMutation, newDeleteMutation);

// 2. Add DeclineDialog component
const declineDialogHtml = `
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
                                deleteReportMutation.mutate({ reportId: report.id, userId: report.user_id, feedback });
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
`;

content = content.replace(`const EditQuestionDialog`, declineDialogHtml + '\n    const EditQuestionDialog');

// 3. Replace direct onClick with DeclineDialog
const oldDeclineButton = `<Button
                                variant="destructive"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                    if(confirm("Are you sure you want to decline this report? It will be deleted.")) {
                                        deleteReportMutation.mutate(report.id);
                                    }
                                }}
                                disabled={deleteReportMutation.isPending}
                            >
                                <X className="h-4 w-4 mr-2" />
                                Decline (Delete)
                            </Button>`;

const newDeclineButton = `<DeclineDialog report={report} />`;

content = content.replace(oldDeclineButton, newDeclineButton);

// 4. Update EditQuestionDialog & updateQuestionMutation
const oldEditDialogStates = `        const [optD, setOptD] = useState(report.question.option_d || "");
        const [correct, setCorrect] = useState(report.question.correct_option);
        const [explanation, setExplanation] = useState(report.question.explanation || "");`;

const newEditDialogStates = `        const [optD, setOptD] = useState(report.question.option_d || "");
        const [correct, setCorrect] = useState(report.question.correct_option);
        const [explanation, setExplanation] = useState(report.question.explanation || "");
        const [feedback, setFeedback] = useState("আপনার রিপোর্টটি সঠিক, প্রশ্নটি সংশোধন করা হয়েছে। ধন্যবাদ!");`;

content = content.replace(oldEditDialogStates, newEditDialogStates);

const oldExplanationHtml = `<div className="space-y-2">
                            <Label>Explanation</Label>
                            <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={3} />
                        </div>`;

const newExplanationHtml = `<div className="space-y-2">
                            <Label>Explanation</Label>
                            <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={3} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-primary font-semibold">Feedback to Student</Label>
                            <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={2} placeholder="Optional feedback..." />
                        </div>`;

content = content.replace(oldExplanationHtml, newExplanationHtml);

const oldUpdateMutation = `        const updateQuestionMutation = useMutation({
            mutationFn: async () => {
                const { error: updateErr } = await supabase
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
                    .eq("id", report.question_id);

                if (updateErr) throw updateErr;

                // Mark resolved / delete report
                const { error: delErr } = await supabase
                    .from("question_reports")
                    .delete()
                    .eq("id", report.id);

                if (delErr) throw delErr;
            },`;

const newUpdateMutation = `        const updateQuestionMutation = useMutation({
            mutationFn: async () => {
                const { error: updateErr } = await supabase
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
                    .eq("id", report.question_id);

                if (updateErr) throw updateErr;

                // Send notification
                if (report.user_id && feedback) {
                    await supabase.from("user_notifications").insert({
                        user_id: report.user_id,
                        title: "Question Report Resolved",
                        body: feedback,
                        type: "general"
                    });
                }

                // Mark resolved / delete report
                const { error: delErr } = await supabase
                    .from("question_reports")
                    .delete()
                    .eq("id", report.id);

                if (delErr) throw delErr;
            },`;

content = content.replace(oldUpdateMutation, newUpdateMutation);


fs.writeFileSync(path, content, 'utf8');
console.log("Patched AdminReports.tsx");
