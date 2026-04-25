import React, { useEffect, useState } from "react";

import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { OmrScanner } from "@/components/admin/OmrScanner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { useQuery } from "@tanstack/react-query";
import { useGlobalMetadata, useAddGlobalMetadata } from "@/hooks/useGlobalMetadata";
import { fromDhakaTimeToUTC } from "@/lib/dateUtils";
import Papa from "papaparse";






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
  const [isOmr, setIsOmr] = useState(false);
  const [showSaveToWeb, setShowSaveToWeb] = useState(false);
  const [saveWebForm, setSaveWebForm] = useState({
    course_id: "",
    shared_course_ids: [] as string[],
    archive_course_ids: [] as string[],
    readymade_course_ids: [] as string[],
    subject: [] as string[],
    chapter: "",
    exam_type: "practice",
    duration_minutes: "30",
    total_marks: "",
    negative_mark_per_question: "0",
    instructions: "",
    time_window_start: "",
    time_window_end: "",
    is_published: false,
    is_visible_on_free: true,
    restrict_solution: false,
    is_readymade: false,
    readymade_topic: "",
    readymade_category: "",
    readymade_sub_chapter: "",
    is_omr_enabled: false,
  });

  // Fetch courses for Save to Website
  const { data: courses } = useQuery({
    queryKey: ["admin-courses-for-quiz"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, name").order("name");
      return data || [];
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: globalMeta } = useGlobalMetadata() as any;
  const addMetadata = useAddGlobalMetadata();
  const handleCreateMeta = (type: 'subject' | 'chapter' | 'readymade_topic', value: string) => {
    addMetadata.mutate({ type, value });
  };
  const courseOptions = courses?.map((c: any) => ({ label: c.name, value: c.id })) || [];

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
                .select("*")
                .eq("id", examId)
                .single();
            if (exam) setExamTitle((exam as any).title);
            if (exam) setIsOmr((exam as any).is_omr ?? false);

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

  const handleSaveToWebsite = async () => {
    if (questions.length === 0) {
      toast({ title: "No Questions", description: "Add at least one question before saving.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const f = saveWebForm;
      // 1. Create the exam with all fields
      const examPayload: any = {
        title: examTitle || "New Exam",
        course_id: f.course_id || null,
        shared_course_ids: f.shared_course_ids,
        archive_course_ids: f.archive_course_ids,
        readymade_course_ids: f.readymade_course_ids,
        subject: f.subject,
        chapter: f.chapter || null,
        exam_type: f.exam_type,
        duration_minutes: Number(f.duration_minutes) || 30,
        total_marks: f.total_marks ? Number(f.total_marks) : questions.length,
        negative_mark_per_question: f.negative_mark_per_question ? Number(f.negative_mark_per_question) : 0,
        instructions: f.instructions || null,
        time_window_start: f.time_window_start ? fromDhakaTimeToUTC(f.time_window_start) : null,
        time_window_end: f.time_window_end ? fromDhakaTimeToUTC(f.time_window_end) : null,
        is_published: f.is_published,
        is_visible_on_free: f.is_visible_on_free,
        restrict_solution: f.restrict_solution,
        is_readymade: f.is_readymade,
        readymade_topic: f.readymade_topic || null,
        readymade_category: f.readymade_category || null,
        readymade_sub_chapter: f.readymade_sub_chapter || null,
        is_omr: f.is_omr_enabled,
      };

      const { data: newExam, error: examError } = await supabase
        .from("exams")
        .insert(examPayload)
        .select("id")
        .single();

      if (examError) throw examError;
      if (!newExam?.id) throw new Error("Failed to create exam");

      // 2. Insert all questions
      const insertData = questions.map((q, idx) => ({
        exam_id: newExam.id,
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

      const { error: insertError } = await supabase.from("exam_questions").insert(insertData);
      if (insertError) throw insertError;

      toast({ title: "Exam Created!", description: `"${examTitle}" saved with ${questions.length} questions. You can now publish it from Exams page.` });
      setShowSaveToWeb(false);

      // Navigate to the new exam's question maker for further editing
      navigate(`/admin/exams/question-maker/${newExam.id}`);

    } catch (err) {
      console.error("Save to website error:", err);
      if (err instanceof Error) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const processImportedData = (data: any[], type: 'json' | 'csv') => {
        try {
            const normalized = data.map((q: any) => {
                let options = q.options || { A: "", B: "", C: "", D: "" };
                let correct_answer = String(q.correct_answer || q.correct_option || q.answer || "").toUpperCase();
                const question_text = String(q.question || q.question_text || q.questions || "");

                // If it's CSV, handle the specific format requested by user
                if (type === 'csv') {
                    // Try to parse options if it's a JSON string
                    if (typeof q.options === 'string') {
                        try {
                            options = JSON.parse(q.options);
                        } catch {
                            // ignore, fallback to column parsing
                        }
                    }

                    // If options are empty strings, build from column format: option1, option2, option3, option4
                    if (options.A === "" && options.B === "") {
                         options = {
                            A: q.option1 || q.option_a || q.A || q["Option A"] || "",
                            B: q.option2 || q.option_b || q.B || q["Option B"] || "",
                            C: q.option3 || q.option_c || q.C || q["Option C"] || "",
                            D: q.option4 || q.option_d || q.D || q["Option D"] || ""
                        };
                    }

                    // Map answer number to letter (1->A, 2->B, 3->C, 4->D)
                    if (correct_answer === "1") correct_answer = "A";
                    else if (correct_answer === "2") correct_answer = "B";
                    else if (correct_answer === "3") correct_answer = "C";
                    else if (correct_answer === "4") correct_answer = "D";
                }

                // Parse tags if it's a string in CSV
                let tags = q.tags || [];
                if (type === 'csv' && typeof q.tags === 'string') {
                    tags = q.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
                }

                return {
                    question: question_text,
                    options,
                    correct_answer,
                    explanation: String(q.explanation || ""),
                    subject: q.subject || "",
                    chapter: q.chapter || "",
                    topic: q.topic || "",
                    exam_code: q.exam_code || "",
                    year: q.year || "",
                    difficulty: q.difficulty || "",
                    tags
                };
            });
            setQuestions(prev => {
                const newList = [...prev, ...normalized];
                setSaveWebForm(form => {
                    const updates: any = {};
                    if (!form.total_marks || form.total_marks === "") {
                        updates.total_marks = String(newList.length);
                        updates.duration_minutes = String(Math.floor(newList.length / 2));
                    }
                    return { ...form, ...updates };
                });
                return newList;
            });
            toast({ title: "Import Successful", description: `Imported ${normalized.length} questions.` });
        } catch (err) {
            console.error(err);
            toast({ title: "Import Failed", description: "Could not parse questions properly.", variant: "destructive" });
        }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    handleFileImport(file);
    e.target.value = "";
  };

  const handleFileImport = (file: File) => {
    if (file.name.endsWith(".json")) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    processImportedData(parsed, 'json');
                } else {
                    toast({ title: "Invalid Format", description: "Expected an array of questions in JSON.", variant: "destructive" });
                }
            } catch (err) {
                console.error(err);
                toast({ title: "Import Failed", description: "Could not parse JSON file.", variant: "destructive" });
            }
        };
        reader.readAsText(file);
    } else if (file.name.endsWith(".csv")) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                     processImportedData(results.data, 'csv');
                } else {
                     toast({ title: "Invalid Format", description: "Could not read data from CSV.", variant: "destructive" });
                }
            },
            error: (error) => {
                console.error("CSV parse error:", error);
                toast({ title: "Import Failed", description: "Could not parse CSV file.", variant: "destructive" });
            }
        });
    } else {
         toast({ title: "Invalid File Type", description: "Please upload a JSON or CSV file.", variant: "destructive" });
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
          handleFileImport(file);
      }
  };

  const handleBankImport = (selectedQuestions: QuestionData[]) => {
      const cleanQuestions = selectedQuestions.map(q => ({
          ...q,
          id: undefined
      }));
      setQuestions(prev => [...prev, ...cleanQuestions]);
      toast({ title: "Imported", description: `Added ${cleanQuestions.length} questions from Question Bank.` });
  };

  const handleOmrImport = (scannedQuestions: QuestionData[]) => {
      setQuestions(prev => [...prev, ...scannedQuestions]);
  };

  return (
    <div
        className={`min-h-screen lg:h-[calc(100vh-4rem)] bg-muted/20 px-1.5 py-4 md:px-4 md:py-6 font-sans lg:overflow-hidden relative w-full max-w-none ${isDragging ? "after:content-[''] after:absolute after:inset-0 after:bg-primary/5 after:border-4 after:border-primary/50 after:border-dashed after:z-50 after:rounded-xl" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {isExporting && <LoadingScreen message={exportProgress} />}
      <div className={`w-full h-full flex flex-col space-y-4 sm:space-y-6 lg:overflow-y-auto pb-8 lg:pb-24 relative px-1 sm:px-0 ${showBankSelector ? "lg:flex-row lg:space-y-0 lg:gap-4 lg:flex" : ""}`}>
        <div className={`space-y-4 sm:space-y-6 ${showBankSelector ? "lg:w-[50%]" : "w-full"}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl bg-card p-4 sm:p-6 shadow-sm border border-border/60 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                        <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl sm:text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                            Quiz Maker Studio
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                            {examId ? `Editing: ${examTitle}` : "Create, edit, and export questions"}
                        </p>
                    </div>
                </div>

                <Input
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    className="w-full sm:w-[200px] font-medium h-9"
                    placeholder="Exam Title"
                    disabled={!!examId}
                />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {questions.length === 0 && !activeForm && (
                     <Button onClick={() => handleShowForm(0, 'initial')} size="sm" className="shadow-sm">
                        <Plus className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Add Question</span><span className="sm:hidden">Add</span>
                     </Button>
                )}

                {examId ? (
                    <>
                        <Button
                            onClick={handleSaveToDatabase}
                            disabled={isSaving}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 shadow-sm"
                        >
                            {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Database className="mr-1 h-4 w-4" />}
                            <span className="hidden sm:inline">Save</span>
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReplaceAllQuestions}
                            disabled={isSaving}
                            size="sm"
                            title="Delete all questions & Re-upload (Cleaner)"
                        >
                            {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                            <span className="hidden sm:inline">Replace</span>
                        </Button>
                    </>
                ) : (
                    <>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Export</span>
                    </Button>
                    <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 shadow-sm"
                        onClick={() => setShowSaveToWeb(true)}
                        disabled={questions.length === 0}
                    >
                        <Database className="mr-1 h-4 w-4" />
                        <span className="hidden sm:inline">Save to Website</span>
                        <span className="sm:hidden">Save</span>
                    </Button>
                    </>
                )}

                <div className="relative">
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('impf')?.click()}>
                        <Upload className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Import</span>
                    </Button>
                    <input type="file" id="impf" className="hidden" accept=".json,.csv" onChange={handleImport} />
                </div>

                 <Button variant="secondary" size="sm" onClick={() => setShowBankSelector(true)}>
                    <BookOpen className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Bank</span>
                </Button>

                <Button variant="destructive" size="sm" className="px-2" onClick={() => {
                    if (confirm("Are you sure you want to clear all questions?")) setQuestions([]);
                }}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>

        {/* Save to Website — Full Exam Form */}
        {showSaveToWeb && (
            <div className="border-2 border-green-300/50 rounded-[20px] bg-card p-5 sm:p-7 shadow-sm w-full mx-auto animate-in fade-in slide-in-from-top-4 duration-300 mt-4 mb-2">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                    <h3 className="font-bold text-xl flex items-center gap-2">
                        <Database className="h-5 w-5 text-green-600" /> Save Exam to Website
                    </h3>
                    <Button variant="ghost" size="icon" onClick={() => setShowSaveToWeb(false)} className="rounded-full h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label>Exam Title</Label>
                        <Input value={examTitle} onChange={e => setExamTitle(e.target.value)} placeholder="Exam Title" />
                    </div>

                    {/* Course */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>Course (Optional)</Label>
                            {saveWebForm.course_id && (
                                <Button type="button" variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={() => setSaveWebForm(prev => ({ ...prev, course_id: "" }))}>
                                    Clear
                                </Button>
                            )}
                        </div>
                        <Select value={saveWebForm.course_id || ""} onValueChange={v => setSaveWebForm(prev => ({ ...prev, course_id: v }))}>
                            <SelectTrigger>
                                <SelectValue placeholder="Public (No Course)" />
                            </SelectTrigger>
                            <SelectContent>
                                {courses?.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!saveWebForm.course_id && <p className="text-[10px] text-muted-foreground">This exam will be public (no course restriction).</p>}
                    </div>

                    {/* Shared Courses */}
                    {saveWebForm.course_id && (
                        <div className="space-y-2">
                            <Label>Also Share With (Optional)</Label>
                            <MultiSelect
                                options={courseOptions}
                                selected={saveWebForm.shared_course_ids}
                                onChange={vals => setSaveWebForm(prev => ({ ...prev, shared_course_ids: vals }))}
                                placeholder="Select additional courses..."
                            />
                        </div>
                    )}

                    {/* Archive For Courses */}
                    <div className="space-y-2">
                        <Label>Add to Archive of (Optional)</Label>
                        <MultiSelect
                            options={courseOptions}
                            selected={saveWebForm.archive_course_ids}
                            onChange={vals => setSaveWebForm(prev => ({ ...prev, archive_course_ids: vals }))}
                            placeholder="Select courses to archive for..."
                        />
                    </div>

                    {/* Exam Type */}
                    <div className="space-y-2">
                        <Label>Exam Type</Label>
                        <Select value={saveWebForm.exam_type} onValueChange={v => setSaveWebForm(prev => ({ ...prev, exam_type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="live">Live Exam</SelectItem>
                                <SelectItem value="practice">Practice Exam</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Subject */}
                    <div className="space-y-2">
                        <Label>Subjects</Label>
                        <MultiSelect
                            options={globalMeta?.subject || []}
                            selected={saveWebForm.subject}
                            onChange={selected => setSaveWebForm(prev => ({ ...prev, subject: selected }))}
                            onCreate={val => {
                                handleCreateMeta('subject', val);
                                setSaveWebForm(prev => ({ ...prev, subject: [...prev.subject, val] }));
                            }}
                            placeholder="Select or Create subjects..."
                        />
                    </div>

                    {/* Chapter */}
                    <div className="space-y-2">
                        <Label>Chapter</Label>
                        <CreatableSelect
                            options={globalMeta?.chapter || []}
                            value={saveWebForm.chapter}
                            onChange={val => setSaveWebForm(prev => ({ ...prev, chapter: val }))}
                            onCreate={val => {
                                handleCreateMeta('chapter', val);
                                setSaveWebForm(prev => ({ ...prev, chapter: val }));
                            }}
                            placeholder="Select or Create Chapter"
                        />
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                        <Label>Duration (minutes)</Label>
                        <Input type="number" value={saveWebForm.duration_minutes} onChange={e => setSaveWebForm(prev => ({ ...prev, duration_minutes: e.target.value }))} />
                    </div>

                    {/* Total Marks */}
                    <div className="space-y-2">
                        <Label>Total Marks (Manual Override)</Label>
                        <Input value={saveWebForm.total_marks} onChange={e => setSaveWebForm(prev => ({ ...prev, total_marks: e.target.value }))} placeholder={`Auto: ${questions.length} (1 per question)`} />
                    </div>

                    {/* Negative Marks */}
                    <div className="space-y-2">
                        <Label>Negative mark per wrong answer</Label>
                        <Input value={saveWebForm.negative_mark_per_question} onChange={e => setSaveWebForm(prev => ({ ...prev, negative_mark_per_question: e.target.value }))} placeholder="Ex: 0.25" />
                    </div>

                    {/* Instructions */}
                    <div className="space-y-2 md:col-span-2">
                        <Label>Instructions</Label>
                        <Textarea rows={3} value={saveWebForm.instructions} onChange={e => setSaveWebForm(prev => ({ ...prev, instructions: e.target.value }))} className="w-full" />
                    </div>

                    {/* Time Window Start */}
                    <div className="space-y-2">
                        <Label>Time window start</Label>
                        <Input type="datetime-local" value={saveWebForm.time_window_start} onChange={e => setSaveWebForm(prev => ({ ...prev, time_window_start: e.target.value }))} />
                    </div>

                    {/* Time Window End */}
                    <div className="space-y-2">
                        <Label>Time window end</Label>
                        <Input type="datetime-local" value={saveWebForm.time_window_end} onChange={e => setSaveWebForm(prev => ({ ...prev, time_window_end: e.target.value }))} />
                    </div>

                    {/* Toggle: Published */}
                    <div className="flex items-center gap-2 md:col-span-2">
                        <Switch checked={saveWebForm.is_published} onCheckedChange={checked => setSaveWebForm(prev => ({ ...prev, is_published: checked }))} />
                        <Label>Exam is published / visible to students</Label>
                    </div>

                    {/* Toggle: Visible on Free */}
                    {!saveWebForm.course_id && (
                        <div className="flex items-center gap-2 md:col-span-2">
                            <Switch checked={saveWebForm.is_visible_on_free} onCheckedChange={checked => setSaveWebForm(prev => ({ ...prev, is_visible_on_free: checked }))} />
                            <Label>Show on "Free Exams" Page (Public)</Label>
                        </div>
                    )}

                    {/* Toggle: Restrict Solution */}
                    <div className="flex items-center gap-2 md:col-span-2 border p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200">
                        <Switch checked={saveWebForm.restrict_solution} onCheckedChange={checked => setSaveWebForm(prev => ({ ...prev, restrict_solution: checked }))} />
                        <Label className="flex flex-col">
                            <span>Restrict Solution (Solvesheet)</span>
                            <span className="text-xs text-muted-foreground font-normal">If enabled, students cannot see the detailed solution or correct answers after the exam.</span>
                        </Label>
                    </div>

                    {/* Toggle: OMR */}
                    <div className="flex items-center gap-2 md:col-span-2 border p-3 rounded-lg bg-violet-50 dark:bg-violet-900/10 border-violet-200">
                        <Switch checked={saveWebForm.is_omr_enabled} onCheckedChange={checked => setSaveWebForm(prev => ({ ...prev, is_omr_enabled: checked }))} />
                        <Label className="flex flex-col">
                            <span>Enable OMR Scanner</span>
                            <span className="text-xs text-muted-foreground font-normal">If enabled, the Exam Creator will show an OMR Scanner section.</span>
                        </Label>
                    </div>

                    {/* Toggle: Readymade */}
                    <div className="md:col-span-2 border p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border-blue-200 space-y-4">
                        <div className="flex items-center gap-2">
                            <Switch checked={saveWebForm.is_readymade} onCheckedChange={checked => setSaveWebForm(prev => ({ ...prev, is_readymade: checked }))} />
                            <Label className="flex flex-col">
                                <span>Is Readymade Exam?</span>
                                <span className="text-xs text-muted-foreground font-normal">Enable to show in "Readymade" section.</span>
                            </Label>
                        </div>
                        {saveWebForm.is_readymade && (
                            <>
                            {/* HSC Board Hierarchy: Category → Subject (chapter) → Sub-chapter (session) → Exam */}
                            <div className="mt-2 p-3 bg-blue-50/80 dark:bg-blue-900/5 rounded-lg border border-blue-100 space-y-3">
                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">HSC Board Exam Structure</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Board / Category <span className="text-muted-foreground">(e.g. ঢাকা বোর্ড)</span></Label>
                                        <CreatableSelect
                                            options={globalMeta?.readymade_category || []}
                                            value={saveWebForm.readymade_category}
                                            onChange={val => setSaveWebForm(prev => ({ ...prev, readymade_category: val }))}
                                            onCreate={val => {
                                                handleCreateMeta('readymade_category', val);
                                                setSaveWebForm(prev => ({ ...prev, readymade_category: val }));
                                            }}
                                            placeholder="Select or Create Board"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Parent Group / Topic <span className="text-muted-foreground">(e.g. Board Questions)</span></Label>
                                        <CreatableSelect
                                            options={globalMeta?.readymade_topic || []}
                                            value={saveWebForm.readymade_topic}
                                            onChange={val => setSaveWebForm(prev => ({ ...prev, readymade_topic: val }))}
                                            onCreate={val => {
                                                handleCreateMeta('readymade_topic', val);
                                                setSaveWebForm(prev => ({ ...prev, readymade_topic: val }));
                                            }}
                                            placeholder="Select or Create Topic"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Session / Sub-chapter <span className="text-muted-foreground">(e.g. HSC 2023)</span></Label>
                                        <CreatableSelect
                                            options={globalMeta?.readymade_sub_chapter || []}
                                            value={saveWebForm.readymade_sub_chapter}
                                            onChange={val => setSaveWebForm(prev => ({ ...prev, readymade_sub_chapter: val }))}
                                            onCreate={val => {
                                                handleCreateMeta('readymade_sub_chapter' as any, val);
                                                setSaveWebForm(prev => ({ ...prev, readymade_sub_chapter: val }));
                                            }}
                                            placeholder="Select or Create Session"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Readymade For Courses (Optional)</Label>
                                        <MultiSelect
                                            options={courseOptions}
                                            selected={saveWebForm.readymade_course_ids}
                                            onChange={vals => setSaveWebForm(prev => ({ ...prev, readymade_course_ids: vals }))}
                                            placeholder="Select courses..."
                                        />
                                    </div>
                                </div>
                            </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <Button variant="ghost" onClick={() => setShowSaveToWeb(false)}>Cancel</Button>
                    <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={handleSaveToWebsite}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Database className="mr-1 h-4 w-4" />}
                        Create Exam ({questions.length} Questions)
                    </Button>
                </div>
            </div>
        )}


        </div>
        {/* Question Bank (Side by Side) */}
        {showBankSelector && (
            <div className="lg:w-[50%] flex flex-col h-[calc(100vh-6rem)] sticky top-4 border border-border/60 rounded-[20px] bg-card p-4 sm:p-6 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50 shrink-0">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-foreground">Question Bank</h2>
                            <p className="text-[13px] text-muted-foreground mt-0.5">Import from existing database</p>
                        </div>
                     </div>
                     <Button variant="ghost" size="icon" onClick={() => setShowBankSelector(false)} className="rounded-full h-8 w-8 hover:bg-secondary">
                        <Trash2 className="h-4 w-4" />
                     </Button>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col rounded-xl border border-border/50">
                    <QuestionBankSelector onSelect={handleBankImport} />
                </div>
            </div>
        )}

        {/* OMR Scanner Section */}
        {isOmr && (
            <OmrScanner onImportQuestions={handleOmrImport} />
        )}

        {/* Questions List */}
        <div className="space-y-6 pb-32 pt-2">
            {questions.length === 0 && !activeForm && (
                <div className="text-center py-20 rounded-3xl border border-dashed border-muted-foreground/30 bg-card">
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
                <div key={i} className="group relative border border-border/60 hover:border-border/80 transition-all rounded-[30px] p-5 sm:p-7 bg-card shadow-sm w-full mx-auto">
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
                    <div className="relative flex flex-col gap-3">
                        {/* Main Content */}
                        <div className="flex-1 flex flex-col">
                            <div className="absolute right-0 top-0 md:-right-2 md:-top-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                                <Button size="icon" variant="outline" className="h-8 w-8 shadow-sm bg-background rounded-full" onClick={() => handleShowForm(i, 'edit')} title="Edit">
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="destructive" className="h-8 w-8 shadow-sm rounded-full" onClick={() => handleDeleteQuestion(i)} title="Delete">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex gap-2 sm:gap-3 items-start mb-2">
                                <span className="font-bold text-lg sm:text-xl leading-snug shrink-0">{i + 1}.</span>
                                <div className="flex-1">
                                    <MathText className="prose prose-sm sm:prose-base max-w-none dark:prose-invert font-medium mt-[1px]" text={q.question} />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 mb-3">
                                {Object.entries(q.options).map(([key, val]) => {
                                    const isCorrect = q.correct_answer === key;
                                    return (
                                        <div
                                            key={key}
                                            className={`relative px-3 py-1.5 rounded-xl transition-all duration-200 flex gap-3 items-center border-transparent ${
                                                isCorrect
                                                ? 'bg-[#f0fdf4] dark:bg-green-900/10 text-[#2BA25C]'
                                                : 'hover:bg-secondary/30'
                                            }`}
                                        >
                                            <div className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 font-bold text-sm ${isCorrect ? 'bg-[#2BA25C] text-white' : 'text-foreground/80'}`}>
                                                {key}
                                            </div>
                                            <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert break-words overflow-hidden text-foreground/90 flex-1">
                                                <MathText text={String(val)} />
                                            </div>
                                            {isCorrect && (
                                                <div className="shrink-0">
                                                    <div className="bg-[#2BA25C] rounded-full p-0.5 shadow-sm">
                                                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Explanation Inline */}
                            {q.explanation && (
                                <div className="mt-1 p-3 sm:p-4 bg-[#f8fafc] dark:bg-slate-900/30 rounded-2xl border border-[#e2e8f0]/80 dark:border-slate-800/50 text-sm">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] shadow-[0_0_4px_rgba(59,130,246,0.6)]"></div>
                                        <span className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-[0.1em]">
                                            Explanation
                                        </span>
                                    </div>
                                    <div className="pl-3.5 border-l-2 border-[#3b82f6]/20 py-0.5">
                                        <MathText className="prose prose-sm max-w-none dark:prose-invert text-foreground/85 leading-relaxed" text={q.explanation} />
                                    </div>
                                </div>
                            )}

                            {/* Tags / Meta Display */}
                            {(q.subject || q.chapter || q.topic || q.exam_code || q.year || q.difficulty || (q.tags && q.tags.length > 0)) && (
                                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/40">
                                    {q.subject && <span className="text-[9px] sm:text-[10px] bg-secondary/60 text-secondary-foreground px-2 py-0.5 rounded-md">{q.subject}</span>}
                                    {q.chapter && <span className="text-[9px] sm:text-[10px] bg-secondary/60 text-secondary-foreground px-2 py-0.5 rounded-md">{q.chapter}</span>}
                                    {q.topic && <span className="text-[9px] sm:text-[10px] bg-secondary/60 text-secondary-foreground px-2 py-0.5 rounded-md">{q.topic}</span>}
                                    {q.exam_code && <span className="text-[9px] sm:text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md">{q.exam_code}</span>}
                                    {q.year && <span className="text-[9px] sm:text-[10px] bg-secondary/60 text-secondary-foreground px-2 py-0.5 rounded-md">{q.year}</span>}
                                    {q.tags && q.tags.map((t: string) => <span key={t} className="text-[9px] sm:text-[10px] bg-secondary/60 text-secondary-foreground px-2 py-0.5 rounded-md">#{t}</span>)}
                                </div>
                            )}
                        </div>

                    </div>
                    )}
                </div>
            ))}

            {activeForm && (activeForm.type === 'initial' || activeForm.type === 'below' || activeForm.type === 'above') && (
                 <div className="border-2 border-primary/30 shadow-md overflow-hidden rounded-[30px] my-5 bg-card w-full mx-auto">
                    <div className="px-5 sm:px-6 py-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
                            <Plus className="h-5 w-5" /> New Question
                        </h2>
                        <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={() => setActiveForm(null)}>Cancel</Button>
                    </div>
                    <div className="p-5 sm:p-7 bg-card">
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
