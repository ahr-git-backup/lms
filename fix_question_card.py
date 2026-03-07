import re

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'r') as f:
    content = f.read()

# Make question item card styling perfectly match the screenshot

# The card should be rounded-[30px] (mobile or desktop).
# The correct option background is a subtle light green (`bg-[#f2fcf5]` or similar), text is dark.
# The checkmark sits nicely aligned.
# Explanation uses a subtle blue.

question_card_regex = r'<div key=\{i\} className="group relative border border-border\/40 hover:border-primary\/20 pb-6 mb-5 transition-colors rounded-\[24px\] p-4 sm:p-6 bg-card shadow-sm w-full">.*?\{activeForm && activeForm\.index === i && activeForm\.type === \'edit\' \? \('

new_question_card = '''<div key={i} className="group relative border border-border/40 hover:border-border/80 pb-6 mb-5 transition-all rounded-[30px] p-5 sm:p-7 bg-card shadow-sm w-full">
                    {/* Inline Form Edit Mode */}
                    {activeForm && activeForm.index === i && activeForm.type === 'edit' ? ('''

content = re.sub(question_card_regex, new_question_card, content, flags=re.DOTALL)

# Refine options display
options_regex = r'<div className="flex flex-col gap-2 pl-6 sm:pl-8">.*?<\/div>\n\n                            \{q\.explanation && \('
new_options = '''<div className="flex flex-col gap-2 pl-5 sm:pl-7 mt-3">
                                {Object.entries(q.options).map(([key, val]) => {
                                    const isCorrect = q.correct_answer === key;
                                    return (
                                        <div
                                            key={key}
                                            className={`relative p-3 rounded-2xl transition-all duration-200 flex gap-3 items-start border-transparent ${
                                                isCorrect
                                                ? 'bg-[#f0fdf4] dark:bg-green-900/10'
                                                : 'hover:bg-secondary/30'
                                            }`}
                                        >
                                            <div className="flex items-start gap-2 pt-0.5">
                                                <span className={`text-[15px] sm:text-[16px] font-bold shrink-0 ${
                                                    isCorrect
                                                    ? 'text-[#2BA25C]'
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
                                                    <div className="bg-[#2BA25C] rounded-full p-[3px] shadow-sm">
                                                        <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {q.explanation && ('''

content = re.sub(options_regex, new_options, content, flags=re.DOTALL)

# Refine explanation display
explanation_regex = r'<div className="mt-4 p-4 sm:p-5 ml-6 sm:ml-8 bg-blue-50\/50 dark:bg-blue-900\/10 rounded-2xl border border-blue-100\/50 dark:border-blue-900\/30 text-sm">\n                                    <div className="flex items-center gap-2 mb-3">\n                                        <span className="w-1\.5 h-1\.5 rounded-full bg-blue-500"><\/span> \n                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">\n                                            EXPLANATION\n                                        <\/span>\n                                    <\/div>\n                                    <MathText className="prose prose-sm sm:prose-base max-w-none dark:prose-invert text-foreground\/80" text=\{q\.explanation\} \/>\n                                <\/div>'

new_explanation = '''<div className="mt-5 p-4 sm:p-5 ml-5 sm:ml-7 bg-[#f8fafc] dark:bg-slate-900/30 rounded-[20px] border border-[#e2e8f0]/80 dark:border-slate-800/50 text-sm">
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] shadow-[0_0_4px_rgba(59,130,246,0.6)]"></div>
                                        <span className="text-[11px] font-bold text-[#3b82f6] uppercase tracking-[0.15em]">
                                            Explanation
                                        </span>
                                    </div>
                                    <MathText className="prose prose-sm sm:prose-base max-w-none dark:prose-invert text-foreground/85 leading-relaxed" text={q.explanation} />
                                </div>'''

content = re.sub(explanation_regex, new_explanation, content, flags=re.DOTALL)

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'w') as f:
    f.write(content)
