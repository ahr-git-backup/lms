import fs from 'fs';
const content = fs.readFileSync('src/pages/dashboard/CourseView.tsx', 'utf8');

const regex = /onClick=\{\(\) => navigate\(\`\/dashboard\/take-exam\/\$\{exam\.id\}\`\)\}/g;
const replacement = 'onClick={() => { if (exam.external_exam_link) { window.open(exam.external_exam_link, "_blank"); } else { navigate(`/dashboard/take-exam/${exam.id}`); } }}';

const newContent = content.replace(regex, replacement);
fs.writeFileSync('src/pages/dashboard/CourseView.tsx', newContent);
