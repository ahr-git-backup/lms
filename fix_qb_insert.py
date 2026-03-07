import re

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'r') as f:
    content = f.read()

# I noticed the previous script completely wiped out the {showBankSelector && ...} block
# because it was looking for a specific regex that didn't match the new header.
# Let's insert it right after the header's closing div.

# Find the end of the header block. It ends right before {/* Questions List */}
insert_regex = r'<\/Button>\n            <\/div>\n        <\/div>\n\n        \n        \{\/\* Questions List \*\/\}'

new_insert = '''</Button>
            </div>
        </div>

        {/* Collapsible Question Bank */}
        {showBankSelector && (
            <div className="border border-border/60 rounded-[30px] bg-card p-5 sm:p-7 shadow-sm h-[700px] flex flex-col w-full mx-auto max-w-2xl animate-in fade-in slide-in-from-top-4 duration-300 mt-4 mb-2">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50 shrink-0">
                     <h3 className="font-bold text-xl flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" /> Select from Question Bank
                     </h3>
                     <Button variant="ghost" size="icon" onClick={() => setShowBankSelector(false)} className="rounded-full h-8 w-8 hover:bg-secondary">
                        <Trash2 className="h-4 w-4" />
                     </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <QuestionBankSelector onSelect={handleBankImport} />
                </div>
            </div>
        )}

        {/* Questions List */}'''

content = re.sub(insert_regex, new_insert, content, flags=re.DOTALL)

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'w') as f:
    f.write(content)
