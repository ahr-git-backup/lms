import re

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'r') as f:
    content = f.read()

# Layout redesign based exactly on the screenshot
# The main container should have max-w-2xl mx-auto to look like a clean mobile feed
# The header should be a card with 30px rounded corners
# The title should be bright green
# The buttons should be pill-shaped, left aligned, stacked, and NOT taking the full width on desktop if not needed, but on mobile maybe flex-wrap or column

header_regex = r'<div className="flex flex-col gap-4 rounded-\[20px\] bg-card p-5 shadow-sm border border-border\/60 w-full">.*?<\/div>\n\n        \{\/\* Collapsible Question Bank \*\/\}'

new_header = '''<div className="flex flex-col gap-6 rounded-[20px] sm:rounded-[30px] bg-card p-6 sm:p-8 shadow-sm border border-border/60 w-full mx-auto max-w-2xl relative">

            {/* Back Button & Title Area */}
            <div className="flex items-start gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-10 w-10 text-foreground hover:bg-secondary shrink-0 mt-1">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#2BA25C] leading-none mb-3">
                        Quiz Maker<br/>Studio
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground leading-snug max-w-sm">
                        {examId ? `Editing: ${examTitle}` : "Create, edit, and export professional quiz questions"}
                    </p>
                </div>
            </div>

            {/* Action Buttons Stack (Pill shaped, left aligned) */}
            <div className="flex flex-col gap-3 mt-4 sm:max-w-[280px]">
                <Input
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    className="w-full font-medium h-12 rounded-full px-5 text-sm sm:text-base border-border/60 focus-visible:ring-1"
                    placeholder="New Exam"
                    disabled={!!examId}
                />

                {examId ? (
                    <div className="flex gap-2 w-full mt-2">
                        <Button
                            onClick={handleSaveToDatabase}
                            disabled={isSaving}
                            variant="outline"
                            className="flex-1 rounded-full h-11 border-border/60 hover:bg-secondary justify-start px-5 font-medium"
                        >
                            {isSaving ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Database className="mr-3 h-4 w-4" />}
                            Save Database
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReplaceAllQuestions}
                            disabled={isSaving}
                            title="Replace All DB Questions"
                            className="rounded-full h-11 w-11 p-0 shrink-0"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                    </div>
                ) : (
                    <Button variant="outline" onClick={handleExport} className="w-full rounded-full h-11 border-border/60 hover:bg-secondary justify-start px-5 font-medium shadow-sm">
                        <Download className="mr-3 h-4 w-4" /> Export JSON
                    </Button>
                )}

                <div className="relative w-full">
                    <Button variant="outline" onClick={() => document.getElementById('impf')?.click()} className="w-full rounded-full h-11 border-border/60 hover:bg-secondary justify-start px-5 font-medium shadow-sm">
                        <Upload className="mr-3 h-4 w-4" /> Import File
                    </Button>
                    <input type="file" id="impf" className="hidden" accept=".json,.csv" onChange={handleImport} />
                </div>

                <div className="flex gap-3 w-full items-center">
                    <Button
                        variant="outline"
                        onClick={() => setShowBankSelector(!showBankSelector)}
                        className={`flex-1 rounded-full h-11 justify-start px-5 font-medium shadow-sm transition-colors ${showBankSelector ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20' : 'bg-secondary/30 border-border/60 hover:bg-secondary'}`}
                    >
                        <BookOpen className="mr-3 h-4 w-4" /> Question Bank
                    </Button>
                </div>
            </div>

            {/* Trash button isolated to the bottom right for extreme actions */}
            <div className="absolute right-6 sm:right-8 bottom-6 sm:bottom-8">
                <Button variant="destructive" size="icon" className="rounded-full h-12 w-12 bg-red-500 hover:bg-red-600 shadow-md" onClick={() => {
                    if (confirm("Are you sure you want to clear all questions?")) setQuestions([]);
                }}>
                    <Trash2 className="h-5 w-5 text-white" />
                </Button>
            </div>
        </div>

        {/* Collapsible Question Bank */}'''

content = re.sub(header_regex, new_header, content, flags=re.DOTALL)

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'w') as f:
    f.write(content)
