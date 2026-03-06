import fs from 'fs';

const filesToPatch = [
    'src/pages/dashboard/LiveExam.tsx',
    'src/pages/dashboard/Readymade.tsx',
    'src/pages/dashboard/DashboardHome.tsx',
    'src/pages/dashboard/PastExamCatalog.tsx',
    'src/pages/public/PublicExamEntry.tsx',
    'src/pages/dashboard/CourseView.tsx',
    'src/pages/dashboard/Archive.tsx'
];

for (const file of filesToPatch) {
    let content = fs.readFileSync(file, 'utf8');

    // Revert the conditional window.open back to standard navigate

    // LiveExam / PastExamCatalog
    content = content.replace(/onClick=\{\(\) => \{ if \(selectedExamForPopup\?\.external_exam_link\) \{ window\.open\(selectedExamForPopup\.external_exam_link, "_blank"\); \} else \{ navigate\(\`\/dashboard\/take-exam\/\$\{selectedExamForPopup\?\.id\}\`\); \} \}\}/g, 'onClick={() => navigate(`/dashboard/take-exam/${selectedExamForPopup?.id}`)}');

    // DashboardHome
    content = content.replace(/onClick=\{\(\) => \{ if \(exam\?\.external_exam_link\) \{ window\.open\(exam\.external_exam_link, "_blank"\); \} else \{ navigate\(\`\/dashboard\/take-exam\/\$\{exam\?\.id\}\`\); \} \}\}/g, 'onClick={() => navigate(`/dashboard/take-exam/${exam?.id}`)}');

    // Readymade / CourseView / Archive / PublicExamEntry
    content = content.replace(/onClick=\{\(\) => \{[\s]*if \(exam\.external_exam_link\) \{[\s]*window\.open\(exam\.external_exam_link, "_blank"\);[\s]*\} else \{[\s]*navigate\(\`\/dashboard\/take-exam\/\$\{exam\.id\}\`\);[\s]*\}[\s]*\}\}/g, 'onClick={() => navigate(`/dashboard/take-exam/${exam.id}`)}');

    // Handle PublicExamEntry specific format
    content = content.replace(/if \(exam\.external_exam_link\) \{ window\.open\(exam\.external_exam_link, "_blank"\); \} else \{ navigate\(\`\/dashboard\/take-exam\/\$\{examId\}\`\); \}/g, 'navigate(`/dashboard/take-exam/${examId}`);');
    content = content.replace(/onClick=\{\(\) => \{ if \(exam\.external_exam_link\) \{ window\.open\(exam\.external_exam_link, "_blank"\); \} else \{ navigate\(\`\/dashboard\/take-exam\/\$\{examId\}\`\); \} \}\}/g, 'onClick={() => navigate(`/dashboard/take-exam/${examId}`)}');

    fs.writeFileSync(file, content);
}
