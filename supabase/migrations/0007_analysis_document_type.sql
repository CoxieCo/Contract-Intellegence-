-- Run this in the Supabase Dashboard's SQL Editor — same manual copy-paste
-- convention as every earlier migration (no CLI / migration runner wired
-- into this repo).

-- ---------------------------------------------------------------------
-- Subcontract mode (lib/subcontract-analysis.ts) saves its analyses into
-- the same `analyses.analysis` JSON column as general-contract scans, with
-- a top-level "documentType": "subcontract" key that tells a reload which
-- results view to show. That JSON key is all the app itself reads, so the
-- code works whether or not this migration has been run yet — there's no
-- deploy-ordering hazard.
--
-- This adds a real column derived from that key, so the two kinds of
-- analysis can be filtered, counted and indexed in SQL without digging into
-- the JSON. It's a STORED generated column: Postgres fills it in for every
-- existing row when this runs (they all become 'contract', since none has
-- the key) and keeps it in sync on every insert/update, so no application
-- code ever writes it.
--
-- Existing RLS policies on `analyses` are row-level and need no change for
-- a new column.
-- ---------------------------------------------------------------------
alter table analyses
  add column if not exists document_type text
  generated always as (coalesce(analysis ->> 'documentType', 'contract')) stored;

create index if not exists analyses_document_type_idx
  on analyses (document_type);
