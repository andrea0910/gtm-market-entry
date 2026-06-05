-- Migration 002: Add briefs table for LLM-generated market briefs
-- Local: wrangler d1 execute market-intel-db --local --file=migrate_002_briefs.sql
-- Prod:  wrangler d1 execute market-intel-db --file=migrate_002_briefs.sql

CREATE TABLE IF NOT EXISTS briefs (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  generated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  markdown_content      TEXT NOT NULL,
  -- JSON array of signals.id values whose enriched summaries were sent to the model
  signal_ids_referenced TEXT
);

CREATE INDEX IF NOT EXISTS idx_briefs_company_id    ON briefs(company_id);
CREATE INDEX IF NOT EXISTS idx_briefs_generated_at  ON briefs(generated_at);
