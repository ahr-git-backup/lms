import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Focus Lock" — best-effort distraction blocker for a running study timer.
 *
 * Websites can NOT block the phone's Home button, recent-apps or notification bar (that is the OS's job),
 * so this does everything the web platform allows:
 *   - fullscreen (hides browser bars / tabs)
 *   - screen wake lock (screen never sleeps mid-session)
 *   - confirm before back / refresh / close
 *   - detects leaving the app/tab, and reports how many times + how long the user was away
 *
 * Every API is feature-detected and wrapped in try/catch, so on an unsupported browser the timer simply
 * works without that piece — the lock can never break the page.
 */
const NUDGE_AFTER_MS = 20_000;

async function showNudge(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      await reg.showNotification(title, { body, tag: "focus-lock-nudge", renotify: true, requireInteraction: false, data: { url: "/pomodoro" } } as NotificationOptions);
    } else {
      new Notification(title, { body, tag: "focus-lock-nudge" });
    }
  } catch {
    /* notifications unsupported/blocked — ignore */
  }
}

async function clearNudge() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    const list = await reg?.getNotifications?.({ tag: "focus-lock-nudge" });
    list?.forEach((n) => n.close());
  } catch {
    /* ignore */
  }
}

export function useFocusLock(active: boolean) {
  const [leaves, setLeaves] = useState(0);
  const [awaySeconds, setAwaySeconds] = useState(0);
  const [justReturned, setJustReturned] = useState<{ secs: number } | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalTitleRef = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRef = useRef<any>(null);

  const requestWake = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.wakeLock?.request) wakeRef.current = await nav.wakeLock.request("screen");
    } catch {
      /* not allowed / unsupported — ignore */
    }
  }, []);

  const releaseWake = useCallback(async () => {
    try {
      await wakeRef.current?.release?.();
    } catch {
      /* ignore */
    }
    wakeRef.current = null;
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* iOS Safari etc. don't support it — ignore */
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    void requestWake();
    void enterFullscreen();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        // If the user stays away, nudge them back with a notification (best effort).
        if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = setTimeout(() => {
          void showNudge("⚠️ ফোকাসে ফিরে আসুন!", "আপনার Pomodoro টাইমার চলছে — পড়াশোনায় ফিরে আসুন।");
        }, NUDGE_AFTER_MS);
      } else {
        if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
        void clearNudge();
        // Wake lock is auto-released when the page is hidden — take it again.
        void requestWake();
        const t = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (t) {
          const secs = Math.max(1, Math.round((Date.now() - t) / 1000));
          setLeaves((n) => n + 1);
          setAwaySeconds((s) => s + secs);
          setJustReturned({ secs });
        }
      }
    };

    // Confirm before refresh / close / navigating away.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    // Trap the Back button/swipe: push a dummy entry, and re-push whenever it is popped.
    const onPopState = () => {
      window.history.pushState({ focusLock: true }, "");
    };
    window.history.pushState({ focusLock: true }, "");

    originalTitleRef.current = document.title;
    let blink: ReturnType<typeof setInterval> | null = null;
    const onVisTitle = () => {
      if (document.visibilityState === "hidden") {
        let on = false;
        blink = setInterval(() => {
          on = !on;
          document.title = on ? "⚠️ ফোকাসে ফিরুন!" : originalTitleRef.current;
        }, 1000);
      } else {
        if (blink) clearInterval(blink);
        blink = null;
        document.title = originalTitleRef.current;
      }
    };
    document.addEventListener("visibilitychange", onVisTitle);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("visibilitychange", onVisTitle);
      if (blink) clearInterval(blink);
      if (originalTitleRef.current) document.title = originalTitleRef.current;
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
      void clearNudge();
      void releaseWake();
      void exitFullscreen();
    };
  }, [active, requestWake, releaseWake, enterFullscreen, exitFullscreen]);

  const resetStats = useCallback(() => {
    setLeaves(0);
    setAwaySeconds(0);
    setJustReturned(null);
  }, []);

  return { leaves, awaySeconds, justReturned, dismissReturned: () => setJustReturned(null), resetStats };
}
