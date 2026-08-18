import { useEffect, useState } from "react";
import { isStandaloneDisplay } from "./usePWADisplayMode";
import "./splash.css";

const SESSION_KEY = "atlas_pwa_splash_shown";
const VISIBLE_MS = 1600;

/**
 * App-open splash animation shown only when running as an installed
 * PWA/TWA (standalone mode) — never in the regular browser website.
 * Shows once per session. Fully self-contained: any internal error is
 * swallowed so it can never affect the rest of the app.
 */
export function PWASplash() {
  const [shouldRender, setShouldRender] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    try {
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
    } catch {
      setShouldRender(false);
      return;
    }
  }, []);

  if (!shouldRender) return null;

  return (
    <div className={`atlas-splash ${isLeaving ? "atlas-splash--leaving" : ""}`}>
      <div className="atlas-splash__logo-wrap">
        <img
          src="/logo.png"
          alt="Atlas"
          className="atlas-splash__logo"
          onError={(e) => {
            // If the logo fails to load for any reason, hide it rather than
            // showing a broken image icon over the whole screen.
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <p className="atlas-splash__motto">সঠিক গাইডলাইনে গোছানো প্রস্তুতি</p>
    </div>
  );
}
