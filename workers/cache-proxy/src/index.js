/**
 * atlas-cache-proxy
 *
 * Purpose: shield Supabase (free tier, limited connections/compute) from
 * traffic spikes — e.g. 2000 students opening Mock Test / Free Exam at once —
 * by caching *shared, rarely-changing, read-only* data at Cloudflare's edge
 * (KV). Every user asking for "the subject list" or "the free exam list"
 * within the same TTL window gets served from KV, not from Supabase.
 *
 * Only whitelisted, no-auth-required, identical-for-everyone endpoints are
 * proxied here. Anything user-specific (their own attempts, answers,
 * enrollment, payment) must keep going directly to Supabase — never cache
 * per-user data behind a shared key.
 *
 * Usage from the frontend (example):
 *   fetch(`${CACHE_PROXY_URL}/mock-pool-subjects`)
 *   fetch(`${CACHE_PROXY_URL}/mock-pool-subject-totals`)
 *   fetch(`${CACHE_PROXY_URL}/free-exams-metadata`)
 *
 * Each route below defines exactly one Supabase query. Add new cacheable
 * routes the same way — do not add a generic passthrough (that would let
 * anything be cached / bypass RLS assumptions).
 */

const ROUTES = {
  "/mock-pool-subjects": async (env) => {
    const res = await supabaseRest(
      env,
      "mock_question_pool?select=subject,chapter,topic,questions_json"
    );
    return res;
  },
  "/mock-pool-subject-totals": async (env) => {
    const res = await supabaseRest(
      env,
      "mock_question_pool?select=subject,questions_json"
    );
    return res;
  },
  "/free-exams-metadata": async (env) => {
    const res = await supabaseRest(
      env,
      "exams?select=id,title,subject,chapter,readymade_sub_chapter,exam_type,duration_minutes,free_exam_category,is_visible_on_free,questions_count:exam_questions(count)" +
        "&is_published=eq.true&is_visible_on_free=eq.true"
    );
    return res;
  },
};

async function supabaseRest(env, pathAndQuery) {
  const url = `${env.SUPABASE_URL}/rest/v1/${pathAndQuery}`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  return res.text(); // raw JSON string, stored as-is in KV
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const handler = ROUTES[url.pathname];
    if (!handler) {
      return new Response("Not found", { status: 404 });
    }

    const ttl = parseInt(env.CACHE_TTL_SECONDS || "300", 10);
    const cacheKey = `route:${url.pathname}`;

    // 1. Try KV cache first — this is the fast path that absorbs 2000
    //    concurrent requests as one shared read instead of 2000 DB hits.
    const cached = await env.CACHE_KV.get(cacheKey);
    if (cached) {
      return jsonResponse(cached, "HIT");
    }

    // 2. Cache miss — fetch fresh from Supabase, store for next time.
    try {
      const fresh = await ROUTES[url.pathname](env);
      // expirationTtl is best-effort; a burst of simultaneous misses can
      // still cause a handful of duplicate Supabase reads right after
      // cache expiry, but never anywhere close to full request volume.
      await env.CACHE_KV.put(cacheKey, fresh, { expirationTtl: ttl });
      return jsonResponse(fresh, "MISS");
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

function jsonResponse(body, cacheStatus) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "X-Cache-Status": cacheStatus,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
