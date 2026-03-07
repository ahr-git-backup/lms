import re

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'r') as f:
    content = f.read()

# Make sure imports are correct
import_add = """import React, { useEffect, useState } from "react";
"""
if "import { Plus" not in content:
    content = content.replace('import React, { useEffect, useState } from "react";', import_add)

# Make sure the save methods still work
# Fix upsert / export to use metadata
upsert_regex = r'const upsertData = questions\.map\(\(q, idx\) => \(\{.*?\n              marks: 1\n          \}\)\);'
new_upsert = '''const upsertData = questions.map((q, idx) => ({
              ...(q.id ? { id: q.id } : {}), // Only include ID if it exists (update)
              exam_id: examId,
              question_index: idx + 1, // Ensure sequential indexing
              question_text: q.question,
              option_a: q.options.A,
              option_b: q.options.B,
              option_c: q.options.C,
              option_d: q.options.D,
              correct_option: q.correct_answer,
              explanation: q.explanation,
              marks: 1,
              subject: q.subject || null,
              chapter: q.chapter || null,
              topic: q.topic || null,
              exam_code: q.exam_code || null,
              year: q.year || null,
              difficulty: q.difficulty || null,
              tags: q.tags || []
          }));'''
content = re.sub(upsert_regex, new_upsert, content, flags=re.DOTALL)

insert_regex = r'const insertData = questions\.map\(\(q, idx\) => \(\{.*?\n              marks: 1\n          \}\)\);'
new_insert = '''const insertData = questions.map((q, idx) => ({
              exam_id: examId,
              question_index: idx + 1,
              question_text: q.question,
              option_a: q.options.A,
              option_b: q.options.B,
              option_c: q.options.C,
              option_d: q.options.D,
              correct_option: q.correct_answer,
              explanation: q.explanation,
              marks: 1,
              subject: q.subject || null,
              chapter: q.chapter || null,
              topic: q.topic || null,
              exam_code: q.exam_code || null,
              year: q.year || null,
              difficulty: q.difficulty || null,
              tags: q.tags || []
          }));'''
content = re.sub(insert_regex, new_insert, content, flags=re.DOTALL)

# Update the fetch mapping
fetch_regex = r'const loaded = refreshedData\.map\(\(q: any\) => \(\{.*?\n             \}\)\);'
new_fetch = '''const loaded = refreshedData.map((q: any) => ({
                id: q.id,
                question: q.question_text,
                options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
                correct_answer: q.correct_option,
                explanation: q.explanation || "",
                subject: q.subject || "",
                chapter: q.chapter || "",
                topic: q.topic || "",
                exam_code: q.exam_code || "",
                year: q.year || "",
                difficulty: q.difficulty || "",
                tags: q.tags || []
             }));'''
content = re.sub(fetch_regex, new_fetch, content, flags=re.DOTALL)

fetch2_regex = r'const loadedQuestions = qData\.map\(\(q: any\) => \(\{.*?\n                \}\)\);'
new_fetch2 = '''const loadedQuestions = qData.map((q: any) => ({
                    id: q.id,
                    question: q.question_text,
                    options: {
                        A: q.option_a,
                        B: q.option_b,
                        C: q.option_c,
                        D: q.option_d,
                    },
                    correct_answer: q.correct_option,
                    explanation: q.explanation || "",
                    subject: q.subject || "",
                    chapter: q.chapter || "",
                    topic: q.topic || "",
                    exam_code: q.exam_code || "",
                    year: q.year || "",
                    difficulty: q.difficulty || "",
                    tags: q.tags || []
                }));'''
content = re.sub(fetch2_regex, new_fetch2, content, flags=re.DOTALL)

with open('src/pages/dashboard/admin/ExamCreator.tsx', 'w') as f:
    f.write(content)
