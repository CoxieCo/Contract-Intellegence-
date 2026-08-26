-- Run this in the Supabase Dashboard's SQL Editor before deploying the code
-- in this commit — same manual copy-paste convention as 0001 (no CLI /
-- migration runner wired into this repo).

-- ---------------------------------------------------------------------
-- Re-scanning the identical PDF used to always insert a brand new row,
-- so "Recent contracts" filled up with duplicate entries for the same
-- file. app/api/analyze/route.ts now hashes the uploaded file (SHA-256 of
-- the raw bytes) and upserts on (session_id, file_hash) instead of always
-- inserting, so a re-scan refreshes the existing row's analysis and
-- created_at instead of creating a new one.
-- ---------------------------------------------------------------------
alter table analyses
  add column if not exists file_hash text;

-- Postgres treats every NULL as distinct in a unique index, so this does
-- not constrain existing rows (which predate this column and have
-- file_hash = NULL) or rows with session_id = NULL (the "no session
-- cookie" edge case) — it only dedupes rows that have both values set,
-- which is every row this code path can now produce.
create unique index if not exists analyses_session_file_hash_idx
  on analyses (session_id, file_hash);
