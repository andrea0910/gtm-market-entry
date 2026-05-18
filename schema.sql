-- D1 enforces foreign keys only when explicitly enabled per connection.
-- Set `PRAGMA foreign_keys = ON` in the Worker before any DML to activate these constraints.

-- ─── companies ───────────────────────────────────────────────────────────────
-- One row per market-entry initiative. In practice this starts as one row (Nubank US),
-- but the schema supports multiple expansion programs without structural changes.
CREATE TABLE IF NOT EXISTS companies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  hq_country      TEXT NOT NULL,    -- ISO 3166-1 alpha-2
  target_market   TEXT NOT NULL,    -- market being entered, same format
  product_surface TEXT NOT NULL,    -- JSON array of product categories being launched
  entry_thesis    TEXT,             -- GM's written strategic rationale
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── accounts ────────────────────────────────────────────────────────────────
-- Entities in the target market the GM monitors: competitors, partners, prospects,
-- and regulatory bodies. All signals ultimately resolve to one of these.
CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('competitor', 'partner', 'prospect', 'regulator')),
  hq_country  TEXT,
  website     TEXT,
  description TEXT,
  -- 1 = highest priority for the GM's attention; drives sort order in the UI
  tier        INTEGER NOT NULL DEFAULT 2 CHECK (tier BETWEEN 1 AND 3),
  status      TEXT NOT NULL DEFAULT 'monitoring'
              CHECK (status IN ('monitoring', 'active', 'archived')),
  -- Flexible key-value store for type-specific metadata rather than sparse nullable columns.
  -- competitors: { est_customers, last_valuation_usd, ticker, revenue_model }
  -- regulators:  { type, key_rule_areas[] }
  -- partners:    { model, integration_readiness }
  metadata    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type       ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_tier       ON accounts(tier);

-- ─── stakeholders ────────────────────────────────────────────────────────────
-- Named individuals relevant to the market entry.
-- account_id links to their employer when that org is already tracked; use notes otherwise.
CREATE TABLE IF NOT EXISTS stakeholders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id       INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id       INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  role             TEXT,
  type             TEXT NOT NULL CHECK (type IN (
    'buyer', 'regulator', 'partner', 'press', 'analyst', 'exec'
  )),
  -- Plain-text summary of publicly known positions; the ingestion pipeline appends
  -- to this field when signals surface new quotes or statements from this person.
  public_positions TEXT,
  linkedin_url     TEXT,
  twitter_handle   TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stakeholders_company_id ON stakeholders(company_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_account_id ON stakeholders(account_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_type       ON stakeholders(type);

-- ─── sources ─────────────────────────────────────────────────────────────────
-- Configured ingestion endpoints. Each row is one monitored URL that the cron
-- job fetches on its interval. scrape_config stores extraction rules as JSON.
CREATE TABLE IF NOT EXISTS sources (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('rss', 'scrape', 'api', 'manual')),
  url             TEXT NOT NULL,
  -- JSON with extraction rules: CSS selectors, pagination config, auth headers
  scrape_config   TEXT,
  -- Seconds between fetches; 3600 matches the hourly cron defined in wrangler.toml
  fetch_interval  INTEGER NOT NULL DEFAULT 3600,
  last_fetched_at TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sources_company_id ON sources(company_id);
CREATE INDEX IF NOT EXISTS idx_sources_is_active  ON sources(is_active);

-- ─── plans ───────────────────────────────────────────────────────────────────
-- Defined before signals so insights can reference plans via plan_id.
-- A plan is a Claude-generated GTM document scoped to a time horizon and the GM's stated thesis.
CREATE TABLE IF NOT EXISTS plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  horizon_days  INTEGER NOT NULL CHECK (horizon_days IN (30, 90, 180, 365)),
  thesis        TEXT NOT NULL,    -- GM's stated strategic intent for this plan
  -- JSON array of explicit constraints, e.g. ["no bank partnerships with AUM > $100B"].
  -- The critique engine matches incoming signals against each constraint at generation time.
  constraints   TEXT,
  content       TEXT,             -- generated plan body, markdown
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'active', 'archived')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plans_company_id ON plans(company_id);
CREATE INDEX IF NOT EXISTS idx_plans_status     ON plans(status);

-- ─── signals ─────────────────────────────────────────────────────────────────
-- One row per discrete ingested event. This is the central fact table —
-- every other table either provides context (accounts, stakeholders, sources)
-- or derives from it (insights, plan_critiques).
CREATE TABLE IF NOT EXISTS signals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Retained even if the source is later deactivated, to preserve the historical record
  source_id      INTEGER REFERENCES sources(id) ON DELETE SET NULL,

  -- Drives which Claude prompt template to use and how the UI renders the card
  signal_type    TEXT NOT NULL CHECK (signal_type IN (
    'news', 'job_posting', 'regulatory', 'earnings', 'blog', 'social', 'manual'
  )),

  -- Optional entity links. Both start NULL at ingestion time; the processing step
  -- classifies the signal and backfills these. A signal can relate to an account,
  -- a stakeholder, both, or neither.
  account_id     INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  stakeholder_id INTEGER REFERENCES stakeholders(id) ON DELETE SET NULL,

  url            TEXT,
  title          TEXT,

  -- Full fetched text stored so we can re-run analysis with an improved prompt
  -- without re-fetching from the source (which may be paywalled or rate-limited by then).
  raw_content    TEXT,

  -- Type-specific parsed fields, extracted from raw_content during processing. Shape varies:
  -- job_posting:  { job_title, seniority, location, department, keywords[] }
  -- news:         { entities[], sentiment, summary_sentence }
  -- earnings:     { company, speaker, quarter, quote }
  -- regulatory:   { agency, rule_name, effective_date, impact_level }
  -- blog:         { author, topics[] }
  structured_data TEXT,

  published_at   TEXT,
  ingested_at    TEXT NOT NULL DEFAULT (datetime('now')),

  -- SHA-256 of the URL, or of raw_content when no stable URL exists (e.g. transcript excerpts).
  -- The ingestion worker uses INSERT OR IGNORE so duplicate fetches are silently dropped
  -- without any checking logic in application code.
  url_hash       TEXT NOT NULL UNIQUE,

  -- Processing queue flag. The cron job queries WHERE processed = 0 LIMIT N,
  -- sends each batch to Claude, then sets processed = 1 on completion.
  -- If the worker crashes mid-batch, unprocessed rows stay at 0 and are retried next run.
  processed      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_signals_company_id     ON signals(company_id);
CREATE INDEX IF NOT EXISTS idx_signals_source_id      ON signals(source_id);
CREATE INDEX IF NOT EXISTS idx_signals_signal_type    ON signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_signals_account_id     ON signals(account_id);
CREATE INDEX IF NOT EXISTS idx_signals_stakeholder_id ON signals(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_signals_processed      ON signals(processed);
CREATE INDEX IF NOT EXISTS idx_signals_published_at   ON signals(published_at);

-- ─── insights ────────────────────────────────────────────────────────────────
-- Claude's analysis output, one row per (signal, plan) pair.
-- Kept separate from signals so:
--   1. Ingestion never blocks on Claude API latency
--   2. The same signal can be re-analyzed in different plan contexts
-- plan_id = NULL means the insight is global, not scoped to a specific GTM plan.
CREATE TABLE IF NOT EXISTS insights (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id       INTEGER NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  plan_id         INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  summary         TEXT NOT NULL,
  relevance_score INTEGER NOT NULL CHECK (relevance_score BETWEEN 1 AND 10),
  tags            TEXT,    -- JSON array, e.g. ["hiring", "compliance", "latin-america"]
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_insights_signal_id ON insights(signal_id);
CREATE INDEX IF NOT EXISTS idx_insights_plan_id   ON insights(plan_id);

-- ─── plan_critiques ──────────────────────────────────────────────────────────
-- Constraint warnings surfaced when Claude generates or re-evaluates a plan.
-- signal_ids is a JSON array because SQLite has no array FK type;
-- resolve it in application code to load the triggering evidence in the UI.
CREATE TABLE IF NOT EXISTS plan_critiques (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id        INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  critique_type  TEXT NOT NULL CHECK (critique_type IN (
    'constraint_violation', 'risk', 'gap', 'assumption'
  )),
  severity       TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  signal_ids     TEXT,    -- JSON array of signals.id values that triggered this critique
  resolved       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plan_critiques_plan_id  ON plan_critiques(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_critiques_resolved ON plan_critiques(resolved);
