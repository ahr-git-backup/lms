import re

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'r') as f:
    content = f.read()

# Replace the hidden overflow CSS trick with actual conditional rendering
# Because the QuestionBankSelector might be doing some complex layouting inside
# that breaks if it's rendered with height 0 or display hidden.

qb_regex = r'\{\/\* Collapsible Question Bank \*\/.*?\{\/\* Questions List \*\/\}'

new_qb = '''{/* Collapsible Question Bank */}
        {showBankSelector && (
            <div className="border border-border/60 rounded-[30px] bg-card p-5 shadow-sm h-[700px] flex flex-col w-full animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                     <h3 className="font-bold text-xl flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" /> Select from Question Bank
                     </h3>
                     <Button variant="ghost" size="icon" onClick={() => setShowBankSelector(false)} className="rounded-full h-8 w-8 hover:bg-secondary">
                        <Trash2 className="h-4 w-4" /> {/* Or X icon, using what we have imported */}
                     </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <QuestionBankSelector onSelect={handleBankImport} />
                </div>
            </div>
        )}

        {/* Questions List */}'''

content = re.sub(qb_regex, new_qb, content, flags=re.DOTALL)

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'w') as f:
    f.write(content)
