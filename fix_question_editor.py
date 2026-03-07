import re

with open('src/components/admin/QuestionEditor.tsx', 'r') as f:
    content = f.read()

# remove double export
content = content.replace("export { QuestionEditor };\nexport type { QuestionData };", "")

with open('src/components/admin/QuestionEditor.tsx', 'w') as f:
    f.write(content)
