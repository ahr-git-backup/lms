import { useEffect, useState } from "react";

/**
 * Synchronous, one-shot check for installed PWA/TWA (standalone) mode.
 * Safe to call at module load time (before React mounts).
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mq || iosStandalone);
}

/**
 * React hook version — reactively tracks standalone vs browser mode.
 * Use this to branch layout/design between "app-like" and "website-like"
 * experiences from the same codebase.
 */
export function usePWADisplayMode() {
  const [isStandalone, setIsStandalone] = useState(isStandaloneDisplay);

  useEffect(() => {
    const mql = window.matchMedia("(display-mode: standalone)");
    const handler = () => setIsStandalone(isStandaloneDisplay());
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  return isStandalone;
}
