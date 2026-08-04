import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./fonts.css";
import { registerSW } from "virtual:pwa-register";

let updateSW: (() => void) | undefined;
let pendingReload = false;

function tryApplyUpdate() {
  if (!pendingReload) return;
  // Don't yank the user out of an active class video or exam — wait until
  // the tab is hidden (they switched away) or they're on a safe page.
  const path = window.location.pathname;
  const isSensitive = /\/class\/|\/take-exam\/|\/mock-test\/play|\/quick-practice/.test(path);
  if (document.visibilityState === "hidden" || !isSensitive) {
    window.location.reload();
  }
}

document.addEventListener("visibilitychange", tryApplyUpdate);

updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    // Poll for a new service worker every 60s so long-open tabs also catch updates fast
    registration && setInterval(() => registration.update(), 60_000);
  },
  onNeedRefresh() {
    // A new version is ready. Don't reload immediately — that would kick the
    // user out of a class video or exam mid-session. Defer until the tab is
    // hidden or they're on a non-sensitive page.
    pendingReload = true;
    tryApplyUpdate();
  },
});

if (window.matchMedia("(display-mode: standalone)").matches) {
  document.documentElement.classList.add("pwa-standalone");
}

createRoot(document.getElementById("root")!).render(<App />);
