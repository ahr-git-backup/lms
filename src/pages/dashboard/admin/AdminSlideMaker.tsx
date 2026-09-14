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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { QuestionBankSelector } from "@/components/admin/QuestionBankSelector";
import { ColorWheelPicker } from "@/components/admin/ColorWheelPicker";
import { QuestionData } from "@/types/exam";
import { Upload, BookOpen, X, Download, Loader2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2, ImagePlus, Eye, Save } from "lucide-react";

interface SlideQuestion {
  id: string;
  question: string;
  options: { [key: string]: string };
  correct_answer: string;
}

/** One slot inside the header or footer strip (left / center / right).
    Each slot independently carries text and/or an image, each with its
    own size and x/y position controls. */
interface BarSlot {
  text: string;
  imageUrl: string;
  fontSize: number;
  fontColor: string;
  fontBold: boolean;
  fontItalic: boolean;
  fontUnderline: boolean;
  highlightColor: string;
  highlightEnabled: boolean;
  textOffsetX: number;
  textOffsetY: number;
  imageHeight: number;
  imageOffsetX: number;
  imageOffsetY: number;
}

const DEFAULT_SLOT = (): BarSlot => ({
  text: "",
  imageUrl: "",
  fontSize: 18,
  fontColor: "#ffffff",
  fontBold: false,
  fontItalic: false,
  fontUnderline: false,
  highlightColor: "#facc15",
  highlightEnabled: false,
  textOffsetX: 0,
  textOffsetY: 0,
  imageHeight: 40,
  imageOffsetX: 0,
  imageOffsetY: 0,
});

interface SlideSettings {
  bgColor: string;
  fontColor: string;
  questionFontSize: number;
  optionFontSize: number;
  questionBoxWidth: number;
  questionBoxHeight: number;
  optionBoxWidth: number;
  optionBoxHeight: number;
  optionBgColor: string;
  optionBorderColor: string;
  optionsLayout: "column" | "grid2x2";
  optionLetterBgColor: string;
  optionLetterTextColor: string;
  optionLetterBorderColor: string;
  optionLetterBorderWidth: number;
  optionLetterFontSize: number;
  fontFamily: string;

  headerLeft: BarSlot;
  headerCenter: BarSlot;
  headerRight: BarSlot;
  headerSeparator: boolean;
  headerSeparatorColor: string;
  headerBgColor: string;
  headerBgEnabled: boolean;
  headerBgFullWidth: boolean;
  headerBgRounded: boolean;

  footerLeft: BarSlot;
  footerCenter: BarSlot;
  footerRight: BarSlot;
  footerSeparator: boolean;
  footerSeparatorColor: string;
  footerBgColor: string;
  footerBgEnabled: boolean;
  footerBgFullWidth: boolean;
  footerBgRounded: boolean;

  questionBgColor: string;
  questionBorderColor: string;
  questionBoxEnabled: boolean;
}

const DEFAULT_SETTINGS: SlideSettings = {
  bgColor: "#0f172a",
  fontColor: "#ffffff",
  questionFontSize: 28,
  optionFontSize: 20,
  questionBoxWidth: 900,
  questionBoxHeight: 100,
  optionBoxWidth: 660,
  optionBoxHeight: 80,
  optionBgColor: "#1e293b",
  optionBorderColor: "#38bdf8",
  optionsLayout: "column",
  optionLetterBgColor: "#38bdf8",
  optionLetterTextColor: "#1e293b",
  optionLetterBorderColor: "#38bdf8",
  optionLetterBorderWidth: 0,
  optionLetterFontSize: 20,
  fontFamily: "'Hind Siliguri', sans-serif",

  headerLeft: DEFAULT_SLOT(),
  headerCenter: DEFAULT_SLOT(),
  headerRight: DEFAULT_SLOT(),
  headerSeparator: false,
  headerSeparatorColor: "#38bdf8",
  headerBgColor: "#1e293b",
  headerBgEnabled: false,
  headerBgFullWidth: false,
  headerBgRounded: true,

  footerLeft: DEFAULT_SLOT(),
  footerCenter: DEFAULT_SLOT(),
  footerRight: DEFAULT_SLOT(),
  footerSeparator: false,
  footerSeparatorColor: "#38bdf8",
  footerBgColor: "#1e293b",
  footerBgEnabled: false,
  footerBgFullWidth: false,
  footerBgRounded: true,

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

/** Renders one header/footer slot: image + text, each independently offset
    by its own x/y so they can be nudged apart or overlapped freely. */
const BarSlotView = ({ slot, align }: { slot: BarSlot; align: "flex-start" | "center" | "flex-end" }) => {
  if (!slot.text && !slot.imageUrl) return <div />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "flex-start" ? "flex-start" : align === "flex-end" ? "flex-end" : "center", gap: 4 }}>
      {slot.imageUrl && (
        <img
          src={slot.imageUrl}
          style={{ height: slot.imageHeight, width: "auto", transform: `translate(${slot.imageOffsetX}px, ${slot.imageOffsetY}px)` }}
        />
      )}
      {slot.text && (
        <div
          style={{
            fontSize: slot.fontSize,
            color: slot.fontColor,
            fontWeight: slot.fontBold ? 700 : align === "center" ? 700 : 400,
            fontStyle: slot.fontItalic ? "italic" : undefined,
            textDecoration: slot.fontUnderline ? "underline" : undefined,
            backgroundColor: slot.highlightEnabled ? slot.highlightColor : undefined,
            padding: slot.highlightEnabled ? "2px 8px" : undefined,
            borderRadius: slot.highlightEnabled ? 6 : undefined,
            transform: `translate(${slot.textOffsetX}px, ${slot.textOffsetY}px)`,
            whiteSpace: "nowrap",
          }}
        >
          {slot.text}
        </div>
      )}
    </div>
  );
};

const SlideVisual = ({
  question,
  settings,
  editable,
  onEditField,
  onSelectionChange,
}: {
  question: SlideQuestion;
  settings: SlideSettings;
  editable?: boolean;
  onEditField?: (field: "question" | "A" | "B" | "C" | "D", value: string) => void;
  onSelectionChange?: (field: "question" | "A" | "B" | "C" | "D" | null) => void;
}) => {
  const makeEditable = (field: "question" | "A" | "B" | "C" | "D", value: string) =>
    editable
      ? {
          contentEditable: true,
          suppressContentEditableWarning: true,
          onBlur: (e: React.FocusEvent<HTMLElement>) => {
            const next = e.currentTarget.innerHTML ?? "";
            if (next !== value) onEditField?.(field, next);
          },
          onFocus: () => onSelectionChange?.(field),
          onMouseUp: () => onSelectionChange?.(field),
          onKeyUp: () => onSelectionChange?.(field),
        }
      : {};

  const hasFooterContent =
    settings.footerLeft.text || settings.footerLeft.imageUrl ||
    settings.footerCenter.text || settings.footerCenter.imageUrl ||
    settings.footerRight.text || settings.footerRight.imageUrl ||
    settings.footerSeparator || settings.footerBgEnabled;

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
      {/* Header background — a separate layer so it can span the full
          slide width (edge to edge) independent of the content div, which
          stays inset at left/right:40 like the rest of the slide. */}
      {settings.headerBgEnabled && (
        <div
          style={{
            position: "absolute",
            left: settings.headerBgFullWidth ? 0 : 40,
            right: settings.headerBgFullWidth ? 0 : 40,
            top: 20,
            height: 70,
            backgroundColor: settings.headerBgColor,
            borderRadius: settings.headerBgRounded ? 12 : 0,
            zIndex: 1,
          }}
        />
      )}

      {/* Header — always anchored to the top of the slide; content within
          each slot (left/center/right) can only be nudged horizontally via
          textOffsetX/imageOffsetX, not moved to another vertical position.
          Fixed height so growing font/image size never pushes the
          separator line or the rest of the layout. */}
      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: 20,
          height: 70,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 20px",
          overflow: "hidden",
          boxSizing: "border-box",
          zIndex: 2,
        }}
      >
        <BarSlotView slot={settings.headerLeft} align="flex-start" />
        <BarSlotView slot={settings.headerCenter} align="center" />
        <BarSlotView slot={settings.headerRight} align="flex-end" />
      </div>

      {/* Header separator — full slide width, at a fixed y position right
          below the fixed-height header, so it never shifts even if header
          text/image size changes. */}
      {settings.headerSeparator && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 20 + 70,
            height: 2,
            backgroundColor: settings.headerSeparatorColor,
            zIndex: 2,
          }}
        />
      )}

      <div style={{ minHeight: 70 }} />

      {/* Question — always centered on the page. Box size is fixed/manual
          (questionBoxWidth/Height); increasing font size does not grow the
          box — text just fills more of the fixed box, clipped if it would
          overflow, so the box stays a stable, independently-sizeable shape. */}
      <div
        {...makeEditable("question", question.question)}
        style={{
          fontSize: settings.questionFontSize,
          fontFamily: settings.fontFamily,
          fontWeight: 700,
          marginTop: 20,
          marginBottom: 20,
          width: settings.questionBoxWidth,
          maxWidth: "100%",
          height: settings.questionBoxEnabled ? settings.questionBoxHeight : undefined,
          marginLeft: "auto",
          marginRight: "auto",
          lineHeight: 1.4,
          textAlign: "center",
          overflow: settings.questionBoxEnabled ? "hidden" : "visible",
          display: settings.questionBoxEnabled ? "flex" : "block",
          alignItems: "center",
          justifyContent: "center",
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
        dangerouslySetInnerHTML={{ __html: question.question }}
      />

      {/* Options — box size is fixed/manual (optionBoxWidth/Height);
          increasing option font size fills more of the fixed box instead
          of growing it, clipped if the text would overflow.
          Layout switches between a single right-aligned column and a
          2x2 grid depending on settings.optionsLayout. */}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", paddingBottom: hasFooterContent ? 90 : 70 }}>
        <div
          style={
            settings.optionsLayout === "grid2x2"
              ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, width: "90%" }
              : { display: "flex", flexDirection: "column", gap: 20, width: "55%", alignItems: "flex-end" }
          }
        >
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
                width: settings.optionsLayout === "grid2x2" ? "100%" : Math.min(settings.optionBoxWidth, 0.98 * SLIDE_W),
                maxWidth: "100%",
                height: settings.optionBoxHeight,
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: settings.optionLetterFontSize * 1.7,
                  height: settings.optionLetterFontSize * 1.7,
                  fontSize: settings.optionLetterFontSize,
                  borderRadius: "50%",
                  backgroundColor: settings.optionLetterBgColor,
                  color: settings.optionLetterTextColor,
                  border: settings.optionLetterBorderWidth > 0 ? `${settings.optionLetterBorderWidth}px solid ${settings.optionLetterBorderColor}` : undefined,
                  boxSizing: "border-box",
                  flexShrink: 0,
                }}
              >
                {key}
              </span>
              <span
                {...makeEditable(key as "A" | "B" | "C" | "D", val)}
                style={{ flex: 1, ...(editable ? { outline: "none", cursor: "text" } : {}) }}
                dangerouslySetInnerHTML={{ __html: val }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Footer — fixed height, so growing content never shifts the
          separator line. Separator itself is a full-width line at a fixed
          y position, independent of footer content size. Background is a
          separate layer so it can span the full slide width independent
          of the content div. */}
      {hasFooterContent && (
        <>
          {settings.footerBgEnabled && (
            <div
              style={{
                position: "absolute",
                left: settings.footerBgFullWidth ? 0 : 40,
                right: settings.footerBgFullWidth ? 0 : 40,
                bottom: 20,
                height: 50,
                backgroundColor: settings.footerBgColor,
                borderRadius: settings.footerBgRounded ? 12 : 0,
                zIndex: 1,
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              left: 40,
              right: 40,
              bottom: 20,
              height: 50,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 20px",
              overflow: "hidden",
              boxSizing: "border-box",
              zIndex: 2,
            }}
          >
            <BarSlotView slot={settings.footerLeft} align="flex-start" />
            <BarSlotView slot={settings.footerCenter} align="center" />
            <BarSlotView slot={settings.footerRight} align="flex-end" />
          </div>
          {settings.footerSeparator && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 20 + 50,
                height: 2,
                backgroundColor: settings.footerSeparatorColor,
                zIndex: 2,
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

/** Floating rich-text toolbar shown above the editable slide grid. Acts on
    whatever text is currently selected inside any contentEditable question/
    option field — bold, italic, underline, text color, highlight color.
    Uses document.execCommand, which still works for contentEditable in the
    Chromium-based webviews this admin panel targets. Selection is restored
    before each command so clicking a toolbar button (which would otherwise
    blur/clear the selection) still applies to the text the admin picked. */
const FormatToolbar = () => {
  const savedRange = useRef<Range | null>(null);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const run = (command: string, value?: string) => {
    restoreSelection();
    document.execCommand(command, false, value);
  };

  // Track selection continuously so toolbar buttons always have the latest
  // range to restore, even though clicking a button blurs the editable field.
  useEffect(() => {
    const handler = () => saveSelection();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  const TEXT_COLORS = ["#ffffff", "#000000", "#ef4444", "#eab308", "#22c55e", "#3b82f6", "#ec4899"];
  const HIGHLIGHT_COLORS = ["#ffff00", "#00ffff", "#ff9900", "#22c55e", "#ec4899", "transparent"];

  return (
    <div className="flex items-center gap-1.5 flex-wrap bg-muted/40 rounded-lg p-1.5">
      <Button type="button" size="icon" variant="outline" className="h-8 w-8 font-bold" onMouseDown={(e) => e.preventDefault()} onClick={() => run("bold")}>
        B
      </Button>
      <Button type="button" size="icon" variant="outline" className="h-8 w-8 italic" onMouseDown={(e) => e.preventDefault()} onClick={() => run("italic")}>
        I
      </Button>
      <Button type="button" size="icon" variant="outline" className="h-8 w-8 underline" onMouseDown={(e) => e.preventDefault()} onClick={() => run("underline")}>
        U
      </Button>

      <div className="relative">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setTextColorOpen((v) => !v); setHighlightOpen(false); }}
        >
          A রঙ
        </Button>
        {textColorOpen && (
          <div className="absolute z-10 top-9 left-0 bg-popover border rounded-lg p-2 flex gap-1.5 shadow-md">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="h-6 w-6 rounded-full border-2 border-border"
                style={{ backgroundColor: c }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { run("foreColor", c); setTextColorOpen(false); }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setHighlightOpen((v) => !v); setTextColorOpen(false); }}
        >
          হাইলাইট
        </Button>
        {highlightOpen && (
          <div className="absolute z-10 top-9 left-0 bg-popover border rounded-lg p-2 flex gap-1.5 shadow-md">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="h-6 w-6 rounded-full border-2 border-border"
                style={{ backgroundColor: c === "transparent" ? "#fff" : c, backgroundImage: c === "transparent" ? "linear-gradient(45deg, transparent 45%, red 45%, red 55%, transparent 55%)" : undefined }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { run("hiliteColor", c); setHighlightOpen(false); }}
              />
            ))}
          </div>
        )}
      </div>

      <span className="text-[10px] text-muted-foreground pl-1">টেক্সট সিলেক্ট করে ফরম্যাট প্রয়োগ করুন</span>
    </div>
  );
};

/** A tiny +/- stepper row used for every numeric control below (font size,
    image size, x/y position) so every value is nudgeable without a
    fiddly slider on mobile. */
const Stepper = ({
  label,
  value,
  onChange,
  step = 2,
  suffix = "px",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) => (
  <div className="space-y-1">
    <Label className="text-[10px]">{label} ({value > 0 && suffix === "px" && label.startsWith("X") ? "+" : ""}{value}{suffix})</Label>
    <div className="flex items-center gap-1">
      <Button type="button" size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => onChange(value - step)}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => onChange(value + step)}>
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
);

/** Full control block for one header/footer slot: text, image upload, font
    size + color, text position, image size + position — everything
    independently controllable. */
const BarSlotEditor = ({
  label,
  slot,
  onChange,
  idPrefix,
}: {
  label: string;
  slot: BarSlot;
  onChange: (next: BarSlot) => void;
  idPrefix: string;
}) => {
  const update = (patch: Partial<BarSlot>) => onChange({ ...slot, ...patch });
  return (
    <div className="space-y-2 border rounded-lg p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>

      {/* Text */}
      <Input value={slot.text} onChange={(e) => update({ text: e.target.value })} placeholder="Text (optional)" className="h-8 text-sm" />
      {slot.text && (
        <div className="space-y-2 pl-2 border-l-2">
          <div className="flex items-center gap-2">
            <Label className="text-[10px] shrink-0 w-16">Font Size</Label>
            <Input type="range" min={8} max={200} value={slot.fontSize} onChange={(e) => update({ fontSize: Number(e.target.value) })} className="h-7" />
            <Input
              type="number"
              min={1}
              value={slot.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) || 1 })}
              className="h-7 w-14 text-[10px] px-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] shrink-0 w-16">Color</Label>
            <ColorWheelPicker color={slot.fontColor} onChange={(hex) => update({ fontColor: hex })} label={`${label} Font Color`} />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => update({ fontBold: !slot.fontBold })}
              className={`h-7 w-7 rounded border text-xs font-bold flex items-center justify-center ${slot.fontBold ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
              aria-label="Bold"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => update({ fontItalic: !slot.fontItalic })}
              className={`h-7 w-7 rounded border text-xs italic flex items-center justify-center ${slot.fontItalic ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
              aria-label="Italic"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => update({ fontUnderline: !slot.fontUnderline })}
              className={`h-7 w-7 rounded border text-xs underline flex items-center justify-center ${slot.fontUnderline ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
              aria-label="Underline"
            >
              U
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] shrink-0 w-16">হাইলাইট</Label>
            <button
              type="button"
              onClick={() => update({ highlightEnabled: !slot.highlightEnabled })}
              className={`h-5 w-9 rounded-full transition-colors relative shrink-0 ${slot.highlightEnabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${slot.highlightEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            {slot.highlightEnabled && (
              <ColorWheelPicker color={slot.highlightColor} onChange={(hex) => update({ highlightColor: hex })} label={`${label} Highlight Color`} />
            )}
          </div>
          {/* Only horizontal movement — header/footer content stays on its
              own line, no vertical nudging. */}
          <Stepper label="Text X" value={slot.textOffsetX} onChange={(v) => update({ textOffsetX: v })} />
        </div>
      )}

      {/* Image */}
      <div className="flex items-center gap-1.5 pt-1">
        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => document.getElementById(idPrefix)?.click()}>
          <ImagePlus className="h-3.5 w-3.5 mr-1" /> Image
        </Button>
        <input
          id={idPrefix}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => update({ imageUrl: ev.target?.result as string });
            reader.readAsDataURL(file);
            e.target.value = "";
          }}
        />
        {slot.imageUrl && (
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={() => update({ imageUrl: "" })}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {slot.imageUrl && (
        <div className="space-y-2 pl-2 border-l-2">
          <div className="flex items-center gap-2">
            <Label className="text-[10px] shrink-0 w-16">Img Size</Label>
            <Input type="range" min={16} max={100} value={slot.imageHeight} onChange={(e) => update({ imageHeight: Number(e.target.value) })} className="h-7" />
            <span className="text-[10px] w-8 text-right">{slot.imageHeight}px</span>
          </div>
          <Stepper label="Img X" value={slot.imageOffsetX} onChange={(v) => update({ imageOffsetX: v })} />
        </div>
      )}
    </div>
  );
};

const FORMATS_STORAGE_KEY = "atlas-slide-maker-formats";

interface SavedFormat {
  id: string;
  name: string;
  settings: SlideSettings;
  savedAt: number;
}

const loadSavedFormats = (): SavedFormat[] => {
  try {
    const raw = localStorage.getItem(FORMATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const AdminSlideMaker = () => {
  const { toast } = useToast();
  useEffect(() => {
    document.title = "Slide Maker – Atlas";
  }, []);

  const [questions, setQuestions] = useState<SlideQuestion[]>([]);
  const [settings, setSettings] = useState<SlideSettings>(DEFAULT_SETTINGS);
  const [savedFormats, setSavedFormats] = useState<SavedFormat[]>(() => loadSavedFormats());
  const [isSaveFormatOpen, setIsSaveFormatOpen] = useState(false);
  const [newFormatName, setNewFormatName] = useState("");
  const [isQbOpen, setIsQbOpen] = useState(false);
  const [isPreviewAllOpen, setIsPreviewAllOpen] = useState(false);
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
        await new Promise((r) => setTimeout(r, 60));
        if (!slideRef.current) continue;
        const canvas = await html2canvas(slideRef.current, {
          width: SLIDE_W,
          height: SLIDE_H,
          scale: 2,
          useCORS: true,
          onclone: (clonedDoc) => {
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

  const persistFormats = (next: SavedFormat[]) => {
    setSavedFormats(next);
    try {
      localStorage.setItem(FORMATS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      toast({ title: "ফরম্যাট সেভ করতে সমস্যা হয়েছে", variant: "destructive" });
    }
  };

  const saveCurrentFormat = () => {
    const name = newFormatName.trim();
    if (!name) {
      toast({ title: "ফরম্যাটের নাম দিন", variant: "destructive" });
      return;
    }
    const newFormat: SavedFormat = {
      id: `fmt-${Date.now()}`,
      name,
      settings,
      savedAt: Date.now(),
    };
    persistFormats([newFormat, ...savedFormats]);
    setNewFormatName("");
    setIsSaveFormatOpen(false);
    toast({ title: "ফরম্যাট সেভ হয়েছে", description: name });
  };

  const applyFormat = (fmt: SavedFormat) => {
    setSettings(fmt.settings);
    toast({ title: "ফরম্যাট প্রয়োগ হয়েছে", description: fmt.name });
  };

  const deleteFormat = (id: string) => {
    persistFormats(savedFormats.filter((f) => f.id !== id));
  };

  const activeQuestion = questions.length > 0 ? questions[activeIndex] : SAMPLE_QUESTION;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Slide Maker</h1>
          <p className="text-sm text-muted-foreground">আগে ফরম্যাট ঠিক করুন, পরে প্রশ্ন যোগ করে PDF বানান।</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setIsSaveFormatOpen(true)}>
          <Save className="h-4 w-4 mr-1.5" /> ফরম্যাট সেভ করুন
        </Button>
      </header>

      {/* Saved formats — pick one to reuse its full look (colors, fonts,
          header/footer, box sizes) for the current slide set. */}
      {savedFormats.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">সেভড ফরম্যাট</p>
          <div className="flex flex-wrap gap-2">
            {savedFormats.map((fmt) => (
              <div key={fmt.id} className="flex items-center gap-1 border rounded-full pl-3 pr-1 py-1 bg-muted/40">
                <button
                  type="button"
                  onClick={() => applyFormat(fmt)}
                  className="text-xs font-medium hover:text-primary"
                >
                  {fmt.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteFormat(fmt.id)}
                  className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Delete ${fmt.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview label + slide navigation — scrolls away normally (not
          sticky), so it never sits above the image once scrolled past. */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 pt-2">
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
      </div>

      {/* Live preview — only the image itself is sticky, pinned flush to
          the very top of the viewport (top-0, no label/text above it). */}
      <div className="sticky top-0 z-50 bg-background -mx-4 px-4 sm:mx-0 sm:px-0 sm:bg-transparent">
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

      {/* Settings panel — segmented into collapsible sections, one per
          slide area, so everything is grouped with its own segment
          instead of one long flat grid. */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          <Accordion type="multiple" defaultValue={["general", "header", "question", "options"]} className="w-full">

            {/* General / slide-wide */}
            <AccordionItem value="general">
              <AccordionTrigger className="text-sm font-semibold py-3">সাধারণ (Background &amp; Font)</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Slide Background</Label>
                    <ColorWheelPicker color={settings.bgColor} onChange={(hex) => setSettings((p) => ({ ...p, bgColor: hex }))} label="Background Color" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Font Color</Label>
                    <ColorWheelPicker color={settings.fontColor} onChange={(hex) => setSettings((p) => ({ ...p, fontColor: hex }))} label="Font Color" />
                  </div>
                  <div className="space-y-1 col-span-2">
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
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Header */}
            <AccordionItem value="header">
              <AccordionTrigger className="text-sm font-semibold py-3">Header (Left / Center / Right)</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Separator Line (নিচে, Optional)</Label>
                      <button
                        type="button"
                        onClick={() => setSettings((p) => ({ ...p, headerSeparator: !p.headerSeparator }))}
                        className={`h-5 w-9 rounded-full transition-colors relative ${settings.headerSeparator ? "bg-primary" : "bg-muted"}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.headerSeparator ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    {settings.headerSeparator && (
                      <ColorWheelPicker color={settings.headerSeparatorColor} onChange={(hex) => setSettings((p) => ({ ...p, headerSeparatorColor: hex }))} label="Header Separator Color" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Header Background (Optional)</Label>
                      <button
                        type="button"
                        onClick={() => setSettings((p) => ({ ...p, headerBgEnabled: !p.headerBgEnabled }))}
                        className={`h-5 w-9 rounded-full transition-colors relative ${settings.headerBgEnabled ? "bg-primary" : "bg-muted"}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.headerBgEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    {settings.headerBgEnabled && (
                      <div className="space-y-2">
                        <ColorWheelPicker color={settings.headerBgColor} onChange={(hex) => setSettings((p) => ({ ...p, headerBgColor: hex }))} label="Header Background Color" />
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground">ফুল উইথ (Full Width)</Label>
                          <button
                            type="button"
                            onClick={() => setSettings((p) => ({ ...p, headerBgFullWidth: !p.headerBgFullWidth }))}
                            className={`h-5 w-9 rounded-full transition-colors relative ${settings.headerBgFullWidth ? "bg-primary" : "bg-muted"}`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.headerBgFullWidth ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground">গোল কোণা (Rounded)</Label>
                          <button
                            type="button"
                            onClick={() => setSettings((p) => ({ ...p, headerBgRounded: !p.headerBgRounded }))}
                            className={`h-5 w-9 rounded-full transition-colors relative ${settings.headerBgRounded ? "bg-primary" : "bg-muted"}`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.headerBgRounded ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <BarSlotEditor label="Left" slot={settings.headerLeft} onChange={(v) => setSettings((p) => ({ ...p, headerLeft: v }))} idPrefix="header-left-logo" />
                  <BarSlotEditor label="Center" slot={settings.headerCenter} onChange={(v) => setSettings((p) => ({ ...p, headerCenter: v }))} idPrefix="header-center-logo" />
                  <BarSlotEditor label="Right" slot={settings.headerRight} onChange={(v) => setSettings((p) => ({ ...p, headerRight: v }))} idPrefix="header-right-logo" />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Footer */}
            <AccordionItem value="footer">
              <AccordionTrigger className="text-sm font-semibold py-3">Footer (Left / Center / Right)</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 max-w-xl">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Separator Line (উপরে, Optional)</Label>
                      <button
                        type="button"
                        onClick={() => setSettings((p) => ({ ...p, footerSeparator: !p.footerSeparator }))}
                        className={`h-5 w-9 rounded-full transition-colors relative ${settings.footerSeparator ? "bg-primary" : "bg-muted"}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.footerSeparator ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    {settings.footerSeparator && (
                      <ColorWheelPicker color={settings.footerSeparatorColor} onChange={(hex) => setSettings((p) => ({ ...p, footerSeparatorColor: hex }))} label="Footer Separator Color" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Footer Background (Optional)</Label>
                      <button
                        type="button"
                        onClick={() => setSettings((p) => ({ ...p, footerBgEnabled: !p.footerBgEnabled }))}
                        className={`h-5 w-9 rounded-full transition-colors relative ${settings.footerBgEnabled ? "bg-primary" : "bg-muted"}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.footerBgEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    {settings.footerBgEnabled && (
                      <div className="space-y-2">
                        <ColorWheelPicker color={settings.footerBgColor} onChange={(hex) => setSettings((p) => ({ ...p, footerBgColor: hex }))} label="Footer Background Color" />
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground">ফুল উইথ (Full Width)</Label>
                          <button
                            type="button"
                            onClick={() => setSettings((p) => ({ ...p, footerBgFullWidth: !p.footerBgFullWidth }))}
                            className={`h-5 w-9 rounded-full transition-colors relative ${settings.footerBgFullWidth ? "bg-primary" : "bg-muted"}`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.footerBgFullWidth ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground">গোল কোণা (Rounded)</Label>
                          <button
                            type="button"
                            onClick={() => setSettings((p) => ({ ...p, footerBgRounded: !p.footerBgRounded }))}
                            className={`h-5 w-9 rounded-full transition-colors relative ${settings.footerBgRounded ? "bg-primary" : "bg-muted"}`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.footerBgRounded ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <BarSlotEditor label="Left" slot={settings.footerLeft} onChange={(v) => setSettings((p) => ({ ...p, footerLeft: v }))} idPrefix="footer-left-logo" />
                  <BarSlotEditor label="Center" slot={settings.footerCenter} onChange={(v) => setSettings((p) => ({ ...p, footerCenter: v }))} idPrefix="footer-center-logo" />
                  <BarSlotEditor label="Right" slot={settings.footerRight} onChange={(v) => setSettings((p) => ({ ...p, footerRight: v }))} idPrefix="footer-right-logo" />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Question */}
            <AccordionItem value="question">
              <AccordionTrigger className="text-sm font-semibold py-3">প্রশ্ন (Question)</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Question Font Size ({settings.questionFontSize}px)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="range" min={12} max={200} value={settings.questionFontSize} onChange={(e) => setSettings((p) => ({ ...p, questionFontSize: Number(e.target.value) }))} className="h-9 flex-1" />
                      <Input
                        type="number"
                        min={1}
                        value={settings.questionFontSize}
                        onChange={(e) => setSettings((p) => ({ ...p, questionFontSize: Number(e.target.value) || 1 }))}
                        className="h-9 w-16"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Box Width ({settings.questionBoxWidth}px)</Label>
                    <Input type="range" min={300} max={1200} step={10} value={settings.questionBoxWidth} onChange={(e) => setSettings((p) => ({ ...p, questionBoxWidth: Number(e.target.value) }))} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Box Height ({settings.questionBoxHeight}px)</Label>
                    <Input type="range" min={50} max={400} step={10} value={settings.questionBoxHeight} onChange={(e) => setSettings((p) => ({ ...p, questionBoxHeight: Number(e.target.value) }))} className="h-9" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Options */}
            <AccordionItem value="options">
              <AccordionTrigger className="text-sm font-semibold py-3">অপশন (Options)</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 mb-4">
                  <Label className="text-xs">অপশন লেআউট (Layout)</Label>
                  <Select value={settings.optionsLayout} onValueChange={(v: "column" | "grid2x2") => setSettings((p) => ({ ...p, optionsLayout: v }))}>
                    <SelectTrigger className="h-9 w-full sm:w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="column">১ কলাম (৪টি একের নিচে একটি)</SelectItem>
                      <SelectItem value="grid2x2">২x২ গ্রিড (১ রো-তে ২টি করে)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Option Box Background</Label>
                    <ColorWheelPicker color={settings.optionBgColor} onChange={(hex) => setSettings((p) => ({ ...p, optionBgColor: hex }))} label="Option Box Background" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Option Border (Neon)</Label>
                    <ColorWheelPicker color={settings.optionBorderColor} onChange={(hex) => setSettings((p) => ({ ...p, optionBorderColor: hex }))} label="Option Border" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Option Font Size ({settings.optionFontSize}px)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="range" min={10} max={200} value={settings.optionFontSize} onChange={(e) => setSettings((p) => ({ ...p, optionFontSize: Number(e.target.value) }))} className="h-9 flex-1" />
                      <Input
                        type="number"
                        min={1}
                        value={settings.optionFontSize}
                        onChange={(e) => setSettings((p) => ({ ...p, optionFontSize: Number(e.target.value) || 1 }))}
                        className="h-9 w-16"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Box Width ({settings.optionBoxWidth}px)</Label>
                    <Input type="range" min={200} max={1150} step={10} value={settings.optionBoxWidth} onChange={(e) => setSettings((p) => ({ ...p, optionBoxWidth: Number(e.target.value) }))} className="h-9" disabled={settings.optionsLayout === "grid2x2"} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Box Height ({settings.optionBoxHeight}px)</Label>
                    <Input type="range" min={40} max={250} step={5} value={settings.optionBoxHeight} onChange={(e) => setSettings((p) => ({ ...p, optionBoxHeight: Number(e.target.value) }))} className="h-9" />
                  </div>
                </div>

                {/* A/B/C/D letter badge — independently styleable from the
                    option box itself. */}
                <p className="text-xs font-semibold text-muted-foreground mt-4 mb-2">অপশনের অক্ষর (A/B/C/D) স্টাইল</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">অক্ষর ব্যাকগ্রাউন্ড</Label>
                    <ColorWheelPicker color={settings.optionLetterBgColor} onChange={(hex) => setSettings((p) => ({ ...p, optionLetterBgColor: hex }))} label="Option Letter Background" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">অক্ষর রঙ (Text)</Label>
                    <ColorWheelPicker color={settings.optionLetterTextColor} onChange={(hex) => setSettings((p) => ({ ...p, optionLetterTextColor: hex }))} label="Option Letter Text Color" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">অক্ষর বর্ডার রঙ</Label>
                    <ColorWheelPicker color={settings.optionLetterBorderColor} onChange={(hex) => setSettings((p) => ({ ...p, optionLetterBorderColor: hex }))} label="Option Letter Border Color" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">বর্ডার Width ({settings.optionLetterBorderWidth}px)</Label>
                    <Input type="range" min={0} max={10} value={settings.optionLetterBorderWidth} onChange={(e) => setSettings((p) => ({ ...p, optionLetterBorderWidth: Number(e.target.value) }))} className="h-9" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">অক্ষর Font Size ({settings.optionLetterFontSize}px)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="range" min={8} max={100} value={settings.optionLetterFontSize} onChange={(e) => setSettings((p) => ({ ...p, optionLetterFontSize: Number(e.target.value) }))} className="h-9 flex-1" />
                      <Input
                        type="number"
                        min={1}
                        value={settings.optionLetterFontSize}
                        onChange={(e) => setSettings((p) => ({ ...p, optionLetterFontSize: Number(e.target.value) || 1 }))}
                        className="h-9 w-16"
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
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

      <Dialog open={isSaveFormatOpen} onOpenChange={setIsSaveFormatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ফরম্যাট সেভ করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">ফরম্যাটের নাম</Label>
              <Input
                value={newFormatName}
                onChange={(e) => setNewFormatName(e.target.value)}
                placeholder="যেমন: নীল থিম, পরীক্ষা স্লাইড"
                onKeyDown={(e) => { if (e.key === "Enter") saveCurrentFormat(); }}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              বর্তমান রঙ, ফন্ট, হেডার/ফুটার ও বক্সের সব সেটিং এই নামে সেভ হবে — পরে যেকোনো সময় এক ক্লিকে আবার ব্যবহার করতে পারবেন।
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsSaveFormatOpen(false)}>বাতিল</Button>
              <Button size="sm" onClick={saveCurrentFormat}>সেভ করুন</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
          <DialogHeader className="p-4 pb-2 border-b space-y-2">
            <DialogTitle>সব স্লাইড ({questions.length}) — টেক্সটে ক্লিক করে এডিট করুন</DialogTitle>
            {/* Rich-text format bar — applies Bold/Italic/Underline/Color/
                Highlight to whatever text is currently selected inside any
                editable question/option field below. */}
            <FormatToolbar />
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
    down to fit the grid cell width while keeping it editable. */
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
