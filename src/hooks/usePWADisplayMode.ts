import { useEffect, useState } from "react";

/**
 * Detects whether the app is running as an installed PWA/TWA (standalone)
 * vs a normal browser tab (website). Use this to branch layout/design
 * between "app-like" and "website-like" experiences from the same codebase.
 */
function getIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari PWA flag
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mq || iosStandalone);
}

export function usePWADisplayMode() {
  const [isStandalone, setIsStandalone] = useState(getIsStandalone);

  useEffect(() => {
    const mql = window.matchMedia("(display-mode: standalone)");
    const handler = () => setIsStandalone(getIsStandalone());
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  return isStandalone;
}
