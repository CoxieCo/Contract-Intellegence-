-- Run this in the Supabase Dashboard's SQL Editor before deploying the code
-- in this commit — same manual copy-paste convention as every earlier
-- migration (no CLI / migration runner wired into this repo).

-- ---------------------------------------------------------------------
-- Ask Your Contract was built after the 1-free-scan gate and was never
-- actually scoped into it — it currently has no cap at all for anyone,
-- signed in or not. Fully gating it behind sign-up (like a second scan)
-- would hide the product's best feature behind the exact wall meant to
-- convert people, so instead this backs a small per-session cap: an
-- anonymous visitor gets a few free questions on their one free scan, then
-- app/api/ask/route.ts asks them to sign up, the same way a second scan
-- attempt does.
--
-- One row per anonymous session that has ever asked a question — there is
-- no user_id column because signed-in users have no cap at all (see the
-- route) and never touch this table.
-- ---------------------------------------------------------------------
create table if not exists ask_usage (
  session_id text primary key,
  question_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Same posture as rate_limits: reachable only via the service-role client
-- from app/api/ask/route.ts, never directly from a browser. RLS enabled with
-- no policies denies every row to both the anon and authenticated roles.
alter table ask_usage enable row level security;
