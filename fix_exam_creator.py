import re

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'r') as f:
    content = f.read()

# Remove HTML processing logic
content = re.sub(r'const sanitizeHtml = .*?;\n};', '', content, flags=re.DOTALL)
content = re.sub(r'// Helper to convert base64 to Blob.*?};\n};', '', content, flags=re.DOTALL)
content = re.sub(r'// Image Upload Function.*?};\n};', '', content, flags=re.DOTALL)
content = re.sub(r'const processHtmlContent = .*?};\n};', '', content, flags=re.DOTALL)

# In handleExport, remove image processing
export_regex = r'const handleExport = async \(\) => \{.*?\n  \};\n'

new_export = '''const handleExport = async () => {
    setIsExporting(true);
    setExportProgress("Preparing to export...");

    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(questions, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", (examTitle || "quiz") + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        toast({ title: "Export Success", description: "Exam exported successfully." });

    } catch (error) {
        console.error("Export failed", error);
        toast({ title: "Export Failed", description: "An error occurred during export.", variant: "destructive" });
    } finally {
        setIsExporting(false);
        setExportProgress("");
    }
};
'''

content = re.sub(export_regex, new_export, content, flags=re.DOTALL)

# In handleImport, simplify formatting
import_regex = r'const handleImport = \(e: React.ChangeEvent<HTMLInputElement>\) => \{.*?\n  \};\n'

new_import = '''const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const content = event.target?.result as string;
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                const normalized = parsed.map((q: any) => ({
                    question: String(q.question || q.question_text || ""),
                    options: q.options || { A: "", B: "", C: "", D: "" },
                    correct_answer: String(q.correct_answer || q.correct_option || "").toUpperCase(),
                    explanation: String(q.explanation || "")
                }));
                setQuestions(prev => [...prev, ...normalized]);
                toast({ title: "Import Successful", description: `Imported ${normalized.length} questions from JSON.` });
            } else {
                toast({ title: "Invalid Format", description: "Expected an array of questions.", variant: "destructive" });
            }
        } catch (err) {
            console.error(err);
            toast({ title: "Import Failed", description: "Could not parse file.", variant: "destructive" });
        }
    };
    reader.readAsText(file);
    e.target.value = "";
};
'''

content = re.sub(import_regex, new_import, content, flags=re.DOTALL)


with open('src/pages/dashboard/admin/ExamCreator.tsx', 'w') as f:
    f.write(content)
