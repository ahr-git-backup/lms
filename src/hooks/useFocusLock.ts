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
export function useFocusLock(active: boolean) {
  const [leaves, setLeaves] = useState(0);
  const [awaySeconds, setAwaySeconds] = useState(0);
  const [justReturned, setJustReturned] = useState<{ secs: number } | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
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
      } else {
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

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
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
