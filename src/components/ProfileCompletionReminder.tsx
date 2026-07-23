import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Routes where an exam is actively being taken — never interrupt these with
// a reminder toast (both the dashboard-protected and public guest-accessible
// paths).
const EXAM_ROUTE_PATTERNS = [/^\/dashboard\/take-exam\//, /^\/take-exam\//];

function isOnExamPage(pathname: string): boolean {
  return EXAM_ROUTE_PATTERNS.some((re) => re.test(pathname));
}

/**
 * Nudges a logged-in student to finish their profile (gender + photo) if
 * either is missing, once every 30 minutes, on any page except while an
 * exam is actively being taken. Mounted once in DashboardLayout.
 */
export default function ProfileCompletionReminder() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const showReminderIfNeeded = () => {
      if (isOnExamPage(window.location.pathname)) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = profile as any;
      if (!p) return;

      const missingGender = !p.gender;
      const missingPhoto = !p.avatar_url;
      if (!missingGender && !missingPhoto) return;

      const target = missingPhoto ? "photo" : "gender";
      const label = missingPhoto && missingGender
        ? "ছবি ও Gender তথ্য"
        : missingPhoto
          ? "প্রোফাইল ছবি"
          : "Gender তথ্য";

      toast({
        title: "প্রোফাইল তথ্য অসম্পূর্ণ",
        description: `তোমার ${label} এখনো দেওয়া হয়নি। এখনই যোগ করে নাও।`,
        duration: 12000,
        action: (
          <ToastAction
            altText="প্রোফাইল সম্পূর্ণ করো"
            onClick={() => navigate(`/dashboard/profile?complete=${target}`)}
          >
            এখনই দাও
          </ToastAction>
        ),
      });
    };

    // First check shortly after mount, then every 30 minutes.
    const initialTimer = setTimeout(showReminderIfNeeded, 5000);
    intervalRef.current = setInterval(showReminderIfNeeded, REMINDER_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  return null;
}
