import fs from 'fs';

let content = fs.readFileSync('src/pages/dashboard/TakeExam.tsx', 'utf8');

content = content.replace(/useEffect\(\(\) => \{[\s]*if \(exam\?\.external_exam_link && \(\!isLive \|\| \!start \|\| now >= start\)\) \{[\s]*window\.location\.href = exam\.external_exam_link;[\s]*\}[\s]*\}, \[exam, isLive, start, now\]\);[\s]*if \(exam\?\.external_exam_link\) \{[\s]*return \([\s]*<div className="flex flex-col h-\[50vh\] items-center justify-center space-y-4">[\s]*<Loader2 className="h-8 w-8 animate-spin text-primary" \/>[\s]*<p className="text-muted-foreground">Preparing exam environment\.\.\.<\/p>[\s]*<\/div>[\s]*\);[\s]*\}/g, '');

fs.writeFileSync('src/pages/dashboard/TakeExam.tsx', content);
