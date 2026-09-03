-- CourseBuy.tsx inserts event_id (for Meta Pixel/CAPI dedup) and UTM
-- attribution fields into payment_requests, but these columns never
-- existed, causing "জমা দিতে ব্যর্থ: Could not find the 'event_id' column"
-- on submission. Add them (additive, nullable — safe for existing rows).
alter table public.payment_requests
  add column if not exists event_id text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text;
