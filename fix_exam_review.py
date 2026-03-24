import re

with open("src/pages/dashboard/ExamReview.tsx", "r") as f:
    content = f.read()

# Instead of relying strictly on get_student_exam_review which blocks admins
# Admins can bypass the RPC and fetch questions directly from question_bank via exam_questions
# OR we can fallback: if qError AND isAdmin, fetch manually.

pattern = r"""      // 1\. Fetch questions securely via RPC
      const \{ data: qData, error: qError \} = await supabase\.rpc\("get_student_exam_review", \{
        p_attempt_id: attempt\.id
      \}\);

      if \(qError\) throw qError;"""

new_pattern = """      // 1. Fetch questions securely via RPC
      let qData: any[] = [];
      let qError: any = null;

      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_student_exam_review", {
        p_attempt_id: attempt.id
      });

      if (rpcErr && rpcErr.message.includes("Unauthorized") && isAdmin) {
         // Admin fallback: fetch questions manually since RPC blocks non-owners
         const { data: eqData } = await supabase
            .from("exam_questions")
            .select("question_index, question_id, question_bank(id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, explanation)")
            .eq("exam_id", attempt.exam_id)
            .order("question_index", { ascending: true });

         qData = eqData?.map((eq: any) => ({
             ...eq.question_bank,
             question_id: eq.question_id,
             question_index: eq.question_index
         })) || [];
      } else if (rpcErr) {
         throw rpcErr;
      } else {
         qData = rpcData || [];
      }"""

updated_content = re.sub(pattern, new_pattern, content)

with open("src/pages/dashboard/ExamReview.tsx", "w") as f:
    f.write(updated_content)

print("Updated ExamReview.tsx to fallback for admin")
