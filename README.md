# GTM Market Intelligence Dashboard

A Bloomberg-style intelligence terminal for go-to-market expansion teams. Built for the Nubank US expansion case study — monitors competitor hiring, regulatory signals, news, and earnings in real time, then surfaces synthesized briefs, pattern detections, and AI-generated GTM plans grounded in live data.

## What it does

**Live Signal Feed** — Auto-scrolling ticker of competitor and market signals (news, job postings, regulatory filings, earnings, blogs). Each card links to its source. Hover to browse manually; the feed continues scrolling.

**Market Brief** — AI-generated brief that loads automatically when the dashboard opens. Structured into sections (Key Developments, Competitive Landscape, Regulatory Watch, Open Questions). Open Questions are expandable: click any bullet to generate a grounded hypothesis based on recent signals, fetched on demand.

**Pattern Detection (Composed Signals)** — A second Claude pass over raw signals looks for cross-source patterns: hiring clusters (3+ hires in one capability within 14 days), competitive escalation (2+ high-importance signals from one account), regulatory overlap, and cross-source co-occurrence. Quiet patterns (no recent activity) are shown explicitly so silence is also signal.

**Account Board** — Per-competitor and per-regulator cards with signal counts, tier prioritization, and the top recent signal linked to its source URL.

**GTM Plan Generator** — Full-screen overlay with a visual milestone timeline, account priorities sidebar, watch items, and constraint advisories. Plans are scoped to 30/90/180/365-day horizons and downloadable as `.md`.

**Eval Page** (`/eval`) — Side-by-side comparison of vanilla Claude vs. retrieval-grounded Claude for a given market question. Shows hallucination detection with per-claim grounding verification, a grounded-% circular gauge, and metric bars comparing both outputs.

## Architecture

| Layer | Technology | Location |
|---|---|---|
| Frontend | Next.js 14 (App Router) | `frontend/` |
| API | Cloudflare Worker (TypeScript) | `worker/` |
| Database | Cloudflare D1 (SQLite at the edge) | bound to Worker |
| Scheduler | Cloudflare Cron Triggers | `worker/wrangler.toml` |
| AI (extraction) | `anthropic/claude-3-haiku` via OpenRouter | `worker/src/index.ts` |
| AI (reasoning) | `anthropic/claude-sonnet-4` via OpenRouter | `worker/src/index.ts` |

The Worker owns all data access and AI calls. The frontend is a pure presentation layer that fetches from the Worker's REST endpoints.

## Signal pipeline

```
Cron → Ingest (RSS / job boards / scrape)
     → Enrich  (Claude Haiku: importance, region, one-line summary)
     → Compose (Claude Sonnet: cross-signal pattern detection)
     → Brief   (Claude Sonnet: full market brief, auto-generated on load)
```

**Signal types:** `news` · `job_posting` · `regulatory` · `earnings` · `blog` · `social` · `manual`

**Cron schedule (wrangler.toml):**
- `0 */6 * * *` — main ingestion run
- `0 */2 * * *` — enrichment pass
- `0 * * * *` — hourly light fetch
- `0 8 * * *` — morning brief generation
- `0 22 * * *` — nightly composition pass
- `0 */4 * * *` — account board refresh

## Database schema

Seven tables. See `schema.sql` for full definitions and inline comments.

| Table | Purpose |
|---|---|
| `companies` | One row per expansion initiative (e.g. Nubank US) |
| `accounts` | Competitors, partners, prospects, regulators being monitored |
| `stakeholders` | Named individuals linked to accounts |
| `sources` | Configured ingestion endpoints (RSS feeds, job board slugs, scrape URLs) |
| `signals` | One row per ingested event — the central fact table |
| `insights` | Claude's per-signal analysis, scoped to a plan or global |
| `plan_critiques` | Constraint warnings generated when a GTM plan is evaluated |

Additional tables added via migrations:
- `briefs` — generated market briefs with markdown content and signal count
- `composed_signals` — cross-signal patterns with composition type, importance, and explanation

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/signals` | Recent signals with filters (`company_id`, `region`, `limit`) |
| GET | `/api/accounts` | Account board with top signals and signal counts |
| GET | `/api/brief` | Fetch latest brief for a company |
| POST | `/api/brief/generate` | Generate a new brief from recent signals |
| POST | `/api/brief/hypothesis` | Generate a hypothesis for a single open question |
| GET | `/api/composed-signals` | Fetch pattern detections |
| POST | `/api/plan/generate` | Generate a GTM plan for a given horizon |
| POST | `/api/eval` | Run grounded vs. vanilla Claude comparison |
| POST | `/api/admin/run-ingestion` | Manually trigger ingestion |
| POST | `/api/admin/run-enrichment` | Manually trigger enrichment pass |
| POST | `/api/admin/run-composition` | Manually trigger composition pass |
| POST | `/api/admin/run-job-board-ingestion` | Ingest job postings from Greenhouse/Lever |

## Setup

### Prerequisites

- Node.js 20+
- Cloudflare account (free tier is fine)
- Wrangler CLI: `npm install -g wrangler`
- OpenRouter API key (used for all AI calls)

### Authenticate Wrangler

```bash
wrangler login
```

### Install dependencies

```bash
cd worker && npm install
cd ../frontend && npm install
```

### Create the D1 database

```bash
cd worker
npx wrangler d1 create market-intel-db
```

Copy the `database_id` from the output into `worker/wrangler.toml`, replacing the `placeholder` value.

Apply the schema and migrations:

```bash
# Local dev
npx wrangler d1 execute market-intel-db --local --file=../schema.sql
npx wrangler d1 execute market-intel-db --local --file=../migrate_001_job_board.sql
npx wrangler d1 execute market-intel-db --local --file=../migrate_002_briefs.sql
npx wrangler d1 execute market-intel-db --local --file=../migrate_003_plans_update.sql
npx wrangler d1 execute market-intel-db --local --file=../migrate_004_stakeholders_seed.sql
npx wrangler d1 execute market-intel-db --local --file=../migrate_007_composed_signals.sql

# Remote (Cloudflare) — same files, replace --local with --remote
```

Seed initial data (companies, accounts, sources):

```bash
npx wrangler d1 execute market-intel-db --local --file=../seed.sql
```

### Set secrets

```bash
cd worker
npx wrangler secret put OPENROUTER_API_KEY
# paste your OpenRouter key when prompted
```

### Local development

Start the Worker:
```bash
cd worker && npm run dev
# → http://localhost:8787
```

Start the frontend:
```bash
cd frontend && npm run dev
# → http://localhost:3000
```

The frontend proxies `/api/*` to the local Worker via `next.config.js`.

### Deploy

**Worker:**
```bash
cd worker && npm run deploy
```

**Frontend:**
```bash
cd frontend
npm run build && npm run deploy
```

## Frontend components

| Component | File | Description |
|---|---|---|
| Dashboard | `app/page.tsx` | Root layout: brief + patterns + accounts + live feed + plan overlay |
| Market Brief | `components/MarketBrief.tsx` | Auto-generated brief, section renderer, open question hypotheses |
| Signals Feed | `components/SignalsFeed.tsx` | JS rAF auto-scroll ticker, click-to-open source links |
| Composed Signals | `components/ComposedSignals.tsx` | Pattern detection cards + quiet pattern list |
| Account Board | `components/AccountBoard.tsx` | Per-account signal cards with linked top signal |
| GTM Plan | `components/GTMPlanFull.tsx` | Full-screen plan with milestone timeline, sidebar, download |
| Top Bar | `components/TopBar.tsx` | Horizon selector, region filter, Generate Plan button |
| Eval | `app/eval/page.tsx` | Grounded vs. vanilla comparison with hallucination detection |

## Acknowledgement
This project was co-created with Claude Code. More specifically, Claude Code was used to create the foundation layers of the dashboards and improve the UI. 
