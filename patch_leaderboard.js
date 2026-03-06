import fs from 'fs';
const file = 'src/components/admin/ExamsManager.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /onClick=\{\(\) => \{[\s]*const path = exam\.course_id \? \`\/dashboard\/take-exam\/\$\{exam\.id\}\` : \`\/open-exam\/\$\{exam\.id\}\`;[\s]*window\.open\(path, '_blank'\);[\s]*\}\}/g;
const rep = 'onClick={() => { const path = exam.external_exam_link ? exam.external_exam_link : (exam.course_id ? `/dashboard/take-exam/${exam.id}` : `/open-exam/${exam.id}`); window.open(path, "_blank"); }}';

content = content.replace(regex, rep);
fs.writeFileSync(file, content);
