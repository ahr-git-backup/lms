# atlas-cache-proxy

Cloudflare Worker that caches shared, read-only Supabase data (subject
lists, free-exam metadata) at Cloudflare's edge using KV — so a traffic
spike (many students opening Mock Test / Free Exam at once) hits the
edge cache instead of Supabase directly.

## Deploy steps

1. Create the KV namespace (one-time):
   ```
   cd workers/cache-proxy
   npx wrangler kv namespace create CACHE_KV
   ```
   Copy the returned `id` into `wrangler.toml` under `[[kv_namespaces]]`.

2. Set secrets (one-time):
   ```
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_KEY
   ```
   Use the **service role key** (this worker calls Supabase server-side,
   bypassing RLS on purpose — only the whitelisted read-only routes in
   `src/index.js` are exposed, so this is safe as long as no
   user-specific route is ever added here).

3. Deploy:
   ```
   npx wrangler deploy
   ```

4. Note the deployed URL (e.g. `https://atlas-cache-proxy.<account>.workers.dev`)
   and point the frontend at it for the routes below.

## Available routes

- `GET /mock-pool-subjects` — subject/chapter/topic/MCQ-count data for
  Mock Test's subject picker.
- `GET /mock-pool-subject-totals` — per-subject MCQ totals.
- `GET /free-exams-metadata` — Free Exam page's published exam list.

All routes are cached for `CACHE_TTL_SECONDS` (default 300s / 5 min,
set in `wrangler.toml`). Response includes an `X-Cache-Status: HIT|MISS`
header for debugging.

## Adding a new cacheable route

Only add routes here that are:
- **Read-only** (no writes/mutations)
- **Identical for every user** (no per-user filtering — never cache
  someone's own attempts, answers, payments, or profile data here)
- **Safe to serve slightly stale** (up to `CACHE_TTL_SECONDS` old)

Add a new entry to the `ROUTES` object in `src/index.js` following the
existing pattern.

## Frontend integration (not yet wired up)

This worker is deployed standalone. To actually reduce Supabase load,
the frontend queries in `UnlimitedMockTest.tsx` (subjects list) and
`FreeExam.tsx` (exams metadata) need to call this worker's URL instead
of `supabase.from(...)` directly for those specific reads. That wiring
was intentionally left for a follow-up step so it can be tested against
the deployed worker URL first.
