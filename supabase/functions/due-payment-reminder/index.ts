// Runs once daily (via pg_cron, see the migration in this same commit).
// Finds approved payment_requests with an unpaid due_amount whose due_date
// is exactly 7, 3, or 1 day(s) away, and sends each student a push
// notification via send-push-v2 — once per bucket per payment_request
// (tracked in payment_requests.due_reminders_sent so re-running the cron
// on the same day, or a slow cron, never double-notifies).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUSH_API_KEY = Deno.env.get("PUSH_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUCKETS = [7, 3, 1]; // days left

function messageFor(daysLeft: number, dueAmount: number, courseName: string) {
  if (daysLeft === 1) {
    return {
      title: "⏰ আগামীকাল বকেয়া পরিশোধের শেষ তারিখ",
      body: `${courseName} কোর্সের বাকি ৳${dueAmount} আগামীকাল পরিশোধের শেষ তারিখ। সময়মতো পরিশোধ না করলে এক্সেস বন্ধ হয়ে যাবে।`,
    };
  }
  return {
    title: `⏳ বকেয়া পরিশোধের ${daysLeft} দিন বাকি`,
    body: `${courseName} কোর্সের বাকি ৳${dueAmount} পরিশোধের জন্য আর ${daysLeft} দিন বাকি আছে।`,
  };
}

Deno.serve(async () => {
  try {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);

    const results: Record<string, unknown>[] = [];

    for (const daysLeft of BUCKETS) {
      const targetDate = new Date(today);
      targetDate.setUTCDate(targetDate.getUTCDate() + daysLeft);
      const targetIso = targetDate.toISOString().slice(0, 10);

      const { data: payments, error } = await supabase
        .from("payment_requests")
        .select("id, profile_id, course_id, due_amount, due_date, due_reminders_sent, courses(name)")
        .eq("status", "approved")
        .gt("due_amount", 0)
        .eq("due_date", targetIso);

      if (error) {
        results.push({ daysLeft, error: error.message });
        continue;
      }

      // Only rows that haven't already gotten this exact bucket's reminder.
      const toNotify = (payments || []).filter(
        (p: any) => !Array.isArray(p.due_reminders_sent) || !p.due_reminders_sent.includes(daysLeft)
      );

      if (toNotify.length === 0) {
        results.push({ daysLeft, targetDate: targetIso, notified: 0 });
        continue;
      }

      // Group by (title, body) isn't practical since course name/amount vary
      // per student, so send one push per student (small volume expected —
      // only students whose due_date lands exactly on this day).
      let sent = 0;
      for (const p of toNotify as any[]) {
        const courseName = p.courses?.name || "আপনার কোর্স";
        const { title, body } = messageFor(daysLeft, p.due_amount, courseName);
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-v2`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey: PUSH_API_KEY,
              title,
              body,
              url: "/dashboard/my-courses",
              userIds: [p.profile_id],
            }),
          });
          const json = await res.json().catch(() => null);
          if (json?.success) sent++;
        } catch (e) {
          console.error(`[due-reminder] push failed for payment ${p.id}:`, e);
        }

        // Mark this bucket as sent regardless of push delivery outcome (a
        // failed push — e.g. no subscription — shouldn't retry forever;
        // the in-app locked-popup with exact due info still shows either way).
        const updatedBuckets = Array.from(new Set([...(p.due_reminders_sent || []), daysLeft]));
        await supabase
          .from("payment_requests")
          .update({ due_reminders_sent: updatedBuckets })
          .eq("id", p.id);
      }

      results.push({ daysLeft, targetDate: targetIso, notified: sent, total: toNotify.length });
    }

    return new Response(JSON.stringify({ success: true, today: todayIso, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
