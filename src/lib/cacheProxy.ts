/**
 * Thin client for atlas-cache-proxy (see workers/cache-proxy/).
 *
 * Each helper tries the Cloudflare-cached edge endpoint first (fast,
 * shields Supabase from concurrent-traffic spikes). If the proxy URL
 * isn't configured, or the request fails for any reason (worker not
 * deployed yet, network hiccup, etc.), it transparently falls back to
 * the given Supabase query — so the app always works correctly, and the
 * cache layer is purely an optional performance boost.
 */

const CACHE_PROXY_URL = import.meta.env.VITE_CACHE_PROXY_URL || "";

/**
 * @param route - one of the whitelisted routes in workers/cache-proxy/src/index.js,
 *   e.g. "/mock-pool-subjects", "/free-exams-metadata"
 * @param fallback - async function that performs the equivalent direct
 *   Supabase query and returns the same shape of data the proxy would.
 */
export async function fetchCached<T>(route: string, fallback: () => Promise<T>): Promise<T> {
  if (!CACHE_PROXY_URL) return fallback();

  try {
    const res = await fetch(`${CACHE_PROXY_URL}${route}`);
    if (!res.ok) return fallback();
    return (await res.json()) as T;
  } catch {
    return fallback();
  }
}
