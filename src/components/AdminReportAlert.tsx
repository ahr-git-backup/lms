import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AlertCircle } from "lucide-react";

// Popup alert for admins/teachers when there are pending question reports.
// Re-checks every 5 minutes while the admin is active. A report row is deleted
// once resolved/declined, so "new" is tracked by remembering which report IDs
// the admin has already been shown a popup for (in localStorage) — a genuinely
// new report re-triggers the popup even if older ones are still pending.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const SEEN_KEY = "admin_seen_report_ids";

const getSeenIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveSeenIds = (ids: string[]) => {
  localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-500)));
};

export const AdminReportAlert = () => {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [open, setOpen] = useState(false);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("mousemove", markActive);
    window.addEventListener("keydown", markActive);
    window.addEventListener("click", markActive);
    window.addEventListener("touchstart", markActive);
    return () => {
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("click", markActive);
      window.removeEventListener("touchstart", markActive);
    };
  }, []);

  useEffect(() => {
    const checkPending = async () => {
      const isActive = document.visibilityState === "visible" && Date.now() - lastActivityRef.current < 15 * 60 * 1000;
      if (!isActive) return;

      const { data, error } = await supabase.from("question_reports").select("id");
      if (error) return;

      const allIds = (data || []).map((r) => r.id as string);
      setPendingCount(allIds.length);
      if (allIds.length === 0) return;

      const seenIds = new Set(getSeenIds());
      const freshIds = allIds.filter((id) => !seenIds.has(id));

      if (freshIds.length > 0) {
        setNewCount(freshIds.length);
        setOpen(true);
      }
    };

    checkPending();
    const interval = setInterval(checkPending, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleView = async () => {
    setOpen(false);
    // Mark everything currently pending as "seen" so we only alert again for
    // genuinely new reports going forward.
    const { data } = await supabase.from("question_reports").select("id");
    const allIds = (data || []).map((r) => r.id as string);
    saveSeenIds(Array.from(new Set([...getSeenIds(), ...allIds])));
    navigate("/admin/reports");
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            নতুন প্রশ্ন রিপোর্ট এসেছে
          </AlertDialogTitle>
          <AlertDialogDescription>
            {newCount > 1 ? `${newCount}টি নতুন` : "একটি নতুন"} প্রশ্ন রিপোর্ট এসেছে। মোট {pendingCount}টি রিপোর্ট এখনো অমীমাংসিত আছে। দেখতে নিচে ক্লিক করুন।
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleView}>দেখুন</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
