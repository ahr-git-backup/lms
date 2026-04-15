const fs = require('fs');
let adminReportsPath = 'src/pages/dashboard/admin/AdminReports.tsx';
let content = fs.readFileSync(adminReportsPath, 'utf8');

// Fix feedback is not defined compilation error in EditQuestionDialog and updateQuestionMutation.
// The previous patch failed to put `feedback` state inside EditQuestionDialog because it replaced the wrong target.

const oldUpdateQuestionMutation = `        const updateQuestionMutation = useMutation({
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

const newUpdateQuestionMutation = `        const updateQuestionMutation = useMutation({
            mutationFn: async ({ feedbackText }: { feedbackText: string }) => {
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
                if (report.user_id && feedbackText) {
                    await supabase.from("user_notifications").insert({
                        user_id: report.user_id,
                        title: "Question Report Resolved",
                        body: feedbackText,
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

content = content.replace(oldUpdateQuestionMutation, newUpdateQuestionMutation);

const oldSaveButton = `<Button onClick={() => updateQuestionMutation.mutate()} disabled={updateQuestionMutation.isPending}>`;
const newSaveButton = `<Button onClick={() => updateQuestionMutation.mutate({ feedbackText: feedback })} disabled={updateQuestionMutation.isPending}>`;
content = content.replace(oldSaveButton, newSaveButton);

// Re-add feedback state correctly
const statesSearch = `        const [qText, setQText] = useState(report.question.question_text);
        const [optA, setOptA] = useState(report.question.option_a || "");
        const [optB, setOptB] = useState(report.question.option_b || "");
        const [optC, setOptC] = useState(report.question.option_c || "");
        const [optD, setOptD] = useState(report.question.option_d || "");
        const [correct, setCorrect] = useState(report.question.correct_option);
        const [explanation, setExplanation] = useState(report.question.explanation || "");`;

const statesReplace = `        const [qText, setQText] = useState(report.question.question_text);
        const [optA, setOptA] = useState(report.question.option_a || "");
        const [optB, setOptB] = useState(report.question.option_b || "");
        const [optC, setOptC] = useState(report.question.option_c || "");
        const [optD, setOptD] = useState(report.question.option_d || "");
        const [correct, setCorrect] = useState(report.question.correct_option);
        const [explanation, setExplanation] = useState(report.question.explanation || "");
        const [feedback, setFeedback] = useState("আপনার রিপোর্টটি সঠিক, প্রশ্নটি সংশোধন করা হয়েছে। ধন্যবাদ!");`;

content = content.replace(statesSearch, statesReplace);

fs.writeFileSync(adminReportsPath, content, 'utf8');
console.log("Fixed AdminReports.tsx");
