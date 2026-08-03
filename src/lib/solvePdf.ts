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
  /** "style1" = inline (Q+Ans+Explanation together), "style2" = separate Answer Table. Defaults to style2. */
  style?: "style1" | "style2";
}

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

// NOTE: question_text/options/explanation contain trusted HTML (e.g. <img> tags
// for question images) coming from our own DB, same as on the Result page where
// it's rendered via dangerouslySetInnerHTML. So we must NOT escape < > here,
// otherwise <img> tags get turned into literal text and images don't render in
// the PDF.
function escapeHtml(str: string | undefined | null): string {
  if (!str) return "";
  return String(str);
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

// Ported 1:1 from QuizBot's _PRINT_CSS.
const PRINT_CSS = `<style>
@page{size:A4 portrait;margin:10mm 10mm;@top-center{content:none}@bottom-center{content:none}}
body{font-family:'Noto Sans Bengali','SolaimanLipi','Noto Sans','Noto Sans Symbols','Noto Sans Symbols 2',Arial,sans-serif;font-size:12pt;line-height:1.2;color:#000;margin:0 auto;padding:10px;width:210mm;max-width:210mm}
@media screen{html{background:#e5e5e5}body{margin:10px auto;box-shadow:0 0 8px rgba(0,0,0,0.15)}}
.exam-header{text-align:center;border:2px solid #4169E1;background-color:#F0F8FF;border-radius:6px;padding:10px;margin-bottom:15px}
.exam-header h1{color:#191970;margin:0;font-size:15pt;font-weight:bold}
.content-columns{column-count:2;column-gap:15px;column-fill:balance;column-rule:1px solid #ddd}
.question{margin-bottom:7px;break-inside:avoid;page-break-inside:avoid}
.question-header{margin-bottom:4px;display:flex;align-items:flex-start}
.question-num{font-family:'Times New Roman',serif;font-weight:bold;color:#1E64B7;font-size:12pt;margin-right:5px;white-space:nowrap;flex-shrink:0}
.question-text{flex:1;line-height:1.4;font-size:13pt;color:#000;word-wrap:break-word;white-space:pre-line}
.options-table-short{width:100%;border-collapse:collapse;margin:4px 0 4px 8px;table-layout:fixed}
.options-table-short td{border:none;padding:2px 8px 2px 0;vertical-align:top;font-size:13pt;color:#000;width:40%}
.options-table-short td.answer-col{display:flex;justify-content:center;align-items:center;vertical-align:middle;font-family:'Poppins',sans-serif;font-weight:600;font-size:12pt;color:#000;padding-left:10px}
.answer-circle{font-weight:300;font-family:'Poppins',sans-serif;font-size:12pt;line-height:1}
.options-list{margin:4px 0 4px 8px;padding:0;list-style:none}
.options-list li{margin:1px 0;font-size:13pt;color:#000;word-wrap:break-word;white-space:pre-line}
.option-with-answer{display:flex;justify-content:space-between;align-items:flex-start}
.explanation{margin:4px 0 2px 8px;padding:4px;color:#000;background-color:rgba(66,153,225,0.1);border-left:3px solid #4299e1;font-size:12pt;font-style:italic;break-inside:avoid;white-space:pre-line}
.explanation-label{font-weight:bold;color:#2c5282}
.page-break{page-break-before:always;break-before:page}
.answers-section{column-count:1;margin-top:0}
.answer-table{width:100%;border-collapse:collapse;margin-top:0;border:1px solid #333}
.answer-table th,.answer-table td{border:1px solid #333;padding:6px;text-align:left;vertical-align:top;word-wrap:break-word}
.answer-table th{background-color:#f5f5f5;font-weight:bold;text-align:center;font-size:13pt}
.qno-col{width:8%;text-align:center}.ans-col{width:8%;text-align:center;font-weight:bold;font-size:14pt}.exp-col{width:84%;font-size:12pt;white-space:pre-line}
img{max-width:35%!important;height:auto!important;vertical-align:middle}
@media print{@page{size:A4 portrait;margin:10mm 10mm;@top-center{content:none}@bottom-center{content:none}}body{-webkit-print-color-adjust:exact;color-adjust:exact;width:210mm;max-width:210mm}.question{break-inside:avoid;page-break-inside:avoid}.explanation{break-inside:avoid;page-break-inside:avoid}.content-columns{column-rule:1px solid #ddd}}
.print-btn{display:block;text-align:center;margin:20px auto;padding:14px 36px;background:linear-gradient(135deg,#5A5FE0,#7c3aed);color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(90,95,224,0.4)}
@media print{.print-btn{display:none}}
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
        body += `<table class="options-table-short"><tr><td class="option-col">(A) ${escapeHtml(opts[0])}</td><td class="option-col">(B) ${escapeHtml(opts[1])}</td><td rowspan="2" class="answer-col"><span class="answer-circle">${ansCircle}</span></td></tr><tr><td class="option-col">(C) ${escapeHtml(opts[2])}</td><td class="option-col">(D) ${escapeHtml(opts[3])}</td></tr></table>`;
      } else {
        body += `<ul class="options-list"><li>(A) ${escapeHtml(opts[0])}</li><li>(B) ${escapeHtml(opts[1])}</li><li>(C) ${escapeHtml(opts[2])}</li><li class="option-with-answer"><span>(D) ${escapeHtml(opts[3])}</span><span class="answer-circle">${ansCircle}</span></li></ul>`;
      }
      if (q.explanation) {
        body += `<div class="explanation"><span class="explanation-label">ব্যাখ্যা:</span> ${escapeHtml(q.explanation)}</div>`;
      }
      body += "</div>";
    });

    body += "</div>";
    body += `<button class="print-btn" onclick="window.print()">PDF হিসেবে ডাউনলোড / প্রিন্ট করুন</button>`;
    return `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8">${PRINT_CSS}<title>${heading}</title></head><body>${body}</body></html>`;
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
      body += `<table class="options-table-short"><tr><td>(A) ${escapeHtml(opts[0])}</td><td>(B) ${escapeHtml(opts[1])}</td></tr><tr><td>(C) ${escapeHtml(opts[2])}</td><td>(D) ${escapeHtml(opts[3])}</td></tr></table>`;
    } else {
      body += `<ul class="options-list"><li>(A) ${escapeHtml(opts[0])}</li><li>(B) ${escapeHtml(opts[1])}</li><li>(C) ${escapeHtml(opts[2])}</li><li>(D) ${escapeHtml(opts[3])}</li></ul>`;
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
  body += `<button class="print-btn" onclick="window.print()">PDF হিসেবে ডাউনলোড / প্রিন্ট করুন</button>`;

  return `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8">${PRINT_CSS}<title>${heading}</title></head><body>${body}</body></html>`;
}

export function openSolvePdf(params: SolvePdfParams) {
  const html = generateSolvePdfHtml(params);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
