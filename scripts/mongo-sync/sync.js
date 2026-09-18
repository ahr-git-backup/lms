/**
 * One-way sync: Supabase (source of truth) -> MongoDB Atlas (read layer).
 *
 * Runs on a GitHub Actions cron schedule (see .github/workflows/mongo-sync.yml).
 * No servers, no manual deploy — GitHub runs this script for us on a timer.
 *
 * Free Exam metadata syncs first (priority), then Mock Test question pool.
 * Only reads from Supabase, only writes to MongoDB — never touches
 * user-specific data (attempts, payments, profiles stay Supabase-only).
 */

import { MongoClient } from "mongodb";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = "atlas_cache";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !MONGODB_URI) {
  console.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, MONGODB_URI");
  process.exit(1);
}

// Order matters: Free Exam first (priority), Mock Test second.
const COLLECTIONS = [
  {
    key: "free_exams_metadata",
    supabaseTable: "exams",
    supabaseSelect:
      "id,title,subject,chapter,readymade_sub_chapter,exam_type,duration_minutes,free_exam_category,is_visible_on_free,is_published,updated_at",
    supabaseFilter: "&is_published=eq.true&is_visible_on_free=eq.true",
    mongoCollection: "free_exams_metadata",
  },
  {
    key: "mock_question_pool",
    supabaseTable: "mock_question_pool",
    supabaseSelect: "id,subject,paper,chapter,topic,standard,question_count,questions_json,updated_at",
    mongoCollection: "mock_question_pool",
  },
];

async function fetchAllFromSupabase({ supabaseTable, supabaseSelect, supabaseFilter }) {
  const pageSize = 1000;
  let offset = 0;
  let all = [];
  while (true) {
    const url =
      `${SUPABASE_URL}/rest/v1/${supabaseTable}?select=${supabaseSelect}` +
      `${supabaseFilter || ""}&order=id&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
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

async function replaceCollection(db, collectionName, rows) {
  const collection = db.collection(collectionName);
  await collection.deleteMany({});
  if (rows.length === 0) return;
  const docs = rows.map((r) => ({ ...r, _id: r.id }));
  await collection.insertMany(docs);
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);

    for (const cfg of COLLECTIONS) {
      try {
        const rows = await fetchAllFromSupabase(cfg);
        await replaceCollection(db, cfg.mongoCollection, rows);
        console.log(`[OK] ${cfg.key}: synced ${rows.length} rows`);
      } catch (err) {
        // One collection failing shouldn't abort the other sync.
        console.error(`[FAIL] ${cfg.key}:`, err.message);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Sync run failed:", err);
  process.exit(1);
});
