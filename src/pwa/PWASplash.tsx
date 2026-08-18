import { useEffect, useState } from "react";
import { isStandaloneDisplay } from "./usePWADisplayMode";
import "./splash.css";

const SESSION_KEY = "atlas_pwa_splash_shown";
const VISIBLE_MS = 3000;

/**
 * App-open splash animation shown only when running as an installed
 * PWA/TWA (standalone mode) — never in the regular browser website.
 * Shows once per app session (fresh launch), never again on internal
 * navigation. Fully self-contained: any internal error is swallowed so
 * it can never affect the rest of the app.
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
      const removeTimer = setTimeout(() => setShouldRender(false), VISIBLE_MS + 500);

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
      <div className="atlas-splash__glow" />
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
        <div className="atlas-splash__ring" />
      </div>
      <div className="atlas-splash__brand">
        <span className="atlas-splash__brand-letter" style={{ ["--i" as string]: 0 }}>A</span>
        <span className="atlas-splash__brand-letter" style={{ ["--i" as string]: 1 }}>t</span>
        <span className="atlas-splash__brand-letter" style={{ ["--i" as string]: 2 }}>l</span>
        <span className="atlas-splash__brand-letter" style={{ ["--i" as string]: 3 }}>a</span>
        <span className="atlas-splash__brand-letter" style={{ ["--i" as string]: 4 }}>s</span>
      </div>
      <p className="atlas-splash__motto">
        {"সঠিক গাইডলাইনে গোছানো প্রস্তুতি".split(" ").map((word, i) => (
          <span
            key={i}
            className="atlas-splash__motto-word"
            style={{ ["--i" as string]: i }}
          >
            {word}
          </span>
        ))}
      </p>
    </div>
  );
}
