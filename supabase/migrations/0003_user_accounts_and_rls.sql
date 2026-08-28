-- Run this in the Supabase Dashboard's SQL Editor before deploying the code
-- in this commit — same manual copy-paste convention as 0001 and 0002 (no
-- CLI / migration runner wired into this repo).

-- ---------------------------------------------------------------------
-- Part 1: row ownership.
--
-- Until now a row's only owner was the anonymous `ci_session` cookie in
-- `session_id`. `user_id` is the durable owner that survives cookie loss:
--   NULL     -> anonymous row, still reachable only via its session cookie
--   non-NULL -> belongs to a signed-in Supabase Auth user
--
-- Nullable on purpose. Existing rows and every future anonymous scan keep
-- user_id = NULL until the visitor signs up and explicitly claims them
-- (see app/api/analyses/claim/route.ts).
-- ---------------------------------------------------------------------
alter table analyses
  add column if not exists user_id uuid references auth.users(id);

-- NOTE: this foreign key has no ON DELETE action, so it defaults to NO
-- ACTION — deleting an auth user whose analyses are still present will fail
-- with a foreign-key violation rather than removing or orphaning their rows.
-- That is the safe default (no silent data loss), but it does mean account
-- deletion needs the rows dealt with first. If you'd rather have deleting an
-- account delete its analyses too, re-run this column with
-- `references auth.users(id) on delete cascade` instead.

create index if not exists analyses_user_id_idx
  on analyses (user_id);

-- ---------------------------------------------------------------------
-- Part 2: real Row Level Security.
--
-- RLS was already enabled on this table with zero policies, which denied
-- everything to the anon role and made the service-role key (which bypasses
-- RLS entirely) the only way in. That was fine while there were no accounts.
-- Now that rows have real owners, the dashboard read path switches to a
-- user-authenticated client (lib/supabase-server.ts) so Postgres — not
-- application code — is what actually enforces "you only see your own rows".
--
-- `enable row level security` is idempotent; re-running it on an
-- already-enabled table is a no-op.
-- ---------------------------------------------------------------------
alter table analyses enable row level security;

drop policy if exists "Users can read their own analyses" on analyses;
create policy "Users can read their own analyses"
  on analyses
  for select
  to authenticated
  using (user_id = auth.uid());

-- Deliberately NOT created, and each omission is load-bearing:
--
--   * No policy for the `anon` role. Anonymous rows (user_id IS NULL) stay
--     unreachable with the anon key from the browser; the only way to read
--     them remains the server-side, session-cookie-scoped path in
--     app/api/analyses/route.ts, which uses the service-role client and
--     filters on the httpOnly `ci_session` cookie. A browser client holding
--     the anon key cannot enumerate them.
--
--   * No insert/update/delete policy for `authenticated`. Every write still
--     goes through a server route on the service-role key: the analysis save
--     in /api/analyze, and the ownership transfer in /api/analyses/claim.
--     Without an UPDATE policy a signed-in browser client cannot reassign
--     user_id on any row — including its own — so it can't hand its rows to
--     another account or steal an anonymous row by guessing a session id.

-- ---------------------------------------------------------------------
-- Part 3: make the de-duplication key ownership-aware.
--
-- Runs in two steps: 3a repairs existing data, 3b swaps the index.
--
-- NOT in the original scope for this change, but adding `user_id` breaks the
-- unique index from migration 0002 in a way that loses data, so it has to
-- move in the same pass.
--
-- 0002 deduped re-scans on (session_id, file_hash) alone, and
-- /api/analyze upserts against it. Once rows have owners, that key stops
-- distinguishing between owners while `ci_session` stays the same across a
-- sign-out or an account switch in one browser. Concretely, with the old
-- index:
--
--   1. Signed in as A, scan contract X  -> row (session S, hash H, user A)
--   2. Sign out, scan contract X again  -> upsert matches (S, H) and
--                                          rewrites that same row with
--                                          user_id = NULL
--   3. X disappears from A's dashboard.
--
-- Adding user_id to the key makes step 2 insert a separate anonymous row and
-- leaves A's row alone. `nulls not distinct` is what keeps the anonymous case
-- behaving exactly as it does today: without it Postgres treats every NULL
-- user_id as unique and two anonymous scans of the same file would stop
-- de-duplicating at all.
--
-- Requires Postgres 15 or newer. If this errors with a syntax error at
-- "nulls", the project is on Postgres 14 — drop `nulls not distinct` and
-- instead give anonymous rows a sentinel user_id, or leave 0002's index in
-- place and accept the overwrite above.
-- ---------------------------------------------------------------------
-- Part 3a: give every pre-existing row a distinct file_hash first.
--
-- This has to run BEFORE the index below or the index cannot be built.
-- `nulls not distinct` is what makes the anonymous case keep de-duplicating,
-- but it also means NULLs now collide with each other, and 82 of the 108
-- existing rows predate the file_hash column:
--
--   37 rows (2026-08-18..20) predate session_id too -> (NULL, NULL, NULL)
--   45 rows (2026-08-20..26) have a real session_id  -> (S, NULL, NULL),
--      which collide in 5 further groups wherever one session produced more
--      than one pre-file_hash row
--
-- Under 0002's index every one of those NULLs was distinct, so they coexisted
-- fine; `nulls not distinct` is what turns them into duplicates. Postgres
-- reports only the first collision it hits, so the (NULL, NULL, NULL) group
-- is the only one the error message names — deleting just those 37 rows would
-- still leave the other five groups failing, and 45 of those rows are live
-- data a real session cookie can still reach.
--
-- So: backfill rather than delete. Nothing is lost, and a sentinel can never
-- be confused with a real hash (those are 64 hex chars, verified against all
-- 26 existing hashed rows). These rows already never matched the upsert —
-- their file_hash was NULL, which matched nothing — so re-scanning one of
-- those PDFs still inserts a fresh row exactly as it does today.
update analyses
  set file_hash = 'legacy:' || id::text
  where file_hash is null;

-- ---------------------------------------------------------------------
-- Part 3b: swap the de-duplication index for the ownership-aware one.
-- ---------------------------------------------------------------------
drop index if exists analyses_session_file_hash_idx;

create unique index if not exists analyses_session_file_hash_user_idx
  on analyses (session_id, file_hash, user_id) nulls not distinct;
