/**
 * atlas-mongo-sync
 *
 * One-way mirror: Supabase (source of truth) -> MongoDB Atlas (read layer).
 *
 * Purpose: mock_question_pool and the free-exam-visible subset of `exams`
 * are read-heavy, admin-edited-occasionally tables. Under a traffic spike
 * (e.g. 2000 students opening Mock Test at once) every one of those reads
 * hitting Supabase directly risks exhausting the free tier's connection
 * pool. MongoDB Atlas (also free tier, M0) has much higher read throughput
 * headroom for this specific access pattern, so the frontend reads from
 * Mongo first (via src/lib/cacheProxy.ts's Mongo fallback), only touching
 * Supabase directly for writes (submitting an attempt) and for anything
 * user-specific.
 *
 * This worker does NOT touch user-specific data (attempts, payments,
 * profiles, auth) — those must always go straight to Supabase, never
 * mirrored here, so RLS and correctness stay intact for anything personal.
 *
 * Sync direction is strictly one-way and non-destructive to Supabase:
 * this worker only ever reads from Supabase and writes to MongoDB.
 *
 * Runs on a cron (see wrangler.toml) and also exposes a manual trigger
 * endpoint (POST /sync-now with header X-Sync-Key: <SYNC_TRIGGER_KEY>) for
 * testing or forcing a sync right after an admin edits questions.
 */

const COLLECTIONS = {
  mock_question_pool: {
    supabaseTable: "mock_question_pool",
    supabaseSelect: "id,subject,paper,chapter,topic,standard,question_count,questions_json,updated_at",
    mongoCollection: "mock_question_pool",
  },
  free_exams_metadata: {
    supabaseTable: "exams",
    supabaseSelect:
      "id,title,subject,chapter,readymade_sub_chapter,exam_type,duration_minutes,free_exam_category,is_visible_on_free,is_published,updated_at",
    supabaseFilter: "&is_published=eq.true&is_visible_on_free=eq.true",
    mongoCollection: "free_exams_metadata",
  },
};

async function fetchAllFromSupabase(env, { supabaseTable, supabaseSelect, supabaseFilter }) {
  const pageSize = 1000;
  let offset = 0;
  let all = [];
  while (true) {
    const url =
      `${env.SUPABASE_URL}/rest/v1/${supabaseTable}?select=${supabaseSelect}` +
      `${supabaseFilter || ""}&order=id&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase fetch failed (${supabaseTable}): ${res.status} ${await res.text()}`);
    const page = await res.json();
    all = all.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function mongoDataApi(env, action, body) {
  const res = await fetch(`${env.MONGODB_DATA_API_URL}/action/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.MONGODB_DATA_API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Mongo ${action} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Replace the entire collection with the fresh rows from Supabase (small
 *  tables, simplest correct approach — no drift, no partial-update bugs). */
async function replaceCollection(env, dataSource, database, collection, rows) {
  await mongoDataApi(env, "deleteMany", {
    dataSource,
    database,
    collection,
    filter: {},
  });
  if (rows.length === 0) return;

  // Data API insertMany has a practical payload size limit — chunk it.
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((r) => ({ ...r, _id: r.id }));
    await mongoDataApi(env, "insertMany", {
      dataSource,
      database,
      collection,
      documents: chunk,
    });
  }
}

async function runSync(env) {
  const dataSource = env.MONGODB_DATA_SOURCE || "Cluster0";
  const database = env.MONGODB_DATABASE || "atlas_cache";
  const results = {};

  for (const [key, cfg] of Object.entries(COLLECTIONS)) {
    try {
      const rows = await fetchAllFromSupabase(env, cfg);
      await replaceCollection(env, dataSource, database, cfg.mongoCollection, rows);
      results[key] = { ok: true, count: rows.length };
    } catch (err) {
      // One collection failing shouldn't abort the other sync — log and continue.
      results[key] = { ok: false, error: String(err) };
    }
  }
  return results;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/sync-now" && request.method === "POST") {
      if (request.headers.get("X-Sync-Key") !== env.SYNC_TRIGGER_KEY) {
        return new Response("Unauthorized", { status: 401 });
      }
      const results = await runSync(env);
      return new Response(JSON.stringify(results, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("atlas-mongo-sync: use POST /sync-now or wait for the cron trigger", { status: 200 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runSync(env));
  },
};
