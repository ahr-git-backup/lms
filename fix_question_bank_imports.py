import re

with open('src/components/admin/QuestionBankSelector.tsx', 'r') as f:
    content = f.read()

# Add missing import back
replacement = """import { QuestionData } from "@/types/exam";
import { useGlobalMetadata } from "@/hooks/useGlobalMetadata";
"""
content = re.sub(r'import { QuestionData } from "@/types/exam";\n', replacement, content)

# Remove the unused useGlobalMetadata hook completely since we don't actually use it in the new flow
# The old flow used it for Select dropdowns. The new one reads from "exams" table
content = re.sub(r'\s*// Global Metadata Hook \(for subjects\)\n\s*// eslint-disable-next-line @typescript-eslint/no-explicit-any\n\s*const \{ data: globalMeta \} = useGlobalMetadata\(\) as any;\n', '', content)

with open('src/components/admin/QuestionBankSelector.tsx', 'w') as f:
    f.write(content)

print("Fixed QuestionBankSelector imports")
