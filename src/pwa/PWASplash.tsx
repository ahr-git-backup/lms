import { useEffect, useState } from "react";
import { isStandaloneDisplay } from "./usePWADisplayMode";
import "./splash.css";

const SESSION_KEY = "atlas_pwa_splash_shown";
const VISIBLE_MS = 1600;

/**
 * App-open splash animation shown only when running as an installed
 * PWA/TWA (standalone mode) — never in the regular browser website.
 * Shows once per session so it doesn't replay on every route change.
 */
export function PWASplash() {
  const [shouldRender, setShouldRender] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!isStandaloneDisplay()) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    sessionStorage.setItem(SESSION_KEY, "1");
    setShouldRender(true);

    const leaveTimer = setTimeout(() => setIsLeaving(true), VISIBLE_MS);
    const removeTimer = setTimeout(() => setShouldRender(false), VISIBLE_MS + 400);

    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <div className={`atlas-splash ${isLeaving ? "atlas-splash--leaving" : ""}`}>
      <div className="atlas-splash__logo-wrap">
        <img src="/logo.png" alt="Atlas" className="atlas-splash__logo" />
      </div>
      <p className="atlas-splash__motto">সঠিক গাইডলাইনে গোছানো প্রস্তুতি</p>
    </div>
  );
}
