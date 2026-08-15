import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Status = { label: string; value: string; ok: boolean | null };

// Visual debug page for diagnosing why push notifications aren't arriving —
// shows permission state, service worker status, and subscription info
// directly on screen so this can be checked from a phone with no devtools.
export default function PushDebug() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string | null>(null);

  const runChecks = async () => {
    setLoading(true);
    const results: Status[] = [];

    results.push({
      label: "Notification API সাপোর্ট",
      value: "Notification" in window ? "আছে" : "নেই",
      ok: "Notification" in window,
    });

    if ("Notification" in window) {
      const perm = Notification.permission;
      results.push({
        label: "Permission স্ট্যাটাস",
        value: perm,
        ok: perm === "granted",
      });
    }

    results.push({
      label: "Service Worker সাপোর্ট",
      value: "serviceWorker" in navigator ? "আছে" : "নেই",
      ok: "serviceWorker" in navigator,
    });

    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        results.push({
          label: "SW Registration",
          value: reg ? `scope: ${reg.scope}` : "কোনো registration নেই",
          ok: !!reg,
        });
        if (reg) {
          results.push({
            label: "SW Active অবস্থা",
            value: reg.active ? reg.active.state : "active নেই",
            ok: reg.active?.state === "activated",
          });

          const sub = await reg.pushManager.getSubscription();
          results.push({
            label: "Push Subscription (browser)",
            value: sub ? "আছে ✓" : "নেই ✗",
            ok: !!sub,
          });

          if (sub) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: dbSub } = await supabase
                .from("push_subscriptions")
                .select("id, created_at")
                .eq("user_id", user.id)
                .eq("endpoint", sub.endpoint)
                .maybeSingle();
              results.push({
                label: "Database এ সেভ আছে কিনা",
                value: dbSub ? `আছে (id: ${dbSub.id.slice(0, 8)}...)` : "নেই — সেভ হয়নি!",
                ok: !!dbSub,
              });
            } else {
              results.push({ label: "Login স্ট্যাটাস", value: "Login করা নেই", ok: false });
            }
          }
        }
      } catch (e: any) {
        results.push({ label: "SW চেক এরর", value: String(e?.message || e), ok: false });
      }
    }

    setStatuses(results);
    setLoading(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const sendTestNotification = async () => {
    setTestResult("পাঠানো হচ্ছে...");
    try {
      if (!("Notification" in window) || Notification.permission !== "granted") {
        setTestResult("Permission granted নেই — আগে Allow করুন");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setTestResult("Service worker registration পাওয়া যায়নি");
        return;
      }
      // Local test notification — bypasses the push server entirely, tests
      // only whether THIS device/browser can display a notification at all.
      await reg.showNotification("লোকাল টেস্ট", {
        body: "এটা দেখতে পেলে notification display কাজ করছে (push delivery আলাদা বিষয়)",
        icon: "/pwa-192x192.png",
      });
      setTestResult("লোকাল নোটিফিকেশন পাঠানো হয়েছে — দেখতে পেলেন কিনা চেক করুন");
    } catch (e: any) {
      setTestResult(`এরর: ${String(e?.message || e)}`);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Push Notification Debug</h1>

      {loading ? (
        <p>চেক করা হচ্ছে...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {statuses.map((s, i) => (
            <div
              key={i}
              style={{
                padding: 12,
                borderRadius: 8,
                background: s.ok === true ? "#e6f9ec" : s.ok === false ? "#fde8e8" : "#f0f0f0",
                border: `1px solid ${s.ok === true ? "#4caf50" : s.ok === false ? "#f44336" : "#ccc"}`,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</div>
              <div style={{ fontSize: 13, marginTop: 2, wordBreak: "break-all" }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={runChecks}
        style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, background: "#333", color: "#fff", border: "none", width: "100%" }}
      >
        আবার চেক করুন
      </button>

      <button
        onClick={sendTestNotification}
        style={{ marginTop: 8, padding: "10px 16px", borderRadius: 8, background: "#0066cc", color: "#fff", border: "none", width: "100%" }}
      >
        লোকাল টেস্ট নোটিফিকেশন পাঠান
      </button>

      {testResult && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#fff3cd", fontSize: 13 }}>
          {testResult}
        </div>
      )}
    </div>
  );
}
