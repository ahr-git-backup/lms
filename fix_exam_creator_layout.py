import re

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'r') as f:
    content = f.read()

# Make the layout of the top panel match the provided screenshot
# The screenshot shows:
# Quiz Maker Studio (Green text)
# Create, edit, and export professional quiz questions
#
# Then Pill-shaped action buttons stacked or wrapped cleanly:
# [New Exam Input]
# [Export JSON]
# [Import File]
# [Question Bank] [Delete icon]

header_regex = r'<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between rounded-xl bg-card p-6 shadow-md border border-border">.*?<\/div>\n\n        \{\/\* Questions List \*\/\}'
new_header = '''<div className="flex flex-col gap-5 rounded-[20px] bg-card p-5 sm:p-6 shadow-sm border border-border/60 max-w-2xl mx-auto w-full">
            <div className="space-y-1 relative pl-10">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full h-8 w-8 text-foreground hover:bg-secondary">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-3xl font-bold tracking-tight text-green-600">
                    Quiz Maker<br/>Studio
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                    {examId ? `Editing: ${examTitle}` : "Create, edit, and export professional quiz questions"}
                </p>
            </div>

            <div className="flex flex-col gap-3 mt-2 w-full max-w-sm">
                <Input
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    className="w-full font-medium h-12 rounded-full px-5 text-base border-border/60 focus-visible:ring-1"
                    placeholder="New Exam"
                    disabled={!!examId}
                />

                {examId ? (
                    <div className="flex gap-2 w-full">
                        <Button
                            onClick={handleSaveToDatabase}
                            disabled={isSaving}
                            variant="outline"
                            className="flex-1 rounded-full h-11 border-border/60 hover:bg-secondary justify-start px-5"
                        >
                            {isSaving ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Database className="mr-3 h-4 w-4" />}
                            Save
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReplaceAllQuestions}
                            disabled={isSaving}
                            title="Replace All"
                            className="rounded-full h-11 w-11 p-0 shrink-0"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                    </div>
                ) : (
                    <Button variant="outline" onClick={handleExport} className="w-full rounded-full h-11 border-border/60 hover:bg-secondary justify-start px-5">
                        <Download className="mr-3 h-4 w-4" /> Export JSON
                    </Button>
                )}

                <div className="relative w-full">
                    <Button variant="outline" onClick={() => document.getElementById('impf')?.click()} className="w-full rounded-full h-11 border-border/60 hover:bg-secondary justify-start px-5">
                        <Upload className="mr-3 h-4 w-4" /> Import File
                    </Button>
                    <input type="file" id="impf" className="hidden" accept=".json,.csv" onChange={handleImport} />
                </div>

                <div className="flex gap-3 w-full items-center">
                    <Button variant="outline" onClick={() => setShowBankSelector(true)} className="flex-1 rounded-full h-11 border-border/60 hover:bg-secondary justify-start px-5 bg-secondary/30">
                        <BookOpen className="mr-3 h-4 w-4" /> Question Bank
                    </Button>

                    <Button variant="destructive" size="icon" className="rounded-full h-11 w-11 shrink-0 bg-red-500 hover:bg-red-600 shadow-sm" onClick={() => {
                        if (confirm("Are you sure you want to clear all questions?")) setQuestions([]);
                    }}>
                        <Trash2 className="h-4 w-4 text-white" />
                    </Button>
                </div>
            </div>
        </div>

        {/* Questions List */}'''

content = re.sub(header_regex, new_header, content, flags=re.DOTALL)

# Now refactor the question card layout
# We want the numbering and option style to match the screenshot
# The options have the letter A) and the text
# Selected option has a green bg and a green checkmark
# Explanation has a light blue dot and blue EXPLANATION text.

questions_map_regex = r'\{questions\.map\(\(q, i\) => \(.*?\{activeForm && activeForm\.index === i && activeForm\.type === \'edit\' \? \('
new_questions_map = '''{questions.map((q, i) => (
                <div key={i} className="group relative border border-border/40 hover:border-primary/20 pb-6 mb-6 transition-colors rounded-[30px] p-5 sm:p-6 bg-card shadow-sm max-w-2xl mx-auto w-full">
                    {/* Inline Form Edit Mode */}
                    {activeForm && activeForm.index === i && activeForm.type === 'edit' ? ('''

content = re.sub(questions_map_regex, new_questions_map, content, flags=re.DOTALL)

question_display_regex = r'<div className="space-y-4">\n                            <div className="flex gap-3">.*?<\/div>\n                    \)\}\n                <\/div>\n            \)\)\}'

new_question_display = '''<div className="space-y-5">
                            <div className="flex gap-2 sm:gap-3 items-start">
                                <span className="font-bold text-lg sm:text-xl leading-snug">{i + 1}.</span>
                                <MathText className="prose prose-sm sm:prose-base max-w-none dark:prose-invert font-medium mt-[1px]" text={q.question} />
                            </div>

                            <div className="flex flex-col gap-2 pl-6 sm:pl-8">
                                {Object.entries(q.options).map(([key, val]) => {
                                    const isCorrect = q.correct_answer === key;
                                    return (
                                        <div
                                            key={key}
                                            className={`relative p-3 rounded-xl transition-all duration-200 flex gap-3 items-start ${
                                                isCorrect
                                                ? 'bg-green-50/80 dark:bg-green-900/20'
                                                : ''
                                            }`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <span className={`text-sm sm:text-base font-bold shrink-0 ${
                                                    isCorrect
                                                    ? 'text-green-700 dark:text-green-400'
                                                    : 'text-foreground/80'
                                                }`}>
                                                    {key})
                                                </span>
                                                <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert break-words overflow-hidden text-foreground/90">
                                                    <MathText text={String(val)} />
                                                </div>
                                            </div>
                                            {isCorrect && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <div className="bg-green-500 rounded-full p-1">
                                                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {q.explanation && (
                                <div className="mt-4 p-4 sm:p-5 ml-6 sm:ml-8 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-900/30 text-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                            EXPLANATION
                                        </span>
                                    </div>
                                    <MathText className="prose prose-sm sm:prose-base max-w-none dark:prose-invert text-foreground/80" text={q.explanation} />
                                </div>
                            )}

                            {/* Tags / Meta Display (if present) */}
                            {(q.subject || q.chapter || q.topic || q.exam_code || q.year || q.difficulty || (q.tags && q.tags.length > 0)) && (
                                <div className="flex flex-wrap gap-2 mt-4 ml-6 sm:ml-8 pt-4 border-t border-border/40">
                                    {q.subject && <span className="text-[10px] sm:text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-full">{q.subject}</span>}
                                    {q.chapter && <span className="text-[10px] sm:text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-full">{q.chapter}</span>}
                                    {q.topic && <span className="text-[10px] sm:text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-full">{q.topic}</span>}
                                    {q.exam_code && <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">{q.exam_code}</span>}
                                    {q.year && <span className="text-[10px] sm:text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-full">{q.year}</span>}
                                    {q.tags && q.tags.map((t: string) => <span key={t} className="text-[10px] sm:text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-full">#{t}</span>)}
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            ))}'''

content = re.sub(question_display_regex, new_question_display, content, flags=re.DOTALL)

# Now fix the New Question Box layout and Add button
add_form_regex = r'\{activeForm && \(activeForm\.type === \'initial\' \|\| activeForm\.type === \'below\' \|\| activeForm\.type === \'above\'\) && \(\n                 <div className="border border-primary\/40 shadow-sm overflow-hidden rounded-\[30px\] my-6 bg-card">\n                    <div className="p-6 border-b border-border flex items-center justify-between">\n                        <h2 className="text-xl font-bold flex items-center gap-2 text-primary">\n                            <Plus className="h-5 w-5" \/> New Question\n                        <\/h2>\n                        <Button variant="ghost" size="sm" onClick=\{.*?\}>Cancel<\/Button>\n                    <\/div>\n                    <div className="p-6 md:p-8 space-y-6 bg-card">\n                        <QuestionEditor.*?<\/div>\n                <\/div>\n            \)\}'

new_add_form = '''{activeForm && (activeForm.type === 'initial' || activeForm.type === 'below' || activeForm.type === 'above') && (
                 <div className="border border-primary/30 shadow-sm overflow-hidden rounded-[30px] my-6 bg-card max-w-2xl mx-auto w-full">
                    <div className="px-5 sm:px-6 py-4 border-b border-border/50 flex items-center justify-between bg-secondary/10">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
                            <Plus className="h-4 w-4" /> New Question
                        </h2>
                        <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={() => setActiveForm(null)}>Cancel</Button>
                    </div>
                    <div className="p-4 sm:p-6 bg-card">
                        <QuestionEditor
                            data={activeForm.data}
                            onChange={(newData) => setActiveForm(prev => prev ? { ...prev, data: newData } : null)}
                            onSave={handleSaveQuestion}
                            onCancel={() => setActiveForm(null)}
                        />
                    </div>
                </div>
            )}'''

content = re.sub(add_form_regex, new_add_form, content, flags=re.DOTALL)

add_button_regex = r'\{!activeForm && questions\.length > 0 && \(\n                <div className="flex justify-center mt-6">\n                    <Button onClick=\{.*?\} className="shadow-sm rounded-full px-8">\n                        <Plus className="mr-2 h-4 w-4" \/> Add Another Question\n                    <\/Button>\n                <\/div>\n            \)\}'

new_add_button = '''{!activeForm && questions.length > 0 && (
                <div className="flex justify-center mt-6 max-w-2xl mx-auto w-full">
                    <Button onClick={() => handleShowForm(questions.length - 1, 'below')} className="shadow-md rounded-full px-8 h-12 text-base transition-transform hover:-translate-y-0.5 w-full sm:w-auto">
                        <Plus className="mr-2 h-5 w-5" /> Add New Question
                    </Button>
                </div>
            )}'''

content = re.sub(add_button_regex, new_add_button, content, flags=re.DOTALL)

# Fix outer layout container grid sizes
outer_layout_regex = r'<div className="grid lg:grid-cols-12 gap-6 w-full h-full max-w-full">\n        <div className="lg:col-span-7 xl:col-span-8 h-full flex flex-col space-y-6 lg:overflow-y-auto pr-2 pb-8 lg:pb-24 relative">'
new_outer_layout = '''<div className="grid lg:grid-cols-12 gap-0 lg:gap-6 w-full h-full max-w-full">
        <div className="lg:col-span-7 xl:col-span-8 h-full flex flex-col space-y-6 lg:overflow-y-auto pb-8 lg:pb-24 relative px-0 sm:px-2">'''

content = re.sub(outer_layout_regex, new_outer_layout, content, flags=re.DOTALL)

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'w') as f:
    f.write(content)
