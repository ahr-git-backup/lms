import re

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'r') as f:
    content = f.read()

# Fix the main wrapper to reduce left and right gap to 5-8px
outer_wrapper_regex = r'<div className="min-h-screen lg:h-\[calc\(100vh-4rem\)\] bg-background p-4 md:p-6 font-sans lg:overflow-hidden">'
new_outer_wrapper = '<div className="min-h-screen lg:h-[calc(100vh-4rem)] bg-background px-1.5 py-4 md:px-2 md:py-6 font-sans lg:overflow-hidden">'
content = re.sub(outer_wrapper_regex, new_outer_wrapper, content, flags=re.DOTALL)

# Adjust the inner wrapper for full width
inner_wrapper_regex = r'<div className="grid lg:grid-cols-12 gap-0 lg:gap-6 w-full h-full max-w-full">\n        <div className="lg:col-span-7 xl:col-span-8 h-full flex flex-col space-y-6 lg:overflow-y-auto pb-8 lg:pb-24 relative px-0 sm:px-2">'
new_inner_wrapper = '''<div className="w-full h-full max-w-3xl mx-auto flex flex-col space-y-4 lg:overflow-y-auto pb-8 lg:pb-24 relative">'''
content = re.sub(inner_wrapper_regex, new_inner_wrapper, content, flags=re.DOTALL)

# Remove the trailing div tags for the grid layout at the bottom
end_grid_regex = r'<\/div>\n        <\/div>\n\n        <div className="lg:col-span-5 xl:col-span-4 h-\[700px\] lg:h-\[calc\(100vh-8rem\)\] lg:sticky lg:top-0">\n            <QuestionBankSelector onSelect=\{handleBankImport\} \/>\n        <\/div>\n      <\/div>'
new_end_grid = '''</div>\n      </div>'''
content = re.sub(end_grid_regex, new_end_grid, content, flags=re.DOTALL)


# Redesign Header and Add Collapsible Question Bank
header_regex = r'<div className="flex flex-col gap-5 rounded-\[20px\] bg-card p-5 sm:p-6 shadow-sm border border-border\/60 max-w-2xl mx-auto w-full">.*?<\/div>\n        <\/div>\n\n        \{\/\* Questions List \*\/\}'

new_header = '''<div className="flex flex-col gap-4 rounded-[20px] bg-card p-5 shadow-sm border border-border/60 w-full">
            <div className="flex items-start gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-1 rounded-full h-8 w-8 text-foreground hover:bg-secondary shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-green-600 leading-none">
                        Quiz Maker<br/>Studio
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-tight">
                        {examId ? `Editing: ${examTitle}` : "Create, edit, and export professional quiz questions"}
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-2.5 mt-2 w-full sm:max-w-sm">
                <Input
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    className="w-full font-medium h-11 rounded-full px-5 text-sm border-border/60 focus-visible:ring-1"
                    placeholder="New Exam"
                    disabled={!!examId}
                />

                {examId ? (
                    <div className="flex gap-2 w-full">
                        <Button
                            onClick={handleSaveToDatabase}
                            disabled={isSaving}
                            variant="outline"
                            className="flex-1 rounded-full h-10 border-border/60 hover:bg-secondary justify-start px-5 text-sm"
                        >
                            {isSaving ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Database className="mr-3 h-4 w-4" />}
                            Save
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReplaceAllQuestions}
                            disabled={isSaving}
                            title="Replace All"
                            className="rounded-full h-10 w-10 p-0 shrink-0"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                    </div>
                ) : (
                    <Button variant="outline" onClick={handleExport} className="w-full rounded-full h-10 border-border/60 hover:bg-secondary justify-start px-5 text-sm">
                        <Download className="mr-3 h-4 w-4" /> Export JSON
                    </Button>
                )}

                <div className="relative w-full">
                    <Button variant="outline" onClick={() => document.getElementById('impf')?.click()} className="w-full rounded-full h-10 border-border/60 hover:bg-secondary justify-start px-5 text-sm">
                        <Upload className="mr-3 h-4 w-4" /> Import File
                    </Button>
                    <input type="file" id="impf" className="hidden" accept=".json,.csv" onChange={handleImport} />
                </div>

                <div className="flex gap-2 w-full items-center">
                    <Button
                        variant="outline"
                        onClick={() => setShowBankSelector(!showBankSelector)}
                        className={`flex-1 rounded-full h-10 border-border/60 justify-start px-5 text-sm transition-colors ${showBankSelector ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20' : 'bg-secondary/30 hover:bg-secondary'}`}
                    >
                        <BookOpen className="mr-3 h-4 w-4" /> Question Bank
                    </Button>

                    <Button variant="destructive" size="icon" className="rounded-full h-10 w-10 shrink-0 bg-red-500 hover:bg-red-600 shadow-sm" onClick={() => {
                        if (confirm("Are you sure you want to clear all questions?")) setQuestions([]);
                    }}>
                        <Trash2 className="h-4 w-4 text-white" />
                    </Button>
                </div>
            </div>
        </div>

        {/* Collapsible Question Bank */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showBankSelector ? 'max-h-[800px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
            <div className="border border-border/60 rounded-[20px] bg-card p-4 shadow-sm h-[600px] sm:h-[700px] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 pb-2 border-b">
                     <h3 className="font-bold text-lg flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" /> Select from Bank
                     </h3>
                     <Button variant="ghost" size="sm" onClick={() => setShowBankSelector(false)} className="h-8 rounded-full">Close</Button>
                </div>
                <QuestionBankSelector onSelect={handleBankImport} />
            </div>
        </div>

        {/* Questions List */}'''

content = re.sub(header_regex, new_header, content, flags=re.DOTALL)

# Adjust container styles for questions to use max width better.
question_container_regex = r'<div key=\{i\} className="group relative border border-border\/40 hover:border-primary\/20 pb-6 mb-6 transition-colors rounded-\[30px\] p-5 sm:p-6 bg-card shadow-sm max-w-2xl mx-auto w-full">'
new_question_container = '<div key={i} className="group relative border border-border/40 hover:border-primary/20 pb-6 mb-5 transition-colors rounded-[24px] p-4 sm:p-6 bg-card shadow-sm w-full">'
content = re.sub(question_container_regex, new_question_container, content, flags=re.DOTALL)

add_form_container_regex = r'<div className="border border-primary\/30 shadow-sm overflow-hidden rounded-\[30px\] my-6 bg-card max-w-2xl mx-auto w-full">'
new_add_form_container = '<div className="border border-primary/30 shadow-sm overflow-hidden rounded-[24px] my-5 bg-card w-full">'
content = re.sub(add_form_container_regex, new_add_form_container, content, flags=re.DOTALL)

add_btn_container_regex = r'<div className="flex justify-center mt-6 max-w-2xl mx-auto w-full">'
new_add_btn_container = '<div className="flex justify-center mt-4 w-full">'
content = re.sub(add_btn_container_regex, new_add_btn_container, content, flags=re.DOTALL)

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'w') as f:
    f.write(content)
