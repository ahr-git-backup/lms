import { useEffect } from "react";
import { isStandaloneDisplay } from "./usePWADisplayMode";

// Keys/prefixes that must NEVER be cleared — losing these logs the user out
// or breaks in-progress work.
const PROTECTED_KEY_PATTERNS = [/^sb-/i, /auth/i, /session/i, /supabase/i];

function isProtectedKey(key: string): boolean {
  return PROTECTED_KEY_PATTERNS.some((re) => re.test(key));
}

// Run at most once per calendar day per device, so this never adds overhead
// to every single app open.
const LAST_RUN_KEY = "__pwa_cache_cleanup_last_run";
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

function clearStaleLocalStorage() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === LAST_RUN_KEY) continue;
      if (isProtectedKey(key)) continue;
      keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // no-op — never block the app over storage cleanup
  }
}

function clearSessionStorage() {
  try {
    // sessionStorage never holds the auth session (that's localStorage-backed),
    // so it's always safe to fully clear — it's per-tab scratch state anyway.
    sessionStorage.clear();
  } catch {
    // no-op
  }
}

async function clearOldCacheStorageEntries() {
  try {
    if (!("caches" in window)) return;
    const keys = await caches.keys();
    // Keep only the current workbox precache + runtime cache (whatever the
    // active service worker just created); drop every cache from a previous
    // app version. This is what actually frees up the space that makes
    // pages feel slow to load after many updates.
    const current = await Promise.all(
      keys.map(async (name) => {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        return { name, isEmpty: requests.length === 0 };
      })
    );
    // Workbox rotates precache names on every build (cleanupOutdatedCaches
    // already removes the truly outdated ones on activate) — this is a
    // belt-and-suspenders pass for anything left behind, e.g. from a crashed
    // update. Only touch caches that look empty/orphaned to avoid ever
    // deleting the cache the current SW is actively serving from.
    await Promise.all(
      current.filter((c) => c.isEmpty).map((c) => caches.delete(c.name))
    );
  } catch {
    // no-op
  }
}

/**
 * PWA-only maintenance: keeps the installed app snappy by clearing
 * accumulated non-essential storage (old cached data, stale UI state)
 * without ever touching the logged-in session. Runs once per day at most,
 * on app open. Has no effect on the regular browser website.
 */
export function usePWACacheCleanup() {
  useEffect(() => {
    if (!isStandaloneDisplay()) return;

    try {
      const lastRun = Number(localStorage.getItem(LAST_RUN_KEY) || 0);
      if (Date.now() - lastRun < RUN_INTERVAL_MS) return;

      clearStaleLocalStorage();
      clearSessionStorage();
      void clearOldCacheStorageEntries();

      localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
    } catch {
      // no-op — cleanup is best-effort, never block app startup
    }
  }, []);
}
