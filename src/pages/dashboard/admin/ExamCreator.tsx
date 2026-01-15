import React, { useEffect, useState } from "react";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft, Download, Upload, Trash2, Plus, Edit2,
  Database, BookOpen
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/ui/loading-screen";
import MathText from "@/components/MathText";
import { QuestionEditor, QuestionData } from "@/components/admin/QuestionEditor";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";

// Helper to sanitize HTML import
const sanitizeHtml = (html: string) => {
    if (!html) return "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove scripts
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Remove unsafe tags and attributes
    const all = doc.querySelectorAll('*');
    all.forEach(el => {
        // Remove event handlers
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on')) {
                el.removeAttribute(attr.name);
            }
            if (attr.name.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });

        // Remove potentially dangerous tags
        if (['IFRAME', 'OBJECT', 'EMBED', 'FORM'].includes(el.tagName)) {
            el.remove();
        }
    });
    return doc.body.innerHTML;
};

// Helper to convert base64 to Blob with robust parsing
const base64ToBlob = (base64: string) => {
    try {
        const parts = base64.split(';base64,');
        if (parts.length !== 2) throw new Error("Invalid base64 format");

        const contentType = parts[0].split(':')[1] || 'image/png';
        const raw = window.atob(parts[1].trim());
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        return new Blob([uInt8Array], { type: contentType });
    } catch (e) {
        console.error("Base64 parsing error:", e);
        return null;
    }
};

// Image Upload Function
const uploadImage = async (base64: string) => {
    try {
        const blob = base64ToBlob(base64);
        if (!blob) return null;

        const formData = new FormData();
        // Use filename with extension matching content type if possible, default to png
        const ext = blob.type.split('/')[1] || 'png';
        formData.append('file', blob, `image.${ext}`);

        const res = await fetch('https://imagehost-sigma-five.vercel.app/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer jm4rt3hbicI7u0cutBmdQYNC95PCXvzN'
            },
            body: formData
        });

        if (!res.ok) {
            const text = await res.text();
            console.error(`Upload failed: ${res.status} ${res.statusText}`, text);
            throw new Error(`API Error: ${res.status}`);
        }

        const data = await res.json();
        return data.direct_url;
    } catch (error) {
        console.error("Image upload failed:", error);
        return null;
    }
};

const processHtmlContent = async (html: string) => {
    if (!html || !html.includes('data:image')) return { html, hasErrors: false };

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = doc.querySelectorAll('img');
    let hasChanges = false;
    let hasErrors = false;

    // Convert NodeList to Array to use for...of with await
    for (const img of Array.from(images)) {
        if (img.src.startsWith('data:image')) {
            const newUrl = await uploadImage(img.src);
            if (newUrl) {
                img.src = newUrl;
                hasChanges = true;
            } else {
                hasErrors = true;
            }
        }
    }

    return {
        html: hasChanges ? doc.body.innerHTML : html,
        hasErrors
    };
};

const ExamCreator = () => {
  const { examId } = useParams();
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [examTitle, setExamTitle] = useState("New Exam");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Export State
  const [isExporting, setIsExporting] = useState(false);
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
                    explanation: q.explanation || ""
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
          const processedQuestions = [];
          const total = questions.length;
          let failedUploads = false;

          for (let i = 0; i < total; i++) {
              setExportProgress(`Processing question ${i + 1} of ${total} (Uploading images)...`);

              const q = questions[i];

              // Process Question Text
              const qResult = await processHtmlContent(q.question);
              if (qResult.hasErrors) failedUploads = true;

              // Process Options
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const options: any = {};
              for (const [key, val] of Object.entries(q.options)) {
                  const optResult = await processHtmlContent(val);
                  options[key] = optResult.html;
                  if (optResult.hasErrors) failedUploads = true;
              }

              // Process Explanation
              const expResult = await processHtmlContent(q.explanation);
              if (expResult.hasErrors) failedUploads = true;

              processedQuestions.push({
                  ...q,
                  question: qResult.html,
                  options,
                  explanation: expResult.html
              });
          }

          if (failedUploads) {
              toast({
                  title: "Export Aborted",
                  description: "Image upload failed. Please ensure the API is accessible.",
                  variant: "destructive"
              });
              setIsExporting(false);
              setExportProgress("");
              return; // Stop here
          }

          setQuestions(processedQuestions);

          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(processedQuestions, null, 2));
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href",     dataStr);
          downloadAnchorNode.setAttribute("download", (examTitle || "quiz") + ".json");
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();

          toast({ title: "Export Success", description: "Exam exported with hosted images." });

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
      if (!confirm("This will overwrite existing questions for this exam. Continue?")) return;

      const { data: existingQ } = await supabase
          .from("exam_questions")
          .select("id")
          .eq("exam_id", examId);

      const existingIds = new Set(existingQ?.map(q => q.id));
      const currentIds = new Set(questions.filter(q => q.id).map(q => q.id));

      const idsToDelete = [...existingIds].filter(id => !currentIds.has(id));

      const upsertData = questions.map((q, idx) => ({
          ...(q.id ? { id: q.id } : {}), // Only include ID if it exists
          exam_id: examId,
          question_index: idx + 1,
          question_text: q.question,
          option_a: q.options.A,
          option_b: q.options.B,
          option_c: q.options.C,
          option_d: q.options.D,
          correct_option: q.correct_answer,
          explanation: q.explanation,
          marks: 1
      }));

      try {
          if (idsToDelete.length > 0) {
              await supabase.from("exam_questions").delete().in("id", idsToDelete);
          }

          if (upsertData.length > 0) {
              const { error } = await supabase.from("exam_questions").upsert(upsertData);
              if (error) throw error;
          }

          toast({ title: "Success", description: "Exam questions updated successfully." });
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
                explanation: q.explanation || ""
             }));
             setQuestions(loaded);
          }

      } catch (err) {
        if (err instanceof Error) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const content = event.target?.result as string;
            if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const normalized = parsed.map((q: any) => {
                        const question = q.question || q.question_text || "";
                        const explanation = q.explanation || "";

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        let options: any = { A: "", B: "", C: "", D: "" };
                        if (q.options && typeof q.options === 'object' && !Array.isArray(q.options)) {
                            const keys = Object.keys(q.options);
                            if (keys.includes('A')) options = q.options;
                            else {
                                const vals = Object.values(q.options);
                                options = {
                                    A: vals[0] || "",
                                    B: vals[1] || "",
                                    C: vals[2] || "",
                                    D: vals[3] || ""
                                };
                            }
                        } else if (q.option_a || q.option1) {
                            options = {
                                A: q.option_a || q.option1 || "",
                                B: q.option_b || q.option2 || "",
                                C: q.option_c || q.option3 || "",
                                D: q.option_d || q.option4 || ""
                            };
                        }

                        let correct_answer = "";
                        if (q.correct_answer) correct_answer = q.correct_answer;
                        else if (q.correct_option) correct_answer = q.correct_option;
                        else if (q.answer) {
                            const num = Number(q.answer);
                            if (!isNaN(num)) {
                                correct_answer = ["A", "B", "C", "D"][num - 1] || "";
                            }
                        }

                        return {
                            question: sanitizeHtml(String(question)),
                            options: {
                                A: sanitizeHtml(options.A),
                                B: sanitizeHtml(options.B),
                                C: sanitizeHtml(options.C),
                                D: sanitizeHtml(options.D),
                            },
                            correct_answer: String(correct_answer).toUpperCase(),
                            explanation: sanitizeHtml(String(explanation))
                        };
                    });

                    setQuestions(prev => [...prev, ...normalized]);
                    toast({ title: "Import Successful", description: `Imported ${normalized.length} questions from JSON.` });
                } else {
                    toast({ title: "Invalid Format", description: "Expected an array of questions.", variant: "destructive" });
                }
            } else {
                toast({ title: "CSV Import", description: "CSV import is supported via copy-paste or implement if needed." });
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
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans overflow-x-hidden">
      {isExporting && <LoadingScreen message={exportProgress} />}
      <div className="mx-auto max-w-[1400px] space-y-8 w-full max-w-full">
        {/* Header */}
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
                    <Button onClick={handleSaveToDatabase} className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20">
                        <Database className="mr-2 h-4 w-4" /> Save Changes
                    </Button>
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

        {/* Active Form */}
        {activeForm && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-2 border-primary/20 shadow-xl overflow-hidden rounded-xl">
                    <div className="p-6 bg-secondary/30 border-b border-border flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                            {activeForm.type === 'edit' ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                            {activeForm.type === 'edit' ? 'Edit Question' : 'New Question'}
                        </h2>
                        <Button variant="ghost" size="sm" onClick={() => setActiveForm(null)}>Cancel</Button>
                    </div>
                    <div className="p-6 md:p-8 space-y-6 bg-card">
                        <QuestionEditor
                            data={activeForm.data}
                            onChange={(newData) => setActiveForm(prev => prev ? { ...prev, data: newData } : null)}
                            onSave={handleSaveQuestion}
                            onCancel={() => setActiveForm(null)}
                        />
                    </div>
                </Card>
            </div>
        )}

        {/* Questions List */}
        <div className="space-y-8 pb-32">
            {questions.length === 0 && !activeForm && (
                <div className="text-center py-32 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/5">
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
                <div key={i} className="group relative">
                    {/* Add Above Button */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 py-2">
                         <Button size="sm" className="rounded-full shadow-lg bg-background border hover:bg-muted" onClick={() => handleShowForm(i, 'above')}>
                            <Plus className="h-3 w-3 mr-1" /> Insert Above
                         </Button>
                    </div>

                    <Card className="overflow-hidden border shadow-sm transition-all hover:shadow-lg rounded-xl">
                        <div className="flex items-center justify-between bg-muted/30 p-4 border-b">
                            <h3 className="font-semibold text-lg flex items-center gap-3">
                                <span className="flex items-center justify-center bg-primary text-primary-foreground font-bold w-8 h-8 rounded-lg text-sm shadow-sm">
                                    {i + 1}
                                </span>
                                <span className="text-muted-foreground text-sm font-normal">Question Preview</span>
                            </h3>
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" className="hover:bg-background/80" onClick={() => handleShowForm(i, 'edit')}>
                                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="ghost" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteQuestion(i)}>
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                                </Button>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            <MathText className="prose prose-lg max-w-none dark:prose-invert bg-background/50 p-4 rounded-lg border border-border/50 shadow-sm" text={q.question} />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(q.options).map(([key, val]) => (
                                    <div
                                        key={key}
                                        className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${
                                            q.correct_answer === key
                                            ? 'bg-green-50/50 border-green-500 dark:bg-green-900/10 shadow-sm scale-[1.01]'
                                            : 'bg-card border-transparent hover:border-border hover:bg-muted/30'
                                        }`}
                                    >
                                        <div className="flex gap-4">
                                            <span className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-bold shrink-0 ${
                                                q.correct_answer === key
                                                ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50'
                                                : 'border-muted text-muted-foreground bg-muted/30'
                                            }`}>
                                                {key}
                                            </span>
                                            <div className="prose prose-sm max-w-none dark:prose-invert grow break-words overflow-hidden flex flex-col justify-center">
                                                <MathText text={val} />
                                            </div>
                                        </div>
                                        {q.correct_answer === key && (
                                            <div className="absolute -top-3 -right-2">
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-green-600 px-2 py-1 rounded-full shadow-md uppercase tracking-wider">
                                                    <Check className="h-3 w-3" /> Correct
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {q.explanation && (
                                <div className="mt-6 p-5 bg-blue-50/30 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Explanation
                                    </p>
                                    <MathText className="prose prose-sm max-w-none dark:prose-invert" text={q.explanation} />
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Add Below Button */}
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 py-2">
                         <Button size="sm" className="rounded-full shadow-lg bg-background border hover:bg-muted" onClick={() => handleShowForm(i, 'below')}>
                            <Plus className="h-3 w-3 mr-1" /> Insert Below
                         </Button>
                    </div>
                </div>
            ))}
        </div>
      </div>

      <QuestionBankSelector
        open={showBankSelector}
        onClose={() => setShowBankSelector(false)}
        onSelect={handleBankImport}
      />
    </div>
  );
};

export default ExamCreator;
