// Generates a "Solve Sheet" PDF-style printable HTML page — ported 1:1 from
// QuizBot's Exam Style (style2 / "🖨️ Exam Style প্রশ্ন + Answer Table") format:
// _PRINT_CSS + _build_print_style2 in hamza818483-dotcom/QuizBot app.py.
// Same fonts, same colors, same layout: 2-column question page, then a
// page-break, then a separate Q.No/Ans/Explanation answer table.

interface SolvePdfQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string;
  correct_option: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  user_answer: string | null;
  explanation?: string;
}

interface SolvePdfParams {
  examName: string;
  studentName?: string;
  questions: SolvePdfQuestion[];
  totalMarks?: number;
  score?: number;
  /** "style1" = inline (Q+Ans+Explanation together), "style2" = separate Answer Table, "style3" = compact 3-column, 50/page. Defaults to style2. */
  style?: "style1" | "style2" | "style3";
}

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

// NOTE: question_text/options/explanation contain trusted HTML (e.g. <img> tags
// for question images) coming from our own DB, same as on the Result page where
// it's rendered via dangerouslySetInnerHTML. So we must NOT escape < > here,
// otherwise <img> tags get turned into literal text and images don't render in
// the PDF.
//
// Vector notation fix: stored text sometimes contains a base character
// followed by U+20D7 (combining right arrow above), e.g. "V ⃗" for vector V,
// with or without a space in between. Native combining-mark rendering for
// this glyph is unreliable in headless Chromium (used for PDF export) the
// same way it was in the app, so it's replaced with a manually positioned
// small arrow above the base character instead of relying on the browser
// to stack the combining mark itself.
const VECTOR_ARROW_REGEX = /([^<>\s])\s?\u20D7/g;
function escapeHtml(str: string | undefined | null): string {
  if (!str) return "";
  return String(str).replace(
    VECTOR_ARROW_REGEX,
    '<span style="position:relative;display:inline-block;padding-top:0.55em;">$1<span style="position:absolute;top:-0.05em;left:50%;transform:translateX(-50%) scaleX(1.3);font-size:0.6em;line-height:1;">&#8594;</span></span>'
  );
}

// Ported from QuizBot _check_short_option: options count as "short" only if
// every non-empty option (tags stripped) is 16 chars or fewer.
function checkShortOption(opts: string[]): boolean {
  for (const v of opts) {
    if (v) {
      const clean = String(v).replace(/<[^>]+>/g, "").trim();
      if (clean.length > 16) return false;
    }
  }
  return true;
}

const GOOGLE_FONTS_LINK = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols:text=%E2%83%97%E2%8B%85&family=Noto+Sans+Symbols+2:text=%E2%83%97%E2%8B%85&display=swap">`;

// Ported 1:1 from QuizBot's _PRINT_CSS.
const PRINT_CSS = `<style>
@page{size:A4 portrait;margin:10mm 10mm;@top-center{content:none}@bottom-center{content:none}}
body{font-family:'Noto Sans Bengali','SolaimanLipi','Noto Sans','Noto Sans Symbols','Noto Sans Symbols 2',Arial,sans-serif;font-size:12pt;line-height:1.2;color:#000;margin:0 auto;padding:10px}
@media screen{html{background:#fff}body{width:100%;max-width:210mm}}
@media screen{.s3-page{min-width:190mm}}
@media print{body{width:210mm;max-width:210mm}}
.exam-header{text-align:center;border:2px solid #16a34a;background-color:#F0FDF4;border-radius:6px;padding:10px;margin-bottom:15px}
.exam-header h1{color:#166534;margin:0;font-size:15pt;font-weight:bold}
.content-columns{column-count:2;column-gap:15px;column-fill:balance;column-rule:1px solid #ddd}
.question{margin-bottom:7px;break-inside:avoid;page-break-inside:avoid}
.question-header{margin-bottom:4px;display:flex;align-items:flex-start}
.question-num{font-family:'Times New Roman',serif;font-weight:bold;color:#15803d;font-size:12pt;margin-right:5px;white-space:nowrap;flex-shrink:0}
.question-text{flex:1;line-height:1.4;font-size:13pt;color:#000;word-wrap:break-word;white-space:pre-line}
.options-table-short{width:100%;border-collapse:collapse;margin:4px 0 4px 8px;table-layout:fixed}
.options-table-short td{border:none;padding:2px 8px 2px 0;vertical-align:top;font-size:13pt;color:#000;width:40%}
.options-table-short td.answer-col{display:flex;justify-content:center;align-items:center;vertical-align:middle;font-family:'Poppins',sans-serif;font-weight:600;font-size:12pt;color:#000;padding-left:10px}
.answer-circle{font-weight:300;font-family:'Poppins',sans-serif;font-size:12pt;line-height:1}
.opt-letter{display:inline-flex;align-items:center;justify-content:center;width:11pt;height:11pt;border-radius:50%;border:1px solid #000;font-size:7pt;font-weight:600;margin-right:5px;flex-shrink:0;vertical-align:middle}
.options-list{margin:4px 0 4px 8px;padding:0;list-style:none}
.options-list li{display:flex;align-items:center}
.options-list li{margin:1px 0;font-size:13pt;color:#000;word-wrap:break-word;white-space:pre-line}
.option-with-answer{display:flex;justify-content:space-between;align-items:flex-start}
.explanation{margin:4px 0 2px 8px;padding:4px;color:#000;background-color:rgba(22,163,74,0.1);border-left:3px solid #16a34a;font-size:12pt;font-style:italic;break-inside:avoid;white-space:pre-line}
.explanation-label{font-weight:bold;color:#166534}
.page-break{page-break-before:always;break-before:page}
.answers-section{column-count:1;margin-top:0}
.answer-table{width:100%;border-collapse:collapse;margin-top:0;border:1px solid #16a34a}
.answer-table th,.answer-table td{border:1px solid #86efac;padding:6px;text-align:left;vertical-align:top;word-wrap:break-word}
.answer-table th{background-color:#F0FDF4;font-weight:bold;text-align:center;font-size:13pt;color:#166534}
.qno-col{width:8%;text-align:center}.ans-col{width:8%;text-align:center;font-weight:bold;font-size:14pt}.exp-col{width:84%;font-size:12pt;white-space:pre-line}
img{max-width:35%!important;height:auto!important;vertical-align:middle}
@media print{@page{size:A4 portrait;margin:10mm 10mm;@top-center{content:none}@bottom-center{content:none}}body{-webkit-print-color-adjust:exact;color-adjust:exact;width:210mm;max-width:210mm}.question{break-inside:avoid;page-break-inside:avoid}.explanation{break-inside:avoid;page-break-inside:avoid}}
.print-btn{display:block;text-align:center;margin:20px auto;padding:14px 36px;background:linear-gradient(135deg,#5A5FE0,#7c3aed);color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(90,95,224,0.4)}
@media print{.print-btn{display:none}}
.fab-download{position:fixed;bottom:20px;right:20px;z-index:999;display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#5A5FE0,#7c3aed);color:#fff;border:none;box-shadow:0 4px 16px rgba(90,95,224,0.5);cursor:pointer}
.fab-download svg{width:26px;height:26px}
@media print{.fab-download{display:none}}
.content-columns-3{column-count:3;column-gap:8px;column-fill:auto;column-rule:1px solid #ddd}
.question-s3{margin-bottom:4px;break-inside:avoid;page-break-inside:avoid;font-size:8.3pt;line-height:1.15}
.question-s3 .question-header{margin-bottom:1px;display:flex;align-items:flex-start}
.question-s3 .question-num{font-family:'Times New Roman',serif;font-weight:bold;color:#15803d;font-size:8.3pt;margin-right:3px;white-space:nowrap;flex-shrink:0}
.question-s3 .question-text{flex:1;line-height:1.15;font-size:8.3pt;color:#000;word-wrap:break-word;white-space:pre-line}
.options-list-s3{margin:1px 0 2px 10px;padding:0;list-style:none}
.options-list-s3 li{display:flex;align-items:center;margin:0;font-size:8pt;color:#000;word-wrap:break-word}
.opt-letter-s3{display:inline-flex;align-items:center;justify-content:center;width:7pt;height:7pt;border-radius:50%;border:0.6px solid #000;font-size:5pt;font-weight:600;margin-right:3px;flex-shrink:0}
.options-table-s3{width:100%;border-collapse:collapse;margin:1px 0 2px 10px;table-layout:fixed}
.options-table-s3 td{border:none;padding:0 4px 0 0;vertical-align:top;font-size:8pt;color:#000;width:50%}
@page s3{size:A4 portrait;margin:8mm 8mm}
.s3-page{page:s3}
</style>`;

export function generateSolvePdfHtml({ examName, questions, style = "style2" }: SolvePdfParams): string {
  const heading = escapeHtml(examName) || "Exam";

  if (style === "style1") {
    // Ported 1:1 from QuizBot _build_print_style1: Q + inline answer circle + explanation together.
    let body = `<div class="exam-header"><h1>${heading} - Practice Sheet</h1></div><div class="content-columns">`;

    questions.forEach((q, idx) => {
      const n = idx + 1;
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
      const isShort = checkShortOption(opts);
      const qNum = String(n).padStart(2, "0");
      const ai = OPTION_KEYS.indexOf(q.correct_option as any);
      const ansCircle = `[${ai >= 0 ? OPTION_KEYS[ai] : "?"}]`;

      body += `<div class="question"><div class="question-header"><span class="question-num">${qNum}.</span><div class="question-text">${escapeHtml(q.question_text)}</div></div>`;

      if (isShort) {
        body += `<table class="options-table-short"><tr><td class="option-col"><span class="opt-letter">A</span>${escapeHtml(opts[0])}</td><td class="option-col"><span class="opt-letter">B</span>${escapeHtml(opts[1])}</td><td rowspan="2" class="answer-col"><span class="answer-circle">${ansCircle}</span></td></tr><tr><td class="option-col"><span class="opt-letter">C</span>${escapeHtml(opts[2])}</td><td class="option-col"><span class="opt-letter">D</span>${escapeHtml(opts[3])}</td></tr></table>`;
      } else {
        body += `<ul class="options-list"><li><span class="opt-letter">A</span>${escapeHtml(opts[0])}</li><li><span class="opt-letter">B</span>${escapeHtml(opts[1])}</li><li><span class="opt-letter">C</span>${escapeHtml(opts[2])}</li><li class="option-with-answer"><span><span class="opt-letter">D</span>${escapeHtml(opts[3])}</span><span class="answer-circle">${ansCircle}</span></li></ul>`;
      }
      if (q.explanation) {
        body += `<div class="explanation"><span class="explanation-label">ব্যাখ্যা:</span> ${escapeHtml(q.explanation)}</div>`;
      }
      body += "</div>";
    });

    body += "</div>";
    body += `<button class="print-btn" onclick="window.print()">PDF হিসেবে ডাউনলোড / প্রিন্ট করুন</button><button class="fab-download" onclick="window.print()" aria-label="Download PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>`;
    return `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8">${GOOGLE_FONTS_LINK}${PRINT_CSS}<title>${heading}</title></head><body>${body}</body></html>`;
  }

  if (style === "style3") {
    // Compact 3-column layout, ~50 MCQs per printed page (fewer when
    // questions/options run long, so pages don't overflow). Each page's
    // content is packed by an estimated "weight" per question rather than a
    // flat count, so long-option MCQs don't push a page past its physical
    // A4 capacity.
    const MAX_PER_PAGE = 50;
    // Rough capacity budget per page, in "weight units". A short MCQ (2-line
    // question, short options in the 2x2 table) is weight ~1. Budget tuned
    // so 50 short MCQs ~= one page.
    const PAGE_BUDGET = 50;

    function estimateWeight(q: SolvePdfQuestion): number {
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
      const isShort = checkShortOption(opts);
      const qLen = String(q.question_text || "").replace(/<[^>]+>/g, "").length;
      // Question text: ~28 chars per line at this column width/font size.
      const qLines = Math.max(1, Math.ceil(qLen / 28));
      let optWeight: number;
      if (isShort) {
        optWeight = 0.6; // compact 2x2 table, roughly fixed height
      } else {
        // Full-width list: each option can itself wrap to multiple lines.
        optWeight = opts.reduce((sum, o) => {
          const len = String(o || "").replace(/<[^>]+>/g, "").length;
          return sum + Math.max(1, Math.ceil(len / 30)) * 0.35;
        }, 0);
      }
      return qLines * 0.55 + optWeight + 0.3;
    }

    const pages: SolvePdfQuestion[][] = [];
    let current: SolvePdfQuestion[] = [];
    let currentWeight = 0;
    for (const q of questions) {
      const w = estimateWeight(q);
      if (current.length > 0 && (currentWeight + w > PAGE_BUDGET || current.length >= MAX_PER_PAGE)) {
        pages.push(current);
        current = [];
        currentWeight = 0;
      }
      current.push(q);
      currentWeight += w;
    }
    if (current.length > 0) pages.push(current);

    let body = "";
    let qCounter = 0;
    pages.forEach((pageQs, pIdx) => {
      body += `<div class="s3-page"${pIdx > 0 ? ' style="page-break-before:always"' : ""}>`;
      body += `<div class="exam-header"><h1>${heading} - Practice Sheet</h1></div><div class="content-columns-3">`;
      pageQs.forEach((q) => {
        qCounter += 1;
        const n = qCounter;
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
        const isShort = checkShortOption(opts);
        const qNum = String(n).padStart(2, "0");
        body += `<div class="question-s3"><div class="question-header"><span class="question-num">${qNum}.</span><div class="question-text">${escapeHtml(q.question_text)}</div></div>`;
        if (isShort) {
          body += `<table class="options-table-s3"><tr><td><span class="opt-letter-s3">A</span>${escapeHtml(opts[0])}</td><td><span class="opt-letter-s3">B</span>${escapeHtml(opts[1])}</td></tr><tr><td><span class="opt-letter-s3">C</span>${escapeHtml(opts[2])}</td><td><span class="opt-letter-s3">D</span>${escapeHtml(opts[3])}</td></tr></table>`;
        } else {
          body += `<ul class="options-list-s3"><li><span class="opt-letter-s3">A</span>${escapeHtml(opts[0])}</li><li><span class="opt-letter-s3">B</span>${escapeHtml(opts[1])}</li><li><span class="opt-letter-s3">C</span>${escapeHtml(opts[2])}</li><li><span class="opt-letter-s3">D</span>${escapeHtml(opts[3])}</li></ul>`;
        }
        body += "</div>";
      });
      body += "</div></div>";
    });

    body += `<div class="page-break"></div><div class="answers-section"><table class="answer-table"><thead><tr><th class="qno-col">Q.No.</th><th class="ans-col">Ans</th><th class="exp-col">Explanation</th></tr></thead><tbody>`;
    questions.forEach((q, idx) => {
      const n = idx + 1;
      const al = OPTION_KEYS.includes(q.correct_option as any) ? q.correct_option : "-";
      body += `<tr><td class="qno-col">${n}</td><td class="ans-col">${escapeHtml(al)}</td><td class="exp-col">${q.explanation ? escapeHtml(q.explanation) : "-"}</td></tr>`;
    });
    body += "</tbody></table></div>";
    body += `<button class="print-btn" onclick="window.print()">PDF হিসেবে ডাউনলোড / প্রিন্ট করুন</button><button class="fab-download" onclick="window.print()" aria-label="Download PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>`;
    return `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8">${GOOGLE_FONTS_LINK}${PRINT_CSS}<title>${heading}</title></head><body>${body}</body></html>`;
  }

  // style2 (default): questions page + separate answer table.
  let body = `<div class="exam-header"><h1>${heading} - Questions</h1></div><div class="content-columns">`;

  questions.forEach((q, idx) => {
    const n = idx + 1;
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
    const isShort = checkShortOption(opts);
    const qNum = String(n).padStart(2, "0");

    body += `<div class="question"><div class="question-header"><span class="question-num">${qNum}.</span><div class="question-text">${escapeHtml(q.question_text)}</div></div>`;

    if (isShort) {
      body += `<table class="options-table-short"><tr><td><span class="opt-letter">A</span>${escapeHtml(opts[0])}</td><td><span class="opt-letter">B</span>${escapeHtml(opts[1])}</td></tr><tr><td><span class="opt-letter">C</span>${escapeHtml(opts[2])}</td><td><span class="opt-letter">D</span>${escapeHtml(opts[3])}</td></tr></table>`;
    } else {
      body += `<ul class="options-list"><li><span class="opt-letter">A</span>${escapeHtml(opts[0])}</li><li><span class="opt-letter">B</span>${escapeHtml(opts[1])}</li><li><span class="opt-letter">C</span>${escapeHtml(opts[2])}</li><li><span class="opt-letter">D</span>${escapeHtml(opts[3])}</li></ul>`;
    }
    body += "</div>";
  });

  body += `</div><div class="page-break"></div><div class="answers-section"><table class="answer-table"><thead><tr><th class="qno-col">Q.No.</th><th class="ans-col">Ans</th><th class="exp-col">Explanation</th></tr></thead><tbody>`;

  questions.forEach((q, idx) => {
    const n = idx + 1;
    const al = OPTION_KEYS.includes(q.correct_option as any) ? q.correct_option : "-";
    body += `<tr><td class="qno-col">${n}</td><td class="ans-col">${escapeHtml(al)}</td><td class="exp-col">${q.explanation ? escapeHtml(q.explanation) : "-"}</td></tr>`;
  });

  body += "</tbody></table></div>";
  body += `<button class="print-btn" onclick="window.print()">PDF হিসেবে ডাউনলোড / প্রিন্ট করুন</button><button class="fab-download" onclick="window.print()" aria-label="Download PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>`;

  return `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8">${GOOGLE_FONTS_LINK}${PRINT_CSS}<title>${heading}</title></head><body>${body}</body></html>`;
}

export function openSolvePdf(params: SolvePdfParams) {
  const html = generateSolvePdfHtml(params);
  const win = window.open("", "_blank");
  if (!win) {
    // Popup blocked — fallback to downloadable file
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "practice-sheet.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
