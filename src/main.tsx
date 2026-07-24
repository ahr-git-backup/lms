import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./fonts.css";
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    // Poll for a new service worker every 60s so long-open tabs also catch updates fast
    registration && setInterval(() => registration.update(), 60_000);
  },
  onNeedRefresh() {
    // skipWaiting + clientsClaim already active new SW instantly; just reload this tab to use it
    window.location.reload();
  },
});

createRoot(document.getElementById("root")!).render(<App />);
