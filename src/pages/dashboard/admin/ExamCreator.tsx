import React, { useEffect, useState, useRef, useCallback } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import Cropper from "react-cropper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Download, Upload, Trash2, Plus, Edit2,
  Image as ImageIcon, Save, Database, Copy, Check
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/ui/loading-screen";
import MathText from "@/components/MathText";

// Custom Quill Link
const Link = Quill.import('formats/link');
Link.sanitize = function(url: string) {
  if (!url || url.trim() === '') return '';
  if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
    return 'https://' + url;
  }
  return url;
};

interface Question {
  id?: string;
  question: string;
  options: { [key: string]: string };
  correct_answer: string;
  explanation: string;
}

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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examTitle, setExamTitle] = useState("New Exam");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  // Cropper state
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImage, setCropImage] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentQuillRef, setCurrentQuillRef] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cropper, setCropper] = useState<any>();

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
    data: Question;
  } | null>(null);

  // Formula Editor State
  const [formulaState, setFormulaState] = useState<{ isOpen: boolean; targetQuill: any | null }>({
      isOpen: false,
      targetQuill: null
  });

  const handleFormulaInsert = (latex: string) => {
      if (formulaState.targetQuill) {
          const editor = formulaState.targetQuill.getEditor();
          const range = editor.getSelection(true);
          if (range) {
              editor.insertText(range.index, `$${latex}$`);
              // Move cursor after the inserted formula
              editor.setSelection(range.index + latex.length + 2);
          } else {
              // Fallback if no selection
              const length = editor.getLength();
              editor.insertText(length, `$${latex}$`);
          }
      }
      setFormulaState({ isOpen: false, targetQuill: null });
  };

  const emptyQuestion: Question = {
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

          // If uploads failed, we stop the export to prevent dirty data (Base64) from persisting
          // as per user request to use hosted URLs "instead" of Base64.
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

          // Update state so the editor reflects the uploaded images
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

      // 1. Get existing question IDs for this exam
      const { data: existingQ } = await supabase
          .from("exam_questions")
          .select("id")
          .eq("exam_id", examId);

      const existingIds = new Set(existingQ?.map(q => q.id));
      const currentIds = new Set(questions.filter(q => q.id).map(q => q.id));

      // 2. Identify deletions
      const idsToDelete = [...existingIds].filter(id => !currentIds.has(id));

      // 3. Upsert operations
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
          // Refresh fetch to get new IDs for inserted rows
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
            // Detect JSON vs CSV (Simple check: starts with [ or { is JSON)
            if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    // Normalize imported data
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
                // Handle CSV
                // Inline robust CSV parser to handle quoted strings and newlines inside quotes
                const rows: string[][] = [];
                let currentRow: string[] = [];
                let currentVal = "";
                let inQuotes = false;

                for (let i = 0; i < content.length; i++) {
                    const char = content[i];
                    const nextChar = content[i + 1];

                    if (char === '"') {
                        if (inQuotes && nextChar === '"') {
                            // Escaped quote
                            currentVal += '"';
                            i++; // Skip next quote
                        } else {
                            // Toggle quote mode
                            inQuotes = !inQuotes;
                        }
                    } else if (char === ',' && !inQuotes) {
                        currentRow.push(currentVal.trim());
                        currentVal = "";
                    } else if ((char === '\n' || char === '\r') && !inQuotes) {
                        if (currentVal || currentRow.length > 0) {
                            currentRow.push(currentVal.trim());
                            rows.push(currentRow);
                        }
                        currentRow = [];
                        currentVal = "";
                        // Handle CRLF
                        if (char === '\r' && nextChar === '\n') i++;
                    } else {
                        currentVal += char;
                    }
                }
                if (currentVal || currentRow.length > 0) {
                    currentRow.push(currentVal.trim());
                    rows.push(currentRow);
                }

                // Filter header if present (heuristic)
                let startIndex = 0;
                if (rows.length > 0 && rows[0][0].toLowerCase().includes('question')) {
                    startIndex = 1;
                }

                const normalized = [];
                for (let i = startIndex; i < rows.length; i++) {
                    const row = rows[i];
                    if (row.length < 2) continue; // Skip empty/invalid lines

                    // Mapping: 0=Q, 1=Opt1, 2=Opt2, 3=Opt3, 4=Opt4, 5=Opt5(empty), 6=Ans, 7=Exp, 8=Type, 9=Sec
                    const question = row[0] || "";
                    const options = {
                        A: row[1] || "",
                        B: row[2] || "",
                        C: row[3] || "",
                        D: row[4] || "",
                    };

                    const ansRaw = row[6];
                    let correct_answer = "";
                    const num = Number(ansRaw);
                    if (!isNaN(num) && num >= 1 && num <= 5) {
                        correct_answer = ["A", "B", "C", "D", "E"][num - 1] || "";
                    } else if (ansRaw) {
                        correct_answer = ansRaw.toUpperCase();
                    }

                    const explanation = row[7] || "";

                    normalized.push({
                        question: sanitizeHtml(question),
                        options: {
                            A: sanitizeHtml(options.A),
                            B: sanitizeHtml(options.B),
                            C: sanitizeHtml(options.C),
                            D: sanitizeHtml(options.D),
                        },
                        correct_answer: correct_answer,
                        explanation: sanitizeHtml(explanation)
                    });
                }

                if (normalized.length > 0) {
                    setQuestions(prev => [...prev, ...normalized]);
                    toast({ title: "Import Successful", description: `Imported ${normalized.length} questions from CSV.` });
                } else {
                    toast({ title: "Import Failed", description: "No valid questions found in CSV.", variant: "destructive" });
                }
            }
        } catch (err) {
            console.error(err);
            toast({ title: "Import Failed", description: "Could not parse file.", variant: "destructive" });
        }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset
  };

  // Image handling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleImageUpload = useCallback((quillRef: any) => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reader.onload = (e: any) => {
            setCropImage(e.target.result);
            setCurrentQuillRef(quillRef);
            setShowCropModal(true);
        };
        reader.readAsDataURL(file);
      }
    };
  }, []);

  const insertCroppedImage = () => {
    if (typeof cropper !== "undefined" && currentQuillRef) {
      const editor = currentQuillRef.getEditor();
      const range = editor.getSelection(true);
      editor.insertEmbed(range ? range.index : 0, "image", cropper.getCroppedCanvas().toDataURL());
      setShowCropModal(false);
      setCropImage("");
    }
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
                        <Upload className="mr-2 h-4 w-4" /> Import
                    </Button>
                    <input type="file" id="impf" className="hidden" accept=".json,.csv" onChange={handleImport} />
                </div>

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
                        <QuestionForm
                            data={activeForm.data}
                            onChange={(newData: Question) => setActiveForm(prev => prev ? { ...prev, data: newData } : null)}
                            onSave={handleSaveQuestion}
                            onCancel={() => setActiveForm(null)}
                            onImageUpload={handleImageUpload}
                            onOpenFormula={(quillRef: any) => setFormulaState({ isOpen: true, targetQuill: quillRef })}
                        />
                    </div>
                </Card>
            </div>
        )}

        {/* Global Formula Editor Dialog */}
        <FormulaEditorDialog
            isOpen={formulaState.isOpen}
            onClose={() => setFormulaState({ isOpen: false, targetQuill: null })}
            onInsert={handleFormulaInsert}
        />

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

      {/* Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Crop Image</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowCropModal(false)}>✕</Button>
                </div>

                <div className="flex-1 overflow-hidden bg-black/5 rounded-lg border min-h-[300px]">
                    <Cropper
                        src={cropImage}
                        style={{ height: 400, width: "100%" }}
                        initialAspectRatio={NaN}
                        guides={true}
                        viewMode={1}
                        minCropBoxHeight={10}
                        minCropBoxWidth={10}
                        background={false}
                        responsive={true}
                        autoCropArea={1}
                        checkOrientation={false}
                        onInitialized={(instance) => setCropper(instance)}
                    />
                </div>

                <div className="flex gap-3 mt-6 justify-end">
                    <Button variant="outline" onClick={() => setShowCropModal(false)}>Cancel</Button>
                    <Button onClick={insertCroppedImage}>
                        <ImageIcon className="mr-2 h-4 w-4" /> Insert Image
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QuestionForm = ({ data, onChange, onSave, onCancel, onImageUpload, onOpenFormula }: any) => {
    // Helper for updating fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update = (field: string, val: any) => {
        if (data[field] === val) return;
        onChange({ ...data, [field]: val });
    };

    const updateOption = (key: string, val: string) => {
        if (data.options[key] === val) return;
        onChange({ ...data, options: { ...data.options, [key]: val } });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modules = useCallback((quillRef: any) => ({
        toolbar: {
            container: [
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'script': 'sub'}, { 'script': 'super' }],
                ['formula'], // Added formula button
                ['link', 'image', 'clean']
            ],
            handlers: {
                image: () => onImageUpload(quillRef),
                formula: () => onOpenFormula(quillRef)
            }
        }
    }), [onImageUpload, onOpenFormula]);

    return (
        <div className="space-y-8">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Question Text</Label>
                    <Button variant="ghost" size="sm" onClick={() => onOpenFormula(null)} className="text-xs h-8 bg-secondary/50 hover:bg-secondary text-foreground">
                        Math Formula Helper (Manual)
                    </Button>
                </div>
                <ExpandableRichTextEditor
                    value={data.question}
                    onChange={(val: string) => update('question', val)}
                    modulesGenerator={modules}
                    onImageUpload={onImageUpload}
                    placeholder="Type your question here... (Click to edit)"
                    minHeight="150px"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['A', 'B', 'C', 'D'].map((opt) => (
                    <div key={opt} className={`space-y-3 p-4 rounded-xl border-2 transition-all ${
                        data.correct_answer === opt
                        ? 'border-green-500 bg-green-50/20 shadow-sm'
                        : 'border-border/50 hover:border-primary/30 hover:bg-muted/20'
                    }`}>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="font-bold flex items-center gap-3 cursor-pointer select-none">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="radio"
                                        name="correct_opt"
                                        checked={data.correct_answer === opt}
                                        onChange={() => update('correct_answer', opt)}
                                        className="peer sr-only"
                                    />
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                        data.correct_answer === opt
                                        ? 'border-green-600 bg-green-600 text-white'
                                        : 'border-muted-foreground'
                                    }`}>
                                        {data.correct_answer === opt && <Check className="h-3 w-3" />}
                                    </div>
                                </div>
                                <span>Option {opt}</span>
                            </Label>
                            {data.correct_answer === opt && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">Correct Answer</span>}
                        </div>
                        <ExpandableRichTextEditor
                            value={data.options[opt]}
                            onChange={(val: string) => updateOption(opt, val)}
                            modulesGenerator={modules}
                            onImageUpload={onImageUpload}
                            minHeight="80px"
                            placeholder={`Option ${opt} text...`}
                        />
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Explanation (Optional)</Label>
                </div>
                <ExpandableRichTextEditor
                    value={data.explanation}
                    onChange={(val: string) => update('explanation', val)}
                    modulesGenerator={modules}
                    onImageUpload={onImageUpload}
                    minHeight="100px"
                    placeholder="Explain the answer here..."
                />
            </div>

            <div className="flex gap-4 pt-6 border-t mt-4">
                <Button onClick={onSave} className="w-full sm:w-auto min-w-[150px] shadow-md">
                    <Save className="mr-2 h-4 w-4" /> Save Question
                </Button>
                <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
                    Cancel
                </Button>
            </div>
        </div>
    );
};

const FormulaEditorDialog = ({ isOpen, onClose, onInsert }: { isOpen: boolean, onClose: () => void, onInsert: (latex: string) => void }) => {
    const { toast } = useToast();
    const [latex, setLatex] = useState("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mathFieldRef = useRef<any>(null);

    // Reset latex when opened
    useEffect(() => {
        if (isOpen) {
            setLatex("");
            // Focus on open
            setTimeout(() => {
                if (mathFieldRef.current) mathFieldRef.current.focus();
            }, 100);
        }
    }, [isOpen]);

    const copyToClipboard = () => {
        if(latex) {
            navigator.clipboard.writeText('$' + latex + '$');
            toast({ title: "Copied!", description: "LaTeX formula copied to clipboard." });
        } else {
            toast({ title: "Empty", description: "Type a formula first.", variant: "secondary" });
        }
    };

    const handleInsert = () => {
        if (latex) {
            onInsert(latex);
        } else {
            toast({ title: "Empty", description: "Type a formula first.", variant: "secondary" });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
                onPointerDownOutside={(e) => {
                    const target = e.target as HTMLElement;
                    // Check if target is detached (handles virtual keyboard re-renders like Shift key)
                    const isDetached = !document.body.contains(target);
                    if (
                        isDetached ||
                        target.closest('math-field') ||
                        target.closest('.ML__keyboard') ||
                        target.tagName.toLowerCase().startsWith('math-') ||
                        target.classList.contains('ML__keyboard') ||
                        document.querySelector('.ML__keyboard')?.contains(target)
                    ) {
                        e.preventDefault();
                    }
                }}
                onInteractOutside={(e) => {
                    const target = e.target as HTMLElement;
                    const isDetached = !document.body.contains(target);
                    if (
                        isDetached ||
                        target.closest('math-field') ||
                        target.closest('.ML__keyboard') ||
                        target.tagName.toLowerCase().startsWith('math-') ||
                        target.classList.contains('ML__keyboard') ||
                        document.querySelector('.ML__keyboard')?.contains(target)
                    ) {
                        e.preventDefault();
                    }
                }}
                onFocusOutside={(e) => {
                     // Prevent closing when focus moves to the virtual keyboard
                     e.preventDefault();
                }}
            >
                <DialogHeader>
                    <DialogTitle>Math Formula Editor</DialogTitle>
                </DialogHeader>
                <div className="py-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                         <p className="text-sm text-muted-foreground">
                            Type standard keyboard input or use the virtual math keyboard.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const mf = mathFieldRef.current;
                                if (mf) {
                                    if (mf.virtualKeyboardState === 'visible') {
                                        mf.executeCommand('hideVirtualKeyboard');
                                    } else {
                                        mf.executeCommand('showVirtualKeyboard');
                                    }
                                    mf.focus();
                                }
                            }}
                        >
                            Toggle Virtual Keyboard
                        </Button>
                    </div>

                    {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                    {/* @ts-ignore */}
                    <math-field
                        ref={mathFieldRef}
                        virtual-keyboard-mode="manual"
                        style={{
                            width: '100%',
                            border: '2px solid #3b82f6',
                            padding: '16px',
                            borderRadius: '8px',
                            background: 'white',
                            color: 'black',
                            fontSize: '1.5em',
                            outline: 'none',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onInput={(e: any) => setLatex(e.target.value)}
                    ></math-field>

                    <div className="relative group">
                         <div className="bg-muted p-4 rounded-lg text-sm font-mono break-all select-all border min-h-[4rem] flex items-center">
                             {latex ? `$${latex}$` : <span className="text-muted-foreground italic">LaTeX preview will appear here...</span>}
                         </div>
                         <Button
                            size="sm"
                            variant="ghost"
                            className="absolute right-2 top-2 h-8 w-8"
                            onClick={copyToClipboard}
                            title="Copy to clipboard"
                         >
                            <Copy className="h-4 w-4" />
                         </Button>
                    </div>

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                        <Button variant="outline" size="lg" onClick={onClose}>Cancel</Button>
                        <Button
                            onClick={handleInsert}
                            size="lg"
                            className="bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
                        >
                            Insert Formula
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ExpandableRichTextEditor = ({ value, onChange, modulesGenerator, minHeight = "100px", placeholder }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quillRef = useRef<any>(null);

    const modules = React.useMemo(() => {
        return modulesGenerator({
            getEditor: () => quillRef.current?.getEditor()
        });
    }, [modulesGenerator]);

    if (!isEditing) {
        return (
            <div
                onClick={() => setIsEditing(true)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background cursor-text hover:bg-muted/20 hover:border-primary/30 transition-all shadow-sm"
                style={{ minHeight }}
            >
                {value && value !== "<p><br></p>" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert pointer-events-none" dangerouslySetInnerHTML={{ __html: value }} />
                ) : (
                    <span className="text-muted-foreground flex items-center gap-2 mt-1">
                        <Edit2 className="h-3 w-3" /> {placeholder || "Click to edit..."}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="relative border-2 border-primary/20 rounded-xl p-2 bg-background animate-in fade-in zoom-in-95 duration-200 shadow-md ring-2 ring-primary/5">
            <ReactQuill
                ref={quillRef}
                theme="snow"
                value={value}
                onChange={onChange}
                modules={modules}
                placeholder={placeholder}
                style={{ height: 'auto' }}
                className="h-auto rounded-md overflow-hidden"
            />
            {/* Custom Styles */}
            <style>{`
                .ql-container {
                    min-height: ${minHeight};
                    font-size: 16px;
                    border: none !important;
                }
                .ql-toolbar {
                    border: none !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                    background: #f8fafc;
                    border-radius: 8px 8px 0 0;
                }
                .dark .ql-toolbar {
                    background: #1e293b;
                    border-bottom: 1px solid #334155 !important;
                }
                .dark .ql-snow .ql-stroke {
                    stroke: #e2e8f0;
                }
                .dark .ql-snow .ql-fill {
                    fill: #e2e8f0;
                }
                .dark .ql-snow .ql-picker {
                    color: #e2e8f0;
                }
                .ql-editor {
                    min-height: ${minHeight};
                    padding: 16px;
                }
            `}</style>
            <div className="flex justify-end mt-2 pt-2 border-t border-dashed">
                <Button size="sm" onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} className="h-8">
                    <Check className="mr-1 h-3 w-3" /> Done
                </Button>
            </div>
        </div>
    );
};

export default ExamCreator;
