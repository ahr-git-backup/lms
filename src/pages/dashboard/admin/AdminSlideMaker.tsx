import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";
import { QuestionData } from "@/types/exam";
import { Upload, BookOpen, X, Download, Loader2, ChevronLeft, ChevronRight, Trash2, ImagePlus } from "lucide-react";

interface SlideQuestion {
  id: string;
  question: string;
  options: { [key: string]: string };
  correct_answer: string;
}

interface SlideSettings {
  bgColor: string;
  fontColor: string;
  fontSize: number;
  optionBorderColor: string;
  headerLeftText: string;
  headerRightText: string;
  centerText: string;
  logoUrl: string;
}

const DEFAULT_SETTINGS: SlideSettings = {
  bgColor: "#0f172a",
  fontColor: "#ffffff",
  fontSize: 28,
  optionBorderColor: "#38bdf8",
  headerLeftText: "",
  headerRightText: "",
  centerText: "",
  logoUrl: "",
};

const SLIDE_W = 1280;
const SLIDE_H = 720;

const AdminSlideMaker = () => {
  const { toast } = useToast();
  useEffect(() => {
    document.title = "Slide Maker – Atlas";
  }, []);

  const [questions, setQuestions] = useState<SlideQuestion[]>([]);
  const [settings, setSettings] = useState<SlideSettings>(DEFAULT_SETTINGS);
  const [isQbOpen, setIsQbOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const result = Papa.parse(content, { header: true, skipEmptyLines: true, newline: "" }) as any;
        const rows: SlideQuestion[] = [];
        result.data.forEach((row: any, idx: number) => {
          const qText = row["questions"];
          if (!qText) return;
          const o1 = row["option1"], o2 = row["option2"], o3 = row["option3"], o4 = row["option4"];
          const anyFilled = [o1, o2, o3, o4].some((v) => String(v || "").trim() !== "");
          if (!anyFilled) return;
          const ansIdx = Number(row["answer"]);
          const correct = ansIdx >= 1 && ansIdx <= 4 ? ["A", "B", "C", "D"][ansIdx - 1] : "A";
          rows.push({
            id: `csv-${idx}-${Date.now()}`,
            question: qText,
            options: { A: o1 || "", B: o2 || "", C: o3 || "", D: o4 || "" },
            correct_answer: correct,
          });
        });
        setQuestions((prev) => [...prev, ...rows]);
        toast({ title: "CSV loaded", description: `${rows.length} question(s) added` });
      } catch (err) {
        toast({ title: "Error loading CSV", variant: "destructive" });
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleQbSelect = (qbQuestions: QuestionData[]) => {
    const mapped: SlideQuestion[] = qbQuestions.map((q, idx) => ({
      id: `qb-${idx}-${Date.now()}`,
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
    }));
    setQuestions((prev) => [...prev, ...mapped]);
    setIsQbOpen(false);
    toast({ title: "Added from Question Bank", description: `${mapped.length} question(s) added` });
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => {
      const next = prev.filter((q) => q.id !== id);
      if (activeIndex >= next.length) setActiveIndex(Math.max(0, next.length - 1));
      return next;
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSettings((prev) => ({ ...prev, logoUrl: ev.target?.result as string }));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const exportPdf = async () => {
    if (questions.length === 0) {
      toast({ title: "কোনো প্রশ্ন নেই", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H] });
      for (let i = 0; i < questions.length; i++) {
        setActiveIndex(i);
        // wait for DOM paint
        await new Promise((r) => setTimeout(r, 60));
        if (!slideRef.current) continue;
        const canvas = await html2canvas(slideRef.current, { width: SLIDE_W, height: SLIDE_H, scale: 2, useCORS: true });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H], "landscape");
        pdf.addImage(imgData, "JPEG", 0, 0, SLIDE_W, SLIDE_H);
      }
      pdf.save("mcq-slides.pdf");
      toast({ title: "PDF তৈরি হয়েছে", description: "Download শুরু হয়েছে" });
    } catch (err) {
      console.error(err);
      toast({ title: "PDF তৈরি করতে সমস্যা হয়েছে", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const SAMPLE_QUESTION: SlideQuestion = {
    id: "sample",
    question: "বাংলাদেশের রাজধানীর নাম কী?",
    options: { A: "ঢাকা", B: "চট্টগ্রাম", C: "সিলেট", D: "রাজশাহী" },
    correct_answer: "A",
  };

  const activeQuestion = questions.length > 0 ? questions[activeIndex] : SAMPLE_QUESTION;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Slide Maker</h1>
        <p className="text-sm text-muted-foreground">আগে ফরম্যাট ঠিক করুন, পরে প্রশ্ন যোগ করে PDF বানান।</p>
      </header>

      {/* Settings panel — first, with live preview */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Background Color</Label>
            <Input type="color" value={settings.bgColor} onChange={(e) => setSettings((p) => ({ ...p, bgColor: e.target.value }))} className="h-9 p-1" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Font Color</Label>
            <Input type="color" value={settings.fontColor} onChange={(e) => setSettings((p) => ({ ...p, fontColor: e.target.value }))} className="h-9 p-1" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Option Border (Neon)</Label>
            <Input type="color" value={settings.optionBorderColor} onChange={(e) => setSettings((p) => ({ ...p, optionBorderColor: e.target.value }))} className="h-9 p-1" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Font Size ({settings.fontSize}px)</Label>
            <Input type="range" min={16} max={48} value={settings.fontSize} onChange={(e) => setSettings((p) => ({ ...p, fontSize: Number(e.target.value) }))} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Header Left Text</Label>
            <Input value={settings.headerLeftText} onChange={(e) => setSettings((p) => ({ ...p, headerLeftText: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Header Right Text</Label>
            <Input value={settings.headerRightText} onChange={(e) => setSettings((p) => ({ ...p, headerRightText: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Center Text</Label>
            <Input value={settings.centerText} onChange={(e) => setSettings((p) => ({ ...p, centerText: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Logo</Label>
            <div className="flex items-center gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-9 px-2" onClick={() => document.getElementById("slide-logo-input")?.click()}>
                <ImagePlus className="h-3.5 w-3.5" />
              </Button>
              <input id="slide-logo-input" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              {settings.logoUrl && (
                <Button type="button" size="sm" variant="ghost" className="h-9 px-2 text-destructive" onClick={() => setSettings((p) => ({ ...p, logoUrl: "" }))}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live preview — always visible, uses sample question until real ones added */}
      <div>
        {questions.length > 0 && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <Button size="icon" variant="outline" disabled={activeIndex === 0} onClick={() => setActiveIndex((i) => i - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{activeIndex + 1} / {questions.length}</span>
            <Button size="icon" variant="outline" disabled={activeIndex === questions.length - 1} onClick={() => setActiveIndex((i) => i + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {questions.length === 0 && (
          <p className="text-center text-xs text-muted-foreground mb-2">প্রিভিউ (নমুনা প্রশ্ন) — নিচে থেকে আসল প্রশ্ন যোগ করুন</p>
        )}

        <div className="w-full overflow-x-auto">
          <div style={{ width: SLIDE_W / 2, aspectRatio: "16/9" }} className="mx-auto">
            <div
              ref={slideRef}
              style={{
                width: SLIDE_W,
                height: SLIDE_H,
                backgroundColor: settings.bgColor,
                color: settings.fontColor,
                transform: "scale(0.5)",
                transformOrigin: "top left",
                position: "relative",
                fontFamily: "inherit",
                boxSizing: "border-box",
                padding: 40,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 50 }}>
                <div style={{ fontSize: 18, opacity: 0.8 }}>{settings.headerLeftText}</div>
                {settings.centerText && <div style={{ fontSize: 20, fontWeight: 700 }}>{settings.centerText}</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, opacity: 0.8 }}>
                  {settings.headerRightText}
                  {settings.logoUrl && <img src={settings.logoUrl} style={{ height: 40, width: "auto" }} />}
                </div>
              </div>

              {/* Question - full width */}
              <div style={{ fontSize: settings.fontSize, fontWeight: 700, marginTop: 24, marginBottom: 24, width: "100%", lineHeight: 1.4 }}>
                {activeQuestion.question}
              </div>

              {/* Options - vertical, right side */}
              <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "55%" }}>
                  {Object.entries(activeQuestion.options).map(([key, val]) => (
                    <div
                      key={key}
                      style={{
                        border: `2px solid ${settings.optionBorderColor}`,
                        borderRadius: 14,
                        padding: "14px 20px",
                        fontSize: settings.fontSize * 0.7,
                        boxShadow: `0 0 12px ${settings.optionBorderColor}`,
                        display: "flex",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{key}.</span>
                      <span>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Source cards — last step, same pattern as Exam form */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">এবার প্রশ্ন যোগ করুন</p>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div
            className="border-2 border-dashed rounded-lg p-2 sm:p-4 text-center cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center min-h-[100px]"
            onClick={() => document.getElementById("slide-csv-input")?.click()}
          >
            <input id="slide-csv-input" type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
            <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm">CSV আপলোড করুন</p>
          </div>
          <div
            className="border-2 border-dashed rounded-lg p-2 sm:p-4 text-center cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center min-h-[100px]"
            onClick={() => setIsQbOpen(true)}
          >
            <BookOpen className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm">Question Bank থেকে সিলেক্ট করুন</p>
          </div>
        </div>
      </div>

      {questions.length > 0 && (
        <>
          {/* Question list */}
          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setActiveIndex(idx)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                  idx === activeIndex ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                #{idx + 1}
                <Trash2
                  className="h-3 w-3 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }}
                />
              </button>
            ))}
          </div>

          <div className="flex justify-center">
            <Button onClick={exportPdf} disabled={isExporting} size="lg">
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {isExporting ? "তৈরি হচ্ছে..." : "PDF Download"}
            </Button>
          </div>
        </>
      )}

      <Dialog open={isQbOpen} onOpenChange={setIsQbOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Select from Question Bank</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-0.5 sm:p-4 pt-2 h-[calc(85vh-60px)]">
            <QuestionBankSelector onSelect={handleQbSelect} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSlideMaker;
