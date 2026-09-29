import { useEnrollments } from "@/hooks/useEnrollments";

export interface OverdueCourseInfo {
  courseId: string;
  courseName: string;
  paymentRequestId: string;
  dueAmount: number;
  amountPaid: number;
  dueDate: string; // YYYY-MM-DD
  daysPast: number;
}

// Same today-string trick useEnrollments' query uses, so the day-count
// lines up with what actually gated access (date-only comparison, no
// timezone/time-of-day drift).
const daysPastDue = (dueDate: string): number => {
  const today = new Date().toISOString().slice(0, 10);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((new Date(today).getTime() - new Date(dueDate).getTime()) / msPerDay));
};

/**
 * Every enrollment the student currently has with a payment whose due_date
 * has passed (the same condition useEnrollments() already gates content
 * access on) — surfaced here so any page can show a consistent "বকেয়া
 * পেমেন্ট" warning with an accurate days-overdue count, instead of each
 * page inventing its own copy of this check.
 */
export const useOverdueEnrollments = () => {
  const { data: enrollments, ...rest } = useEnrollments();

  const overdue: OverdueCourseInfo[] = (enrollments || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((e: any) => e.is_payment_overdue && e.overdue_info)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e: any) => ({
      courseId: e.course_id,
      courseName: e.course?.name || "কোর্স",
      paymentRequestId: e.overdue_info.id,
      dueAmount: e.overdue_info.dueAmount,
      amountPaid: e.overdue_info.amountPaid,
      dueDate: e.overdue_info.dueDate,
      daysPast: daysPastDue(e.overdue_info.dueDate),
    }));

  return { overdueCourses: overdue, ...rest };
};
