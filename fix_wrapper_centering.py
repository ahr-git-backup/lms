import re

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'r') as f:
    content = f.read()

# Make sure all children of the main grid are wrapped inside the centered max-w-2xl
inner_wrapper_regex = r'<div className="w-full h-full max-w-3xl mx-auto flex flex-col space-y-4 lg:overflow-y-auto pb-8 lg:pb-24 relative">'
new_inner_wrapper = '''<div className="w-full h-full max-w-2xl mx-auto flex flex-col space-y-4 sm:space-y-6 lg:overflow-y-auto pb-8 lg:pb-24 relative px-1 sm:px-0">'''

content = re.sub(inner_wrapper_regex, new_inner_wrapper, content, flags=re.DOTALL)

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'w') as f:
    f.write(content)
