import fs from 'fs';
const file = 'src/pages/dashboard/TakeExam.tsx';
let content = fs.readFileSync(file, 'utf8');

// I need to use useEffect for window.location.href because modifying it directly in the component body
// violates React's pure render rules and can cause the component to unmount abruptly.

const regex = /if \(exam\.external_exam_link\) \{[\s]*window\.location\.href = exam\.external_exam_link;[\s]*return \([\s]*<div className="flex flex-col h-\[50vh\] items-center justify-center space-y-4">[\s]*<Loader2 className="h-8 w-8 animate-spin text-primary" \/>[\s]*<p className="text-muted-foreground">Preparing exam environment\.\.\.<\/p>[\s]*<\/div>[\s]*\);[\s]*\}/g;

const rep = `useEffect(() => {
    if (exam?.external_exam_link && (!isLive || !start || now >= start)) {
        window.location.href = exam.external_exam_link;
    }
  }, [exam, isLive, start, now]);

  if (exam?.external_exam_link) {
      return (
          <div className="flex flex-col h-[50vh] items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Preparing exam environment...</p>
          </div>
      );
  }`;

content = content.replace(regex, rep);
fs.writeFileSync(file, content);
