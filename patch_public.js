import fs from 'fs';
const file = 'src/pages/public/PublicExamEntry.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex1 = /navigate\(\`\/dashboard\/take-exam\/\$\{examId\}\`\);/g;
const rep1 = 'if (exam.external_exam_link) { window.open(exam.external_exam_link, "_blank"); } else { navigate(`/dashboard/take-exam/${examId}`); }';

const regex2 = /onClick=\{\(\) => navigate\(\`\/dashboard\/take-exam\/\$\{examId\}\`\)\}/g;
const rep2 = 'onClick={() => { if (exam.external_exam_link) { window.open(exam.external_exam_link, "_blank"); } else { navigate(`/dashboard/take-exam/${examId}`); } }}';

content = content.replace(regex1, rep1).replace(regex2, rep2);
fs.writeFileSync(file, content);
