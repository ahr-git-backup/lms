import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  Upload,
  Crop,
  ScanLine,
  Loader2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  RotateCw,
  AlertTriangle,
  Info,
  X,
  Check,
} from "lucide-react";
import Cropper, { ReactCropperElement } from "react-cropper";

// OMR API URL — set this to your Render deployment
const OMR_API_URL =
  import.meta.env.VITE_OMR_API_URL || "http://127.0.0.1:8000";

const QUESTION_OPTIONS = [
  { value: "25", label: "25 Questions", columns: 1 },
  { value: "30", label: "30 Questions", columns: 2 },
  { value: "50", label: "50 Questions", columns: 2 },
  { value: "60", label: "60 Questions", columns: 3 },
  { value: "100", label: "100 Questions", columns: 4 },
];

interface OmrExamScannerProps {
  /** Ordered question IDs from the exam, used to map scanned Q1→questions[0].id etc. */
  questionIds: string[];
  /** Current answers state */
  answers: Record<string, string>;
  /** Callback to update answers (auto-fill from OMR scan) */
  onFillAnswers: (filledAnswers: Record<string, string>) => void;
}

interface OmrResult {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string;
  explanation: string;
}

interface BubbleData {
  q: number;
  opt: string;
  x: number;
  y: number;
}

interface ApiData {
  image_width: number;
  image_height: number;
  radius: number;
  results: OmrResult[];
  bubble_map: BubbleData[];
}

type ScannerStep = "upload" | "crop" | "scanning" | "results";

export const OmrExamScanner = ({ questionIds, answers, onFillAnswers }: OmrExamScannerProps) => {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [maxQuestions, setMaxQuestions] = useState(() => {
    // Auto-detect from question count
    const count = questionIds.length;
    const closest = QUESTION_OPTIONS.reduce((prev, curr) =>
      Math.abs(parseInt(curr.value) - count) < Math.abs(parseInt(prev.value) - count) ? curr : prev
    );
    return closest.value;
  });
  const [step, setStep] = useState<ScannerStep>("upload");

  // Image & crop
  const [rawImage, setRawImage] = useState<string | null>(null);
  const cropperRef = useRef<ReactCropperElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Scanning
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Results
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [scannedAnswers, setScannedAnswers] = useState<Record<string, string>>({});
  const [historyArray, setHistoryArray] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Canvas for bubble visualization
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);

  const selectedOption = QUESTION_OPTIONS.find(o => o.value === maxQuestions);

  // Handle file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setStep("crop");
      setScanError(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Crop and proceed to scan
  const handleCrop = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    cropper.getCroppedCanvas().toBlob(
      (blob) => { if (blob) handleScan(blob); },
      "image/jpeg", 0.9
    );
  };

  // Skip crop - use full image
  const handleSkipCrop = () => {
    if (!rawImage) return;
    fetch(rawImage).then(res => res.blob()).then(blob => handleScan(blob));
  };

  // Send to API
  const handleScan = async (imageBlob: Blob) => {
    setStep("scanning");
    setIsScanning(true);
    setScanError(null);

    try {
      const formData = new FormData();
      formData.append("file", imageBlob, "omr.jpg");
      formData.append("max_questions", maxQuestions);

      const response = await fetch(`${OMR_API_URL}/api/v1/scan-omr`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Decode cipher_matrix
      const decodedStr = atob(data.cipher_matrix);
      const tensorNodes = JSON.parse(decodedStr);
      const spinToOptions: Record<number, string> = { 0: "A", 1: "B", 2: "C", 3: "D" };

      const decodedBubbleMap: BubbleData[] = tensorNodes.map(
        (node: { n_idx: number; spin_state: number; alpha_v: number; beta_v: number }) => ({
          q: node.n_idx,
          opt: spinToOptions[node.spin_state],
          x: (node.alpha_v - 42.0) / 3.14159,
          y: (node.beta_v + 15.0) / 2.71828,
        })
      );

      const newApiData: ApiData = {
        image_width: data.image_width,
        image_height: data.image_height,
        radius: data.radius,
        results: data.extracted_nodes,
        bubble_map: decodedBubbleMap,
      };

      setApiData(newApiData);

      // Map scanned results to question IDs
      const mapped: Record<string, string> = {};
      data.extracted_nodes.forEach((r: OmrResult) => {
        const qNum = parseInt(r.question);
        if (qNum <= questionIds.length && r.correct_answer) {
          // Take only the first answer (single choice)
          const firstAnswer = r.correct_answer.split(", ")[0];
          if (firstAnswer && ["A", "B", "C", "D"].includes(firstAnswer)) {
            mapped[questionIds[qNum - 1]] = firstAnswer;
          }
        }
      });

      setScannedAnswers(mapped);
      setHistoryArray([JSON.stringify(mapped)]);
      setHistoryIndex(0);

      // Load image for canvas — use state so React re-renders when loaded
      const img = new Image();
      img.onload = () => { setBaseImage(img); };
      img.src = URL.createObjectURL(imageBlob);

      setStep("results");
      const filledCount = Object.keys(mapped).length;
      toast({ title: "Scan Complete", description: `Detected answers for ${filledCount}/${questionIds.length} questions.` });
    } catch (err) {
      console.error("OMR scan error:", err);
      const msg = err instanceof Error ? err.message : "Could not connect to OMR server.";
      setScanError(msg);
      setStep("upload");
      toast({ title: "Scan Failed", description: msg, variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  // Draw canvas with bubble overlays
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImage || !apiData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = apiData.image_width;
    canvas.height = apiData.image_height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

    // Draw filled bubbles
    ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
    apiData.results.forEach((qData) => {
      if (qData.correct_answer === "") return;
      const selectedOptions = qData.correct_answer.split(", ");
      const qNum = parseInt(qData.question);

      selectedOptions.forEach((opt) => {
        const bubble = apiData.bubble_map.find(b => b.q === qNum && b.opt === opt);
        if (bubble) {
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, apiData.radius - 1, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    });
  }, [apiData, baseImage]);

  // Re-draw whenever image or data changes
  useEffect(() => {
    if (step === "results" && baseImage && apiData) {
      drawCanvas();
    }
  }, [step, baseImage, apiData, drawCanvas]);

  // Handle canvas click to toggle bubbles
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!apiData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    const clickTolerance = apiData.radius + 10;

    let clickedBubble: BubbleData | null = null;
    for (const b of apiData.bubble_map) {
      if (Math.sqrt(Math.pow(b.x - clickX, 2) + Math.pow(b.y - clickY, 2)) <= clickTolerance) {
        clickedBubble = b;
        break;
      }
    }

    if (clickedBubble) {
      const newResults = [...apiData.results];
      const resultItem = newResults.find(r => parseInt(r.question) === clickedBubble!.q);
      if (!resultItem) return;

      let currentAnsArray = resultItem.correct_answer.split(", ").filter(a => a !== "");

      if (currentAnsArray.includes(clickedBubble.opt)) {
        currentAnsArray = currentAnsArray.filter(a => a !== clickedBubble!.opt);
      } else {
        // For exam answers, only allow single selection, so replace
        currentAnsArray = [clickedBubble.opt];
      }

      resultItem.correct_answer = currentAnsArray.sort().join(", ");

      // Rebuild scanned answers mapping
      const mapped: Record<string, string> = {};
      newResults.forEach((r) => {
        const qNum = parseInt(r.question);
        if (qNum <= questionIds.length && r.correct_answer) {
          const firstAnswer = r.correct_answer.split(", ")[0];
          if (firstAnswer && ["A", "B", "C", "D"].includes(firstAnswer)) {
            mapped[questionIds[qNum - 1]] = firstAnswer;
          }
        }
      });

      const newHistory = historyArray.slice(0, historyIndex + 1);
      newHistory.push(JSON.stringify(mapped));

      setApiData({ ...apiData, results: newResults });
      setScannedAnswers(mapped);
      setHistoryArray(newHistory);
      setHistoryIndex(newHistory.length - 1);
      drawCanvas();
    }
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setScannedAnswers(JSON.parse(historyArray[newIdx]));
      setHistoryIndex(newIdx);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyArray.length - 1) {
      const newIdx = historyIndex + 1;
      setScannedAnswers(JSON.parse(historyArray[newIdx]));
      setHistoryIndex(newIdx);
    }
  };

  // Apply scanned answers to the exam
  const handleApply = () => {
    // Check if any existing answers would be overwritten
    const conflicts = Object.keys(scannedAnswers).filter(qId => answers[qId] && answers[qId] !== scannedAnswers[qId]);

    if (conflicts.length > 0) {
      if (!confirm(`${conflicts.length} answers will be overwritten. Continue?`)) return;
    }

    onFillAnswers(scannedAnswers);
    toast({
      title: "✅ Answers Applied!",
      description: `${Object.keys(scannedAnswers).length} answers auto-filled from OMR scan.`,
    });
    setIsExpanded(false);
  };

  // Reset
  const handleReset = () => {
    setRawImage(null);
    setApiData(null);
    setBaseImage(null);
    setScannedAnswers({});
    setHistoryArray([]);
    setHistoryIndex(-1);
    setScanError(null);
    setStep("upload");
  };

  // Collapsed view
  if (!isExpanded) {
    return (
      <Card
        className="border border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-900/10 cursor-pointer hover:border-violet-400 transition-all"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <ScanLine className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">📷 OMR Scanner</h3>
              <p className="text-xs text-muted-foreground">Scan OMR sheet to auto-fill your answers</p>
            </div>
          </div>
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-violet-300 dark:border-violet-700/50 bg-card shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-900/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <ScanLine className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm">📷 OMR Scanner</h3>
            <p className="text-xs text-muted-foreground">Upload or capture your filled OMR sheet</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)} className="rounded-full h-8 w-8">
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Warning */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
            <p className="font-semibold">Tips for best results:</p>
            <p>• Good lighting, no shadows • Flat sheet, fully visible • Clear, focused photo</p>
          </div>
        </div>

        {/* Question count selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-xs font-medium">Questions on OMR:</label>
          <Select value={maxQuestions} onValueChange={setMaxQuestions}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label} ({parseInt(opt.value) * 4} bubbles)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            {selectedOption?.columns} column{(selectedOption?.columns ?? 0) > 1 ? "s" : ""} • 25 Q/col
          </span>
        </div>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-border/60 rounded-2xl p-6 text-center hover:border-violet-300 transition-colors">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-violet-400" />
                <p className="font-medium text-sm">Upload OMR Sheet</p>
                <p className="text-xs text-muted-foreground">JPG, PNG — Clear photo</p>
                <div className="flex gap-2 mt-2">
                  <Button variant="default" size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-full px-4 text-xs h-8">
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> Choose File
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} className="rounded-full px-4 text-xs h-8">
                    <Camera className="h-3.5 w-3.5 mr-1.5" /> Camera
                  </Button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
            </div>
            {scanError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 text-xs text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div><p className="font-semibold">Scan Failed</p><p>{scanError}</p></div>
              </div>
            )}
          </div>
        )}

        {/* Step: Crop */}
        {step === "crop" && rawImage && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden border border-border/60 bg-black/5">
              <Cropper
                ref={cropperRef}
                src={rawImage}
                style={{ height: 350, width: "100%" }}
                guides={true}
                viewMode={1}
                responsive={true}
                autoCropArea={0.9}
                background={false}
              />
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => { setRawImage(null); setStep("upload"); }} className="text-xs">
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSkipCrop} className="rounded-full text-xs">Skip Crop</Button>
                <Button size="sm" onClick={handleCrop} className="rounded-full px-5 text-xs">
                  <Crop className="h-3.5 w-3.5 mr-1.5" /> Crop & Scan
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Scanning */}
        {step === "scanning" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-sm">Scanning OMR Sheet...</p>
              <p className="text-xs text-muted-foreground mt-1">Detecting bubbles and reading answers</p>
            </div>
          </div>
        )}

        {/* Step: Results */}
        {step === "results" && apiData && (
          <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyIndex <= 0} className="rounded-full text-xs h-7">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Undo
              </Button>
              <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyIndex >= historyArray.length - 1} className="rounded-full text-xs h-7">
                <RotateCw className="h-3.5 w-3.5 mr-1" /> Redo
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={handleReset} className="rounded-full text-xs h-7">
                <X className="h-3.5 w-3.5 mr-1" /> Re-scan
              </Button>
              <Button size="sm" onClick={handleApply} className="rounded-full px-4 text-xs h-7 bg-green-600 hover:bg-green-700">
                <Check className="h-3.5 w-3.5 mr-1" /> Apply {Object.keys(scannedAnswers).length} Answers
              </Button>
            </div>

            {/* Canvas + Answers Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Canvas */}
              <div className="rounded-xl overflow-hidden border border-border/60 bg-black/5">
                <div className="overflow-auto max-h-[400px]">
                  <canvas ref={canvasRef} onClick={handleCanvasClick} className="cursor-crosshair w-full" style={{ maxWidth: "100%" }} />
                </div>
                <div className="p-1.5 bg-muted/30 text-[10px] text-muted-foreground text-center">
                  Click bubbles to toggle answers
                </div>
              </div>

              {/* Answers Grid */}
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="p-2.5 bg-muted/30 border-b border-border/50 flex items-center justify-between">
                  <span className="text-xs font-semibold">Detected Answers</span>
                  <span className="text-[10px] text-muted-foreground">
                    {Object.keys(scannedAnswers).length}/{questionIds.length} detected
                  </span>
                </div>
                <div className="max-h-[360px] overflow-y-auto p-2.5">
                  <div className="grid grid-cols-5 gap-1.5">
                    {questionIds.map((qId, idx) => {
                      const answer = scannedAnswers[qId];
                      return (
                        <div
                          key={qId}
                          className={`flex flex-col items-center p-1.5 rounded-lg text-xs border transition-colors ${
                            answer
                              ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30"
                              : "bg-muted/30 border-border/30"
                          }`}
                        >
                          <span className="font-bold text-[9px] text-muted-foreground">Q{idx + 1}</span>
                          <span className={`font-bold ${answer ? "text-green-700 dark:text-green-400" : "text-muted-foreground/50"}`}>
                            {answer || "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
