CREATE TABLE IF NOT EXISTS composed_signals (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id            INTEGER NOT NULL,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  signal_ids_referenced TEXT    NOT NULL,          -- JSON array of source signal IDs
  composition_type      TEXT    NOT NULL,          -- hiring_cluster | cross_source_pattern | regulatory_overlap | competitive_escalation
  account_id            INTEGER,                   -- nullable: primary account, null for multi-account patterns
  importance            TEXT    NOT NULL DEFAULT 'medium', -- high | medium | low
  one_line_summary      TEXT    NOT NULL,
  explanation           TEXT    NOT NULL,
  dedup_key             TEXT    NOT NULL,          -- sha256(type:account_id:sorted_signal_ids)
  UNIQUE(dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_composed_signals_company_id ON composed_signals(company_id);
CREATE INDEX IF NOT EXISTS idx_composed_signals_importance  ON composed_signals(company_id, importance, created_at DESC);
