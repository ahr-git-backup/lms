import re

with open("src/pages/dashboard/ExamReview.tsx", "r") as f:
    content = f.read()

# Enhance the rpc check because Supabase errors might just say 'Unauthorized'
# or maybe we can just query directly if isAdmin
pattern = r"""      const \{ data: rpcData, error: rpcErr \} = await supabase\.rpc\("get_student_exam_review", \{
        p_attempt_id: attempt\.id
      \}\);

      if \(rpcErr && rpcErr\.message\.includes\("Unauthorized"\) && isAdmin\) \{"""

new_pattern = """      // If user is admin, directly query. Else use RPC.
      let rpcData: any = null;
      let rpcErr: any = null;
      if (!isAdmin) {
          const { data, error } = await supabase.rpc("get_student_exam_review", {
            p_attempt_id: attempt.id
          });
          rpcData = data;
          rpcErr = error;
      }

      if (isAdmin || (rpcErr && rpcErr.message.includes("Unauthorized") && isAdmin)) {"""

updated_content = re.sub(pattern, new_pattern, content)

with open("src/pages/dashboard/ExamReview.tsx", "w") as f:
    f.write(updated_content)

print("Updated ExamReview.tsx to fetch directly for admin")
