import fs from 'fs';

const filesToPatch = [
    'src/pages/dashboard/LiveExam.tsx',
    'src/pages/dashboard/Readymade.tsx',
    'src/pages/dashboard/DashboardHome.tsx',
    'src/pages/dashboard/PastExamCatalog.tsx',
    'src/pages/public/PublicExamEntry.tsx'
];

for (const file of filesToPatch) {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content;

    if (file === 'src/pages/dashboard/LiveExam.tsx' || file === 'src/pages/dashboard/PastExamCatalog.tsx') {
        newContent = content.replace(/onClick=\{\(\) => navigate\(\`\/dashboard\/take-exam\/\$\{selectedExamForPopup\?\.id\}\`\)\}/g, 'onClick={() => { if (selectedExamForPopup?.external_exam_link) { window.open(selectedExamForPopup.external_exam_link, "_blank"); } else { navigate(`/dashboard/take-exam/${selectedExamForPopup?.id}`); } }}');
    } else if (file === 'src/pages/dashboard/DashboardHome.tsx') {
        newContent = content.replace(/onClick=\{\(\) => navigate\(\`\/dashboard\/take-exam\/\$\{exam\?\.id\}\`\)\}/g, 'onClick={() => { if (exam?.external_exam_link) { window.open(exam.external_exam_link, "_blank"); } else { navigate(`/dashboard/take-exam/${exam?.id}`); } }}');
    } else if (file === 'src/pages/dashboard/Readymade.tsx') {
        newContent = content.replace(/onClick=\{\(\) => navigate\(\`\/dashboard\/take-exam\/\$\{exam\.id\}\`\)\}/g, 'onClick={() => { if (exam.external_exam_link) { window.open(exam.external_exam_link, "_blank"); } else { navigate(`/dashboard/take-exam/${exam.id}`); } }}');
    }

    fs.writeFileSync(file, newContent);
}
