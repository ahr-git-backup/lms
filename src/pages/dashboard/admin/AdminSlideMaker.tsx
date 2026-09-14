import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";
import { ColorWheelPicker } from "@/components/admin/ColorWheelPicker";
import { QuestionData } from "@/types/exam";
import { Upload, BookOpen, X, Download, Loader2, ChevronLeft, ChevronRight, Trash2, ImagePlus, Eye } from "lucide-react";

interface SlideQuestion {
  id: string;
  question: string;
  options: { [key: string]: string };
  correct_answer: string;
}

interface SlideSettings {
  bgColor: string;
  fontColor: string;
  questionFontSize: number;
  optionFontSize: number;
  optionBgColor: string;
  optionBorderColor: string;
  fontFamily: string;
  headerLeftText: string;
  headerRightText: string;
  centerText: string;
  headerFontSize: number;
  headerFontColor: string;
  headerPosition: "top" | "middle" | "bottom";
  logoLeftUrl: string;
  logoRightUrl: string;
  questionBgColor: string;
  questionBorderColor: string;
  questionBoxEnabled: boolean;
}

const DEFAULT_SETTINGS: SlideSettings = {
  bgColor: "#0f172a",
  fontColor: "#ffffff",
  questionFontSize: 28,
  optionFontSize: 20,
  optionBgColor: "#1e293b",
  optionBorderColor: "#38bdf8",
  fontFamily: "'Hind Siliguri', sans-serif",
  headerLeftText: "",
  headerRightText: "",
  centerText: "",
  headerFontSize: 18,
  headerFontColor: "#ffffff",
  headerPosition: "top",
  logoLeftUrl: "",
  logoRightUrl: "",
  questionBgColor: "",
  questionBorderColor: "",
  questionBoxEnabled: false,
};

const SLIDE_W = 1280;
const SLIDE_H = 720;

const BANGLA_FONTS = [
  { label: "Hind Siliguri", value: "'Hind Siliguri', sans-serif" },
  { label: "Noto Sans Bengali", value: "'Noto Sans Bengali', sans-serif" },
  { label: "Kalpurush", value: "'Kalpurush', sans-serif" },
  { label: "SolaimanLipi", value: "'SolaimanLipi', sans-serif" },
  { label: "Siyam Rupali", value: "'Siyam Rupali', sans-serif" },
  { label: "AponaLohit", value: "'AponaLohit', sans-serif" },
  { label: "AdorshoLipi", value: "'AdorshoLipi', sans-serif" },
  { label: "Baloo Da 2", value: "'Baloo Da 2', sans-serif" },
  { label: "Tiro Bangla", value: "'Tiro Bangla', serif" },
  { label: "Atma", value: "'Atma', cursive" },
  { label: "Anek Bangla", value: "'Anek Bangla', sans-serif" },
  { label: "Mina", value: "'Mina', sans-serif" },
  { label: "Galada", value: "'Galada', cursive" },
];

const SlideVisual = ({
  question,
  settings,
  editable,
  onEditField,
}: {
  question: SlideQuestion;
  settings: SlideSettings;
  editable?: boolean;
  onEditField?: (field: "question" | "A" | "B" | "C" | "D", value: string) => void;
}) => {
  const makeEditable = (field: "question" | "A" | "B" | "C" | "D", value: string) =>
    editable
      ? {
          contentEditable: true,
          suppressContentEditableWarning: true,
          onBlur: (e: React.FocusEvent<HTMLElement>) => {
            const next = e.currentTarget.textContent ?? "";
            if (next !== value) onEditField?.(field, next);
          },
        }
      : {};

  return (
    <div
      data-slide-capture="true"
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        backgroundColor: settings.bgColor,
        color: settings.fontColor,
        fontFamily: settings.fontFamily,
        boxSizing: "border-box",
        padding: 40,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: settings.headerPosition === "top" ? 20 : settings.headerPosition === "middle" ? "50%" : undefined,
          bottom: settings.headerPosition === "bottom" ? 20 : undefined,
          transform: settings.headerPosition === "middle" ? "translateY(-50%)" : undefined,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: 50,
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: settings.headerFontSize, color: settings.headerFontColor }}>
          {settings.logoLeftUrl && <img src={settings.logoLeftUrl} style={{ height: 40, width: "auto" }} />}
          {settings.headerLeftText}
        </div>
        {settings.centerText && <div style={{ fontSize: settings.headerFontSize + 2, fontWeight: 700, color: settings.headerFontColor }}>{settings.centerText}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: settings.headerFontSize, color: settings.headerFontColor }}>
          {settings.headerRightText}
          {settings.logoRightUrl && <img src={settings.logoRightUrl} style={{ height: 40, width: "auto" }} />}
        </div>
      </div>

      <div style={{ minHeight: settings.headerPosition === "top" ? 70 : 0 }} />

      {/* Question */}
      <div
        {...makeEditable("question", question.question)}
        style={{
          fontSize: settings.questionFontSize,
          fontFamily: settings.fontFamily,
          fontWeight: 700,
          marginTop: 20,
          marginBottom: 20,
          width: "100%",
          lineHeight: 1.4,
          ...(editable ? { outline: "none", cursor: "text" } : {}),
          ...(settings.questionBoxEnabled
            ? {
                backgroundColor: settings.questionBgColor || "#1e293b",
                border: `2px solid ${settings.questionBorderColor || "#38bdf8"}`,
                borderRadius: 16,
                padding: "20px 28px",
                boxShadow: `0 0 14px ${settings.questionBorderColor || "#38bdf8"}`,
                boxSizing: "border-box",
              }
            : {}),
        }}
      >
        {question.question}
      </div>

      {/* Options */}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", paddingBottom: 70 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gridAutoRows: "1fr", gap: 20, width: "55%" }}>
          {Object.entries(question.options).map(([key, val]) => (
            <div
              key={key}
              style={{
                backgroundColor: settings.optionBgColor,
                border: `2px solid ${settings.optionBorderColor}`,
                borderRadius: 16,
                padding: "20px 28px",
                fontSize: settings.optionFontSize,
                fontFamily: settings.fontFamily,
                boxShadow: `0 0 14px ${settings.optionBorderColor}`,
                display: "flex",
                gap: 14,
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 700 }}>{key}.</span>
              <span
                {...makeEditable(key as "A" | "B" | "C" | "D", val)}
                style={{ flex: 1, ...(editable ? { outline: "none", cursor: "text" } : {}) }}
              >
                {val}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AdminSlideMaker = () => {
  const { toast } = useToast();
  useEffect(() => {
    document.title = "Slide Maker – Atlas";
  }, []);

  const [questions, setQuestions] = useState<SlideQuestion[]>([]);
  const [settings, setSettings] = useState<SlideSettings>(DEFAULT_SETTINGS);
  const [isQbOpen, setIsQbOpen] = useState(false);
  const [isPreviewAllOpen, setIsPreviewAllOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ qId: string; field: "question" | "A" | "B" | "C" | "D" } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const update = () => setPreviewScale(el.offsetWidth / SLIDE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const updateQuestionText = (qId: string, field: "question" | "A" | "B" | "C" | "D", value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        if (field === "question") return { ...q, question: value };
        return { ...q, options: { ...q.options, [field]: value } };
      })
    );
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, side: "logoLeftUrl" | "logoRightUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSettings((prev) => ({ ...prev, [side]: ev.target?.result as string }));
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
        const canvas = await html2canvas(slideRef.current, {
          width: SLIDE_W,
          height: SLIDE_H,
          scale: 2,
          useCORS: true,
          onclone: (clonedDoc) => {
            // The scale transform lives on the wrapper div (slideRef itself,
            // identified by data-slide-scale-wrap), not on the inner
            // data-slide-capture slide content — reset it to full size so
            // html2canvas captures crisp full-resolution output instead of
            // the small scaled-down preview.
            const el = clonedDoc.body.querySelector('[data-slide-scale-wrap="true"]') as HTMLElement | null;
            if (el) el.style.transform = "scale(1)";
          },
        });
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

      {/* Live preview — moved to the very top of the page, always visible,
          uses sample question until real ones added */}
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

        <div className="w-full">
          <div ref={previewWrapRef} className="w-full max-w-[640px] mx-auto" style={{ aspectRatio: "16/9", position: "relative", overflow: "hidden" }}>
            <div
              ref={slideRef}
              data-slide-scale-wrap="true"
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: "top left",
                position: "absolute",
                top: 0,
                left: 0,
              }}
            >
              <SlideVisual question={activeQuestion} settings={settings} />
            </div>
          </div>
        </div>
      </div>

      {/* Settings panel — below the preview now */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Background Color</Label>
            <ColorWheelPicker color={settings.bgColor} onChange={(hex) => setSettings((p) => ({ ...p, bgColor: hex }))} label="Background Color" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Font Color</Label>
            <ColorWheelPicker color={settings.fontColor} onChange={(hex) => setSettings((p) => ({ ...p, fontColor: hex }))} label="Font Color" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Option Box Background</Label>
            <ColorWheelPicker color={settings.optionBgColor} onChange={(hex) => setSettings((p) => ({ ...p, optionBgColor: hex }))} label="Option Box Background" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Option Border (Neon)</Label>
            <ColorWheelPicker color={settings.optionBorderColor} onChange={(hex) => setSettings((p) => ({ ...p, optionBorderColor: hex }))} label="Option Border" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Question Box</Label>
              <button
                type="button"
                onClick={() => setSettings((p) => ({ ...p, questionBoxEnabled: !p.questionBoxEnabled }))}
                className={`h-5 w-9 rounded-full transition-colors relative ${settings.questionBoxEnabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.questionBoxEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
            <ColorWheelPicker
              color={settings.questionBgColor || "#1e293b"}
              onChange={(hex) => setSettings((p) => ({ ...p, questionBgColor: hex }))}
              label="Question Box Background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Question Border</Label>
            <ColorWheelPicker
              color={settings.questionBorderColor || "#38bdf8"}
              onChange={(hex) => setSettings((p) => ({ ...p, questionBorderColor: hex }))}
              label="Question Border"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Question Font Size ({settings.questionFontSize}px)</Label>
            <Input type="range" min={16} max={56} value={settings.questionFontSize} onChange={(e) => setSettings((p) => ({ ...p, questionFontSize: Number(e.target.value) }))} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Option Font Size ({settings.optionFontSize}px)</Label>
            <Input type="range" min={14} max={40} value={settings.optionFontSize} onChange={(e) => setSettings((p) => ({ ...p, optionFontSize: Number(e.target.value) }))} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">বাংলা ফন্ট</Label>
            <Select value={settings.fontFamily} onValueChange={(v) => setSettings((p) => ({ ...p, fontFamily: v }))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANGLA_FONTS.map((f) => (
                  <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Header Font Size ({settings.headerFontSize}px)</Label>
            <Input type="range" min={12} max={36} value={settings.headerFontSize} onChange={(e) => setSettings((p) => ({ ...p, headerFontSize: Number(e.target.value) }))} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Header Font Color</Label>
            <ColorWheelPicker color={settings.headerFontColor} onChange={(hex) => setSettings((p) => ({ ...p, headerFontColor: hex }))} label="Header Font Color" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Header Position</Label>
            <Select value={settings.headerPosition} onValueChange={(v: "top" | "middle" | "bottom") => setSettings((p) => ({ ...p, headerPosition: v }))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">উপরে</SelectItem>
                <SelectItem value="middle">মাঝে</SelectItem>
                <SelectItem value="bottom">নিচে</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Header Left (Corner)</Label>
            <Input value={settings.headerLeftText} onChange={(e) => setSettings((p) => ({ ...p, headerLeftText: e.target.value }))} placeholder="Text (optional)" />
            <div className="flex items-center gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => document.getElementById("slide-logo-left-input")?.click()}>
                <ImagePlus className="h-3.5 w-3.5 mr-1" /> Logo
              </Button>
              <input id="slide-logo-left-input" type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, "logoLeftUrl")} className="hidden" />
              {settings.logoLeftUrl && (
                <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={() => setSettings((p) => ({ ...p, logoLeftUrl: "" }))}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Header Right (Corner)</Label>
            <Input value={settings.headerRightText} onChange={(e) => setSettings((p) => ({ ...p, headerRightText: e.target.value }))} placeholder="Text (optional)" />
            <div className="flex items-center gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => document.getElementById("slide-logo-right-input")?.click()}>
                <ImagePlus className="h-3.5 w-3.5 mr-1" /> Logo
              </Button>
              <input id="slide-logo-right-input" type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, "logoRightUrl")} className="hidden" />
              {settings.logoRightUrl && (
                <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={() => setSettings((p) => ({ ...p, logoRightUrl: "" }))}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Center Text</Label>
            <Input value={settings.centerText} onChange={(e) => setSettings((p) => ({ ...p, centerText: e.target.value }))} placeholder="Optional" />
          </div>
        </CardContent>
      </Card>

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

          <div className="flex justify-center gap-2">
            <Button onClick={() => setIsPreviewAllOpen(true)} variant="outline" size="lg">
              <Eye className="h-4 w-4 mr-2" />
              সব দেখুন / Edit
            </Button>
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

      <Dialog open={isPreviewAllOpen} onOpenChange={setIsPreviewAllOpen}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle>সব স্লাইড ({questions.length}) — টেক্সটে ক্লিক করে এডিট করুন</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {questions.map((q, idx) => (
                <PreviewGridSlide
                  key={q.id}
                  index={idx}
                  question={q}
                  settings={settings}
                  onEditField={(field, value) => updateQuestionText(q.id, field, value)}
                />
              ))}
            </div>
          </div>
          <div className="p-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPreviewAllOpen(false)}>বন্ধ করুন</Button>
            <Button onClick={exportPdf} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {isExporting ? "তৈরি হচ্ছে..." : "PDF Download"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/** A single slide cell inside the "preview all" grid — scales SlideVisual
    down to fit the grid cell width while keeping it editable. Uses a
    ResizeObserver-free approach (fixed aspect-ratio box + measured width on
    mount/resize) since the grid is responsive (1 or 2 columns). */
const PreviewGridSlide = ({
  index,
  question,
  settings,
  onEditField,
}: {
  index: number;
  question: SlideQuestion;
  settings: SlideSettings;
  onEditField: (field: "question" | "A" | "B" | "C" | "D", value: string) => void;
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.offsetWidth / SLIDE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">#{index + 1}</p>
      <div ref={wrapRef} className="w-full rounded-lg overflow-hidden border" style={{ aspectRatio: "16/9", position: "relative" }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
          <SlideVisual question={question} settings={settings} editable onEditField={onEditField} />
        </div>
      </div>
    </div>
  );
};

export default AdminSlideMaker;
