import re

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'r') as f:
    content = f.read()

# Remove the old HTML sanitization and processing logic that's still around
# In case the first regex script failed on parts
content = re.sub(r'const sanitizeHtml = .*?;\n};\n', '', content, flags=re.DOTALL)
content = re.sub(r'const base64ToBlob = .*?;\n};\n', '', content, flags=re.DOTALL)
content = re.sub(r'const uploadImage = .*?;\n};\n', '', content, flags=re.DOTALL)
content = re.sub(r'const processHtmlContent = .*?;\n};\n', '', content, flags=re.DOTALL)

# Refactor the main return statement of ExamCreator component
# to match the new 30px rounded corners design without absolute positioning popups

# Find the active form section
active_form_regex = r'\{\/\* Active Form \*\/.*?\{\/\* Questions List \*\/\}\n'
new_active_form = '''
        {/* Questions List */}
'''
content = re.sub(active_form_regex, new_active_form, content, flags=re.DOTALL)

# Find questions map section
questions_map_regex = r'\{questions\.map\(\(q, i\) => \(.*?\{\/\* Add Below Button \*\/.*?<\/div>\n            \)\)\}'

new_questions_map = '''{questions.map((q, i) => (
                <div key={i} className="group relative border border-border/50 hover:border-primary/30 pb-6 mb-6 transition-colors rounded-[30px] p-6 bg-card shadow-sm">
                    {/* Inline Form Edit Mode */}
                    {activeForm && activeForm.index === i && activeForm.type === 'edit' ? (
                         <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4 border-b pb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                                    <Edit2 className="h-5 w-5" /> Edit Question {i + 1}
                                </h2>
                                <Button variant="ghost" size="sm" onClick={() => setActiveForm(null)}>Cancel</Button>
                            </div>
                            <QuestionEditor
                                data={activeForm.data}
                                onChange={(newData) => setActiveForm(prev => prev ? { ...prev, data: newData } : null)}
                                onSave={handleSaveQuestion}
                                onCancel={() => setActiveForm(null)}
                            />
                         </div>
                    ) : (
                    <div className="relative">
                        <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                                <Button size="sm" variant="outline" className="h-8 shadow-sm bg-background rounded-full" onClick={() => handleShowForm(i, 'edit')}>
                                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="destructive" className="h-8 shadow-sm rounded-full" onClick={() => handleDeleteQuestion(i)}>
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                                </Button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <span className="font-bold text-lg leading-tight mt-[2px]">{i + 1}.</span>
                                <MathText className="prose prose-sm md:prose-base max-w-none dark:prose-invert" text={q.question} />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 pl-6">
                                {Object.entries(q.options).map(([key, val]) => (
                                    <div
                                        key={key}
                                        className={`relative p-2 rounded-xl transition-all duration-200 flex gap-3 items-start ${
                                            q.correct_answer === key
                                            ? 'bg-green-50 dark:bg-green-900/20 font-medium'
                                            : 'hover:bg-muted/30'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2 pt-0.5">
                                            <span className={`text-sm font-bold shrink-0 ${
                                                q.correct_answer === key
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-muted-foreground'
                                            }`}>
                                                {key})
                                            </span>
                                            <div className="prose prose-sm max-w-none dark:prose-invert break-words overflow-hidden">
                                                <MathText text={String(val)} />
                                            </div>
                                        </div>
                                        {q.correct_answer === key && (
                                            <div className="absolute -top-2 -right-2">
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-green-600 px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                                                    <Check className="h-3 w-3" />
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {q.explanation && (
                                <div className="mt-4 p-4 ml-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 text-sm">
                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Explanation
                                    </p>
                                    <MathText className="prose prose-sm max-w-none dark:prose-invert" text={q.explanation} />
                                </div>
                            )}

                            {/* Tags / Meta Display (if present) */}
                            {(q.subject || q.chapter || q.topic || q.exam_code || q.year || q.difficulty) && (
                                <div className="flex flex-wrap gap-2 mt-4 ml-6 pt-3 border-t border-border/50">
                                    {q.subject && <span className="text-xs bg-muted px-2 py-1 rounded-md">{q.subject}</span>}
                                    {q.chapter && <span className="text-xs bg-muted px-2 py-1 rounded-md">{q.chapter}</span>}
                                    {q.topic && <span className="text-xs bg-muted px-2 py-1 rounded-md">{q.topic}</span>}
                                    {q.exam_code && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">{q.exam_code}</span>}
                                    {q.year && <span className="text-xs bg-muted px-2 py-1 rounded-md">{q.year}</span>}
                                    {q.difficulty && <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-1 rounded-md">{q.difficulty}</span>}
                                    {q.tags && q.tags.map((t: string) => <span key={t} className="text-xs bg-secondary px-2 py-1 rounded-md">#{t}</span>)}
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            ))}'''
content = re.sub(questions_map_regex, new_questions_map, content, flags=re.DOTALL)

# Add the "Add New Question" box at the bottom (or inline if creating)
bottom_form_regex = r'<\/div>\n        <\/div>\n\n        <div className="lg:col-span-5'
new_bottom_form = '''
            {activeForm && (activeForm.type === 'initial' || activeForm.type === 'below' || activeForm.type === 'above') && (
                 <div className="border border-primary/40 shadow-sm overflow-hidden rounded-[30px] my-6 bg-card">
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                            <Plus className="h-5 w-5" /> New Question
                        </h2>
                        <Button variant="ghost" size="sm" onClick={() => setActiveForm(null)}>Cancel</Button>
                    </div>
                    <div className="p-6 md:p-8 space-y-6 bg-card">
                        <QuestionEditor
                            data={activeForm.data}
                            onChange={(newData) => setActiveForm(prev => prev ? { ...prev, data: newData } : null)}
                            onSave={handleSaveQuestion}
                            onCancel={() => setActiveForm(null)}
                        />
                    </div>
                </div>
            )}

            {!activeForm && questions.length > 0 && (
                <div className="flex justify-center mt-6">
                    <Button onClick={() => handleShowForm(questions.length - 1, 'below')} className="shadow-sm rounded-full px-8">
                        <Plus className="mr-2 h-4 w-4" /> Add Another Question
                    </Button>
                </div>
            )}
        </div>
        </div>

        <div className="lg:col-span-5'''
content = re.sub(bottom_form_regex, new_bottom_form, content, flags=re.DOTALL)


with open('src/pages/dashboard/admin/ExamCreator.tsx', 'w') as f:
    f.write(content)
