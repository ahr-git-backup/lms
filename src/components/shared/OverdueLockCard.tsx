import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import { PayDueDialog } from "@/components/PayDueDialog";
import type { OverdueCourseInfo } from "@/hooks/useOverdueEnrollments";

/**
 * Full-page "content locked" card for a specific overdue course — shown
 * wherever a student tries to actually USE overdue content (open a class,
 * start an exam). Same message everywhere so a student sees one consistent
 * explanation no matter where they hit the lock.
 */
export function OverdueLockCard({ overdue }: { overdue: OverdueCourseInfo }) {
  const [payDueOpen, setPayDueOpen] = useState(false);
  const remaining = overdue.dueAmount - overdue.amountPaid;

  return (
    <div className="p-8 max-w-2xl mx-auto text-center space-y-6">
      <div className="p-6 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-300 text-red-700 dark:text-red-400 space-y-2">
        <h2 className="text-xl font-bold mb-2">বকেয়া পেমেন্টের কারণে অ্যাক্সেস বন্ধ</h2>
        <p>"{overdue.courseName}" কোর্সের বাকি টাকা পরিশোধের নির্ধারিত তারিখ পার হয়ে গেছে।</p>
        <p className="flex justify-center gap-2"><span>বাকি টাকা:</span><strong>৳{remaining}</strong></p>
        <p className="flex justify-center gap-2">
          <span>দেওয়ার শেষ তারিখ ছিল:</span>
          <strong>{new Date(overdue.dueDate).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" })}</strong>
        </p>
        {overdue.daysPast > 0 && (
          <p className="font-semibold">{overdue.daysPast} দিন পার হয়ে গেছে</p>
        )}
        <p className="text-sm mt-2">বাকি টাকা পরিশোধ করলেই আবার এক্সেস চালু হয়ে যাবে।</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button onClick={() => setPayDueOpen(true)}>বাকি টাকা পরিশোধ করুন</Button>
        <WhatsAppSupportButton message="আমার কোর্সের বাকি টাকা নিয়ে সমস্যা আছে।" />
      </div>
      <PayDueDialog
        open={payDueOpen}
        onClose={() => setPayDueOpen(false)}
        paymentRequestId={overdue.paymentRequestId}
        remainingDue={remaining}
        courseName={overdue.courseName}
      />
    </div>
  );
}
