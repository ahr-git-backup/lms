import React, { useEffect, useState } from "react";

import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Download, Upload, Trash2, Plus, Edit2,
  Database, BookOpen, Check, RefreshCw, Loader2
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/ui/loading-screen";
import MathText from "@/components/MathText";
import { QuestionEditor, QuestionData } from "@/components/admin/QuestionEditor";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";






const ExamCreator = () => {
  const { examId } = useParams();
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [examTitle, setExamTitle] = useState("New Exam");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Export/Save State
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [showBankSelector, setShowBankSelector] = useState(false);

  // MathLive setup
  useEffect(() => {
    if (!document.getElementById("mathlive-script")) {
      const script = document.createElement("script");
      script.id = "mathlive-script";
      script.src = "https://unpkg.com/mathlive";
      script.type = "module";
      document.body.appendChild(script);
    }
  }, []);

  // Fetch Existing Questions
  useEffect(() => {
    if (examId) {
        const fetchExamData = async () => {
            // Fetch Exam Title
            const { data: exam, error: examError } = await supabase
                .from("exams")
                .select("title")
                .eq("id", examId)
                .single();
            if (exam) setExamTitle(exam.title);

            // Fetch Questions
            const { data: qData } = await supabase
                .from("exam_questions")
                .select("*")
                .eq("exam_id", examId)
                .order("question_index", { ascending: true });

            if (qData) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const loadedQuestions = qData.map((q: any) => ({
                    id: q.id,
                    question: q.question_text,
                    options: {
                        A: q.option_a,
                        B: q.option_b,
                        C: q.option_c,
                        D: q.option_d,
                    },
                    correct_answer: q.correct_option,
                    explanation: q.explanation || "",
                    subject: q.subject || "",
                    chapter: q.chapter || "",
                    topic: q.topic || "",
                    exam_code: q.exam_code || "",
                    year: q.year || "",
                    difficulty: q.difficulty || "",
                    tags: q.tags || []
                }));
                setQuestions(loadedQuestions);
            }
        };
        fetchExamData();
    }
  }, [examId]);

  const [activeForm, setActiveForm] = useState<{
    index: number;
    type: 'initial' | 'above' | 'below' | 'edit';
    data: QuestionData;
  } | null>(null);

  const emptyQuestion: QuestionData = {
    question: "",
    options: { A: "", B: "", C: "", D: "" },
    correct_answer: "",
    explanation: ""
  };

  const handleShowForm = (index: number, type: 'initial' | 'above' | 'below' | 'edit') => {
    let data = { ...emptyQuestion };
    if (type === 'edit') {
        data = JSON.parse(JSON.stringify(questions[index])); // Deep copy
    }
    setActiveForm({ index, type, data });
    setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  };

  const handleSaveQuestion = () => {
    if (!activeForm) return;

    if (!activeForm.data.question || !activeForm.data.correct_answer) {
        toast({ title: "Validation Error", description: "Question and Correct Answer are required.", variant: "destructive" });
        return;
    }

    const newQuestions = [...questions];
    if (activeForm.type === 'edit') {
        newQuestions[activeForm.index] = activeForm.data;
    } else if (activeForm.type === 'initial') {
        newQuestions.push(activeForm.data);
    } else if (activeForm.type === 'above') {
        newQuestions.splice(activeForm.index, 0, activeForm.data);
    } else if (activeForm.type === 'below') {
        newQuestions.splice(activeForm.index + 1, 0, activeForm.data);
    }

    setQuestions(newQuestions);
    setActiveForm(null);
  };

  const handleDeleteQuestion = (index: number) => {
    if (confirm("Delete this question?")) {
        const newQuestions = [...questions];
        newQuestions.splice(index, 1);
        setQuestions(newQuestions);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress("Preparing to export...");

    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(questions, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", (examTitle || "quiz") + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        toast({ title: "Export Success", description: "Exam exported successfully." });

    } catch (error) {
        console.error("Export failed", error);
        toast({ title: "Export Failed", description: "An error occurred during export.", variant: "destructive" });
    } finally {
        setIsExporting(false);
        setExportProgress("");
    }
};

  const handleSaveToDatabase = async () => {
      if (!examId) return;
      if (!confirm("This will update existing questions. Continue?")) return;

      setIsSaving(true);
      try {
          // 1. Fetch current DB state to identify deletions
          const { data: existingQ, error: fetchError } = await supabase
              .from("exam_questions")
              .select("id")
              .eq("exam_id", examId);

          if (fetchError) throw fetchError;

          const existingIds = new Set(existingQ?.map(q => q.id));
          const currentIds = new Set(questions.filter(q => q.id).map(q => q.id));

          const idsToDelete = [...existingIds].filter(id => !currentIds.has(id));

          // 2. Prepare Upsert Data
          const upsertData = questions.map((q, idx) => ({
              ...(q.id ? { id: q.id } : {}), // Only include ID if it exists (update)
              exam_id: examId,
              question_index: idx + 1, // Ensure sequential indexing
              question_text: q.question,
              option_a: q.options.A,
              option_b: q.options.B,
              option_c: q.options.C,
              option_d: q.options.D,
              correct_option: q.correct_answer,
              explanation: q.explanation,
              marks: 1,
              subject: q.subject || null,
              chapter: q.chapter || null,
              topic: q.topic || null,
              exam_code: q.exam_code || null,
              year: q.year || null,
              difficulty: q.difficulty || null,
              tags: q.tags || []
          }));

          // 3. Delete Removed Questions
          if (idsToDelete.length > 0) {
              const { error: delError } = await supabase.from("exam_questions").delete().in("id", idsToDelete);
              if (delError) throw delError;
          }

          // 4. Upsert Questions
          if (upsertData.length > 0) {
              const { error: upsertError } = await supabase.from("exam_questions").upsert(upsertData);
              if (upsertError) throw upsertError;
          }

          toast({ title: "Success", description: "Exam questions saved and re-indexed successfully." });

          // 5. Refresh Data from DB to sync IDs
          const { data: refreshedData } = await supabase
                .from("exam_questions")
                .select("*")
                .eq("exam_id", examId)
                .order("question_index", { ascending: true });

          if (refreshedData) {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const loaded = refreshedData.map((q: any) => ({
                id: q.id,
                question: q.question_text,
                options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
                correct_answer: q.correct_option,
                explanation: q.explanation || "",
                subject: q.subject || "",
                chapter: q.chapter || "",
                topic: q.topic || "",
                exam_code: q.exam_code || "",
                year: q.year || "",
                difficulty: q.difficulty || "",
                tags: q.tags || []
             }));
             setQuestions(loaded);
          }

      } catch (err) {
        console.error("Save error:", err);
        if (err instanceof Error) {
            toast({ title: "Error saving questions", description: err.message, variant: "destructive" });
        } else {
             toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        }
      } finally {
          setIsSaving(false);
      }
  };

  const handleReplaceAllQuestions = async () => {
      if (!examId) return;
      if (!confirm("⚠️ DANGER: This will DELETE all existing questions and replace them with the current list.\n\nAny student exam attempts linked to old questions might break or lose data.\n\nAre you sure you want to proceed?")) return;

      setIsSaving(true);
      try {
          // 1. Delete all existing questions
          const { error: deleteError } = await supabase
              .from("exam_questions")
              .delete()
              .eq("exam_id", examId);

          if (deleteError) throw deleteError;

          // 2. Prepare new questions (dropping IDs to force new insert)
          const insertData = questions.map((q, idx) => ({
              exam_id: examId,
              question_index: idx + 1,
              question_text: q.question,
              option_a: q.options.A,
              option_b: q.options.B,
              option_c: q.options.C,
              option_d: q.options.D,
              correct_option: q.correct_answer,
              explanation: q.explanation,
              marks: 1,
              subject: q.subject || null,
              chapter: q.chapter || null,
              topic: q.topic || null,
              exam_code: q.exam_code || null,
              year: q.year || null,
              difficulty: q.difficulty || null,
              tags: q.tags || []
          }));

          if (insertData.length > 0) {
              const { error: insertError } = await supabase
                  .from("exam_questions")
                  .insert(insertData);
              if (insertError) throw insertError;
          }

          toast({ title: "Success", description: "All questions replaced successfully." });

          // 3. Refresh local state
          const { data: refreshedData } = await supabase
                .from("exam_questions")
                .select("*")
                .eq("exam_id", examId)
                .order("question_index", { ascending: true });

          if (refreshedData) {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const loaded = refreshedData.map((q: any) => ({
                id: q.id,
                question: q.question_text,
                options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
                correct_answer: q.correct_option,
                explanation: q.explanation || "",
                subject: q.subject || "",
                chapter: q.chapter || "",
                topic: q.topic || "",
                exam_code: q.exam_code || "",
                year: q.year || "",
                difficulty: q.difficulty || "",
                tags: q.tags || []
             }));
             setQuestions(loaded);
          }

      } catch (err) {
        console.error("Replace error:", err);
        if (err instanceof Error) {
            toast({ title: "Error replacing questions", description: err.message, variant: "destructive" });
        }
      } finally {
          setIsSaving(false);
      }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const content = event.target?.result as string;
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                const normalized = parsed.map((q: any) => ({
                    question: String(q.question || q.question_text || ""),
                    options: q.options || { A: "", B: "", C: "", D: "" },
                    correct_answer: String(q.correct_answer || q.correct_option || "").toUpperCase(),
                    explanation: String(q.explanation || "")
                }));
                setQuestions(prev => [...prev, ...normalized]);
                toast({ title: "Import Successful", description: `Imported ${normalized.length} questions from JSON.` });
            } else {
                toast({ title: "Invalid Format", description: "Expected an array of questions.", variant: "destructive" });
            }
        } catch (err) {
            console.error(err);
            toast({ title: "Import Failed", description: "Could not parse file.", variant: "destructive" });
        }
    };
    reader.readAsText(file);
    e.target.value = "";
};

  const handleBankImport = (selectedQuestions: QuestionData[]) => {
      const cleanQuestions = selectedQuestions.map(q => ({
          ...q,
          id: undefined
      }));
      setQuestions(prev => [...prev, ...cleanQuestions]);
      toast({ title: "Imported", description: `Added ${cleanQuestions.length} questions from Question Bank.` });
  };

  return (
    <div className="min-h-screen lg:h-[calc(100vh-4rem)] bg-background px-1.5 py-4 md:px-2 md:py-6 font-sans lg:overflow-hidden">
      {isExporting && <LoadingScreen message={exportProgress} />}
      <div className="w-full h-full max-w-2xl mx-auto flex flex-col space-y-4 sm:space-y-6 lg:overflow-y-auto pb-8 lg:pb-24 relative px-1 sm:px-0">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between rounded-xl bg-card p-6 shadow-md border border-border">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Quiz Maker Studio
                    </h1>
                </div>
                <p className="text-sm text-muted-foreground pl-11">
                    {examId ? `Editing: ${examTitle}` : "Create, edit, and export professional quiz questions"}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Input
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    className="w-[250px] font-medium"
                    placeholder="Exam Title"
                    disabled={!!examId}
                />

                {questions.length === 0 && !activeForm && (
                     <Button onClick={() => handleShowForm(0, 'initial')} className="shadow-lg shadow-primary/20">
                        <Plus className="mr-2 h-4 w-4" /> Add First Question
                     </Button>
                )}

                {examId ? (
                    <>
                        <Button
                            onClick={handleSaveToDatabase}
                            disabled={isSaving}
                            className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
                        >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                            Save
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReplaceAllQuestions}
                            disabled={isSaving}
                            title="Delete all questions & Re-upload (Cleaner)"
                        >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Replace All
                        </Button>
                    </>
                ) : (
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" /> Export JSON
                    </Button>
                )}

                <div className="relative">
                    <Button variant="outline" onClick={() => document.getElementById('impf')?.click()}>
                        <Upload className="mr-2 h-4 w-4" /> Import File
                    </Button>
                    <input type="file" id="impf" className="hidden" accept=".json,.csv" onChange={handleImport} />
                </div>

                 <Button variant="secondary" onClick={() => setShowBankSelector(true)}>
                    <BookOpen className="mr-2 h-4 w-4" /> Question Bank
                </Button>

                <Button variant="destructive" size="icon" onClick={() => {
                    if (confirm("Are you sure you want to clear all questions?")) setQuestions([]);
                }}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>

        {/* Collapsible Question Bank */}
        {showBankSelector && (
            <div className="border border-border/60 rounded-[30px] bg-card p-5 sm:p-7 shadow-sm h-[700px] flex flex-col w-full mx-auto max-w-2xl animate-in fade-in slide-in-from-top-4 duration-300 mt-4 mb-2">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50 shrink-0">
                     <h3 className="font-bold text-xl flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" /> Select from Question Bank
                     </h3>
                     <Button variant="ghost" size="icon" onClick={() => setShowBankSelector(false)} className="rounded-full h-8 w-8 hover:bg-secondary">
                        <Trash2 className="h-4 w-4" />
                     </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <QuestionBankSelector onSelect={handleBankImport} />
                </div>
            </div>
        )}

        {/* Questions List */}
        <div className="space-y-4 pb-32">
            {questions.length === 0 && !activeForm && (
                <div className="text-center py-20 rounded-md border border-dashed border-muted-foreground/20 bg-muted/5">
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Plus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-semibold text-muted-foreground mb-2">No questions added yet</p>
                    <p className="text-sm text-muted-foreground mb-6">Start building your exam by adding questions.</p>
                    <Button onClick={() => handleShowForm(0, 'initial')}>
                        Create Question
                    </Button>
                </div>
            )}

            {questions.map((q, i) => (
                <div key={i} className="group relative border border-border/40 hover:border-border/80 pb-6 mb-5 transition-all rounded-[30px] p-5 sm:p-7 bg-card shadow-sm w-full">
                    {/* Inline Form Edit Mode */}
                    {activeForm && activeForm.index === i && activeForm.type === 'edit' ? (
                         <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4 border-b pb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                                    <Edit2 className="h-5 w-5" /> Edit Question {i + 1}
                                </h2>
                                <Button variant="ghost" size="sm" onClick={() => setActiveForm(null)}>Cancel</Button>
                            </div>
                            <QuestionEditor
                                data={activeForm.data}
                                onChange={(newData) => setActiveForm(prev => prev ? { ...prev, data: newData } : null)}
                                onSave={handleSaveQuestion}
                                onCancel={() => setActiveForm(null)}
                            />
                         </div>
                    ) : (
                    <div className="relative">
                        <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                                <Button size="sm" variant="outline" className="h-8 shadow-sm bg-background rounded-full" onClick={() => handleShowForm(i, 'edit')}>
                                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="destructive" className="h-8 shadow-sm rounded-full" onClick={() => handleDeleteQuestion(i)}>
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                                </Button>
                        </div>

                        <div className="space-y-5">
                            <div className="flex gap-2 sm:gap-3 items-start">
                                <span className="font-bold text-lg sm:text-xl leading-snug">{i + 1}.</span>
                                <MathText className="prose prose-sm sm:prose-base max-w-none dark:prose-invert font-medium mt-[1px]" text={q.question} />
                            </div>

                            <div className="flex flex-col gap-2 pl-5 sm:pl-7 mt-3">
                                {Object.entries(q.options).map(([key, val]) => {
                                    const isCorrect = q.correct_answer === key;
                                    return (
                                        <div
                                            key={key}
                                            className={`relative p-3 rounded-2xl transition-all duration-200 flex gap-3 items-start border-transparent ${
                                                isCorrect
                                                ? 'bg-[#f0fdf4] dark:bg-green-900/10'
                                                : 'hover:bg-secondary/30'
                                            }`}
                                        >
                                            <div className="flex items-start gap-2 pt-0.5">
                                                <span className={`text-[15px] sm:text-[16px] font-bold shrink-0 ${
                                                    isCorrect
                                                    ? 'text-[#2BA25C]'
                                                    : 'text-foreground/80'
                                                }`}>
                                                    {key})
                                                </span>
                                                <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert break-words overflow-hidden text-foreground/90">
                                                    <MathText text={String(val)} />
                                                </div>
                                            </div>
                                            {isCorrect && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <div className="bg-[#2BA25C] rounded-full p-[3px] shadow-sm">
                                                        <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {q.explanation && (
                                <div className="mt-5 p-4 sm:p-5 ml-5 sm:ml-7 bg-[#f8fafc] dark:bg-slate-900/30 rounded-[20px] border border-[#e2e8f0]/80 dark:border-slate-800/50 text-sm">
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] shadow-[0_0_4px_rgba(59,130,246,0.6)]"></div>
                                        <span className="text-[11px] font-bold text-[#3b82f6] uppercase tracking-[0.15em]">
                                            Explanation
                                        </span>
                                    </div>
                                    <MathText className="prose prose-sm sm:prose-base max-w-none dark:prose-invert text-foreground/85 leading-relaxed" text={q.explanation} />
                                </div>
                            )}

                            {/* Tags / Meta Display (if present) */}
                            {(q.subject || q.chapter || q.topic || q.exam_code || q.year || q.difficulty || (q.tags && q.tags.length > 0)) && (
                                <div className="flex flex-wrap gap-2 mt-4 ml-6 sm:ml-8 pt-4 border-t border-border/40">
                                    {q.subject && <span className="text-[10px] sm:text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-full">{q.subject}</span>}
                                    {q.chapter && <span className="text-[10px] sm:text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-full">{q.chapter}</span>}
                                    {q.topic && <span className="text-[10px] sm:text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-full">{q.topic}</span>}
                                    {q.exam_code && <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">{q.exam_code}</span>}
                                    {q.year && <span className="text-[10px] sm:text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-full">{q.year}</span>}
                                    {q.tags && q.tags.map((t: string) => <span key={t} className="text-[10px] sm:text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-full">#{t}</span>)}
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            ))}

            {activeForm && (activeForm.type === 'initial' || activeForm.type === 'below' || activeForm.type === 'above') && (
                 <div className="border border-primary/30 shadow-sm overflow-hidden rounded-[24px] my-5 bg-card w-full">
                    <div className="px-5 sm:px-6 py-4 border-b border-border/50 flex items-center justify-between bg-secondary/10">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
                            <Plus className="h-4 w-4" /> New Question
                        </h2>
                        <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={() => setActiveForm(null)}>Cancel</Button>
                    </div>
                    <div className="p-4 sm:p-6 bg-card">
                        <QuestionEditor
                            data={activeForm.data}
                            onChange={(newData) => setActiveForm(prev => prev ? { ...prev, data: newData } : null)}
                            onSave={handleSaveQuestion}
                            onCancel={() => setActiveForm(null)}
                        />
                    </div>
                </div>
            )}

            {!activeForm && questions.length > 0 && (
                <div className="flex justify-center mt-4 w-full">
                    <Button onClick={() => handleShowForm(questions.length - 1, 'below')} className="shadow-md rounded-full px-8 h-12 text-base transition-transform hover:-translate-y-0.5 w-full sm:w-auto">
                        <Plus className="mr-2 h-5 w-5" /> Add New Question
                    </Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ExamCreator;
