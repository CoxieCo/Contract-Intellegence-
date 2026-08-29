-- Run this in the Supabase Dashboard's SQL Editor before deploying the code
-- in this commit — same manual copy-paste convention as every earlier
-- migration (no CLI / migration runner wired into this repo).

-- ---------------------------------------------------------------------
-- Ask Your Contract's raw contract text (the PDF-extracted text the /api/ask
-- prompt answers from) has only ever lived in React state on the tab that
-- ran the scan — never saved anywhere. The moment that tab navigated away
-- and back (dashboard round trip, a past analysis reopened, even a plain
-- page refresh), the text was gone and Ask silently produced nothing: no
-- request even fired, no error shown, because the frontend's own guard
-- treats "no contract text" as "nothing to do" rather than a failure worth
-- surfacing. See app/page.tsx's askContract and the app/api/analyze,
-- app/api/analyses, app/dashboard changes in this same commit that thread
-- this column through.
--
-- Nullable — existing rows predate this column and simply won't have it,
-- same as every other retrofitted column in this table (session_id,
-- file_hash, user_id). Ask correctly reports itself unavailable for those
-- rather than silently failing (see app/page.tsx), and re-scanning the same
-- PDF backfills it via the existing upsert.
-- ---------------------------------------------------------------------
alter table analyses
  add column if not exists contract_text text;
