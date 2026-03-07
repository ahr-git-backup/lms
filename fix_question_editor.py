import re

with open('src/components/admin/QuestionEditor.tsx', 'r') as f:
    content = f.read()

# Replace old imports logic with what was actually needed
if "import { ExpandableRichTextEditor } from" in content:
    content = content.replace('import { ExpandableRichTextEditor } from "@/components/ui/expandable-rich-text-editor";\n', '')

with open('src/components/admin/QuestionEditor.tsx', 'w') as f:
    f.write(content)
