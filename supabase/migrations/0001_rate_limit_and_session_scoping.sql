-- Run this in the Supabase Dashboard's SQL Editor before deploying the
-- code in this commit. There is no Supabase CLI / migration runner wired
-- into this repo (no `supabase/config.toml`, no linked project) — this
-- file documents the exact schema change and is meant to be copy-pasted,
-- not applied automatically.

-- ---------------------------------------------------------------------
-- Part A3: IP-based rate limiting for POST /api/analyze and /api/ask.
-- See lib/rateLimit.ts for the read/write pattern this table supports.
-- ---------------------------------------------------------------------
create table if not exists rate_limits (
  id bigint generated always as identity primary key,
  ip_address text not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limits_ip_endpoint_created_at_idx
  on rate_limits (ip_address, endpoint, created_at);

-- ---------------------------------------------------------------------
-- Part B2/B3: scope saved analyses to the anonymous session that created
-- them, so GET /api/analyses only ever returns one visitor's own
-- contracts instead of the 10 most recent across every visitor.
-- ---------------------------------------------------------------------
alter table analyses
  add column if not exists session_id text;

create index if not exists analyses_session_id_idx
  on analyses (session_id);

-- Part B4: existing rows predate this column and have session_id = NULL.
-- Since GET /api/analyses now filters with `.eq("session_id", sessionId)`,
-- a NULL session_id can never match any real visitor's session id — those
-- rows become inaccessible to everyone (including whoever originally
-- uploaded them) rather than staying visible to everyone. This is the
-- chosen default: stop the leak now rather than guessing which session to
-- award old rows to. To keep your own test data instead, find your rows in
-- the Supabase table editor and manually set their session_id to the
-- current value of your browser's `ci_session` cookie.
