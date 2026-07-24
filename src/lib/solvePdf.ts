// Generates a premium "Solve Sheet" PDF-style printable HTML page — same visual
// design as AtlasApp's exam.html openSolveSheetPDF(), adapted to LMS's data
// shape (question_text / option_a..d / correct_option letter / user_answer).
// Font sizes bumped up slightly vs the AtlasApp original per request.

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
}

const OPTION_LETTERS_BN = ["ক", "খ", "গ", "ঘ", "ঙ"] as const;
const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;

function escapeHtml(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function generateSolvePdfHtml({ examName, studentName, questions, totalMarks, score }: SolvePdfParams): string {
  const correct = questions.filter(q => q.user_answer === q.correct_option).length;
  const wrong = questions.filter(q => q.user_answer && q.user_answer !== q.correct_option).length;
  const skipped = questions.filter(q => !q.user_answer).length;
  const displayScore = score !== undefined ? score.toFixed(2) : (correct - wrong * 0.25).toFixed(2);
  const displayTotal = totalMarks !== undefined ? totalMarks : questions.length;
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(questions.length / perPage));
  const dateStr = new Date().toLocaleDateString("bn-BD");

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700;800&display=swap" rel="stylesheet">
  <title>Solve Sheet — ${escapeHtml(examName)}</title>
  <style>
    @page{size:A4;margin:14mm 12mm;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Noto Sans Bengali',serif;background:white;color:#1A1D2E;font-size:13px;line-height:1.65;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .page{page-break-after:always;padding:0 0 10mm;}
    .page:last-child{page-break-after:auto;}
    .pdf-header{background:linear-gradient(135deg,#1A1D2E 0%,#2D3057 50%,#1A1D2E 100%);color:white;padding:16px 18px;border-radius:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;}
    .pdf-header h1{font-size:23px;font-weight:800;color:#5A9FE0;letter-spacing:1px;}
    .pdf-header p{font-size:12px;opacity:0.7;margin-top:2px;}
    .pdf-header-right{text-align:right;}
    .score-big{font-size:31px;font-weight:800;color:#22D47A;}
    .score-label{font-size:11px;opacity:0.7;}
    .summary-bar{display:flex;gap:8px;margin-bottom:14px;background:#f8f9ff;border-radius:8px;padding:10px 14px;border:1px solid #e0e4ff;}
    .summary-item{flex:1;text-align:center;}
    .summary-val{font-size:20px;font-weight:800;}
    .summary-lbl{font-size:11px;color:#7A82A8;margin-top:1px;}
    .s-correct{color:#22D47A;}.s-wrong{color:#F87171;}.s-skip{color:#FBBF24;}.s-neg{color:#F87171;}
    .mcq-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
    .mcq-card{border-radius:10px;padding:12px;border:1.5px solid #e0e4ff;background:#fafbff;break-inside:avoid;}
    .mcq-card.card-correct{border-color:#22D47A;background:#f0fff8;}
    .mcq-card.card-wrong{border-color:#F87171;background:#fff5f5;}
    .mcq-card.card-skip{border-color:#FBBF24;background:#fffdf0;}
    .mcq-status-badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;margin-bottom:7px;}
    .badge-correct{background:#22D47A;color:#fff;}.badge-wrong{background:#F87171;color:#fff;}.badge-skip{background:#FBBF24;color:#fff;}
    .q-num{display:inline-block;font-size:11px;color:#7A82A8;margin-left:5px;float:right;}
    .q-text{font-size:13.5px;font-weight:700;margin:5px 0 8px;line-height:1.6;color:#1A1D2E;}
    .opt{display:flex;align-items:flex-start;gap:5px;padding:4px 7px;border-radius:5px;margin-bottom:3px;font-size:12.5px;color:#3D4070;}
    .opt-correct{background:#d4fbe8;color:#0A7A44;font-weight:700;}
    .opt-wrong{background:#ffe0e0;color:#B91C1C;text-decoration:line-through;}
    .opt-label{font-weight:700;min-width:18px;}
    .exp-box{background:#eef0ff;border-left:3px solid #5A5FE0;padding:6px 8px;margin-top:7px;font-size:11.5px;border-radius:0 5px 5px 0;color:#3D4070;line-height:1.55;}
    .exp-box strong{color:#5A5FE0;display:block;margin-bottom:2px;}
    img{max-width:100%;height:auto;border-radius:5px;}
    .page-banner{background:linear-gradient(90deg,#5A5FE0,#7c3aed);color:white;padding:6px 14px;border-radius:6px;margin-bottom:12px;font-size:13px;font-weight:700;display:flex;justify-content:space-between;}
    .pdf-footer{text-align:center;font-size:11px;color:#9EA5C9;padding:8px 0 0;border-top:1px dashed #D4D8EE;margin-top:10px;}
    .print-btn{display:block;text-align:center;margin:20px auto;padding:14px 36px;background:linear-gradient(135deg,#5A5FE0,#7c3aed);color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(90,95,224,0.4);}
    @media print{.print-btn{display:none;}}
  </style></head><body>`;

  for (let page = 0; page < totalPages; page++) {
    const start = page * perPage;
    const pageQs = questions.slice(start, Math.min(start + perPage, questions.length));
    html += `<div class="page">`;

    if (page === 0) {
      html += `<div class="pdf-header">
        <div><h1>ATLAS APP</h1><p>Solve Sheet — ${escapeHtml(examName)}</p><p style="margin-top:2px;">${escapeHtml(studentName) || "শিক্ষার্থী"} &nbsp;|&nbsp; ${dateStr}</p></div>
        <div class="pdf-header-right"><div class="score-big">${displayScore}</div><div class="score-label">/ ${displayTotal} নম্বর</div></div>
      </div>
      <div class="summary-bar">
        <div class="summary-item"><div class="summary-val s-correct">${correct}</div><div class="summary-lbl">সঠিক</div></div>
        <div class="summary-item"><div class="summary-val s-wrong">${wrong}</div><div class="summary-lbl">ভুল</div></div>
        <div class="summary-item"><div class="summary-val s-skip">${skipped}</div><div class="summary-lbl">স্কিপ</div></div>
        <div class="summary-item"><div class="summary-val s-neg">-${(wrong * 0.25).toFixed(2)}</div><div class="summary-lbl">নেগেটিভ</div></div>
      </div>`;
    }

    html += `<div class="page-banner"><span>${escapeHtml(examName)}</span><span>পৃষ্ঠা ${page + 1}/${totalPages} | প্রশ্ন ${start + 1}–${Math.min(start + perPage, questions.length)}</span></div>
      <div class="mcq-grid">`;

    pageQs.forEach((q, idx) => {
      const qNum = start + idx + 1;
      const ua = q.user_answer;
      const status = ua === q.correct_option ? "correct" : (ua ? "wrong" : "skip");
      const badgeText = status === "correct" ? "সঠিক" : status === "wrong" ? "ভুল" : "স্কিপ";

      html += `<div class="mcq-card card-${status}">
        <span class="mcq-status-badge badge-${status}">${badgeText}</span>
        <span class="q-num">Q${qNum}</span>
        <div class="q-text">${escapeHtml(q.question_text)}</div>`;

      OPTION_KEYS.forEach((key, oi) => {
        const optText = (q as any)[`option_${key.toLowerCase()}`];
        if (optText) {
          const isCorrectOpt = key === q.correct_option;
          const isSelectedWrong = key === ua && ua !== q.correct_option;
          const cls = isCorrectOpt ? "opt-correct" : isSelectedWrong ? "opt-wrong" : "";
          html += `<div class="opt ${cls}"><span class="opt-label">${OPTION_LETTERS_BN[oi]})</span><span>${escapeHtml(optText)}</span></div>`;
        }
      });

      if (q.explanation) {
        html += `<div class="exp-box"><strong>ব্যাখ্যা</strong>${escapeHtml(q.explanation)}</div>`;
      }
      html += `</div>`;
    });

    html += `</div><div class="pdf-footer">ATLAS APP © 2026 | পৃষ্ঠা ${page + 1}/${totalPages}</div></div>`;
  }

  html += `<button class="print-btn" onclick="window.print()">PDF হিসেবে ডাউনলোড / প্রিন্ট করুন</button></body></html>`;

  return html;
}

export function openSolvePdf(params: SolvePdfParams) {
  const html = generateSolvePdfHtml(params);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
