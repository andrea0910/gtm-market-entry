-- Adds critique_markdown and signal_ids_referenced to the plans table.
-- Run against the local D1 instance before using /api/plans/* endpoints.
ALTER TABLE plans ADD COLUMN critique_markdown TEXT;
ALTER TABLE plans ADD COLUMN signal_ids_referenced TEXT;
