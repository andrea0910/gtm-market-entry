# Market Intelligence Agent

Monitors public signals: job postings, news, regulatory filings, earnings call transcripts, competitor blogs — and surfaces synthesized insights for strategic decision-making. 

## Architecture

| Layer | Technology | Location |
|---|---|---|
| Frontend | Next.js (App Router) → Cloudflare Pages | `frontend/` |
| API | Cloudflare Worker | `worker/` |
| Database | Cloudflare D1 (SQLite at the edge) | bound to Worker |
| Scheduler | Cloudflare Cron Triggers | `worker/wrangler.toml` |
| Reasoning | Claude API | `worker/src/` |

The Worker owns all data access and Claude API calls. The frontend is a pure presentation layer that fetches from the Worker's REST endpoints.

## Setup

### Prerequisites

- Node.js 20+
- Cloudflare account (free tier is fine)
- Wrangler CLI: `npm install -g wrangler`
- Anthropic API key

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

Apply the schema:

```bash
# Local dev database
npx wrangler d1 execute market-intel-db --local --file=../schema.sql

# Remote (Cloudflare) database
npx wrangler d1 execute market-intel-db --remote --file=../schema.sql
```

### Set secrets

```bash
cd worker
npx wrangler secret put ANTHROPIC_API_KEY
# paste your key when prompted
```

### Local development

Start the Worker:
```bash
cd worker && npm run dev
# → http://localhost:8787/api/health
```

Start the frontend:
```bash
cd frontend && npm run dev
# → http://localhost:3000
```

### Deploy

**Worker:**
```bash
cd worker && npm run deploy
```

**Frontend (first deployment):**
```bash
cd frontend
npx wrangler pages project create market-intel-frontend
npm run pages:build
npm run pages:deploy
```

**Frontend (subsequent deployments):**
```bash
cd frontend
npm run pages:build && npm run pages:deploy
```

## Database schema

See `schema.sql`. Two tables:

- `signals` — raw ingested items, one row per source article / posting / filing
- `insights` — Claude-generated summaries and relevance scores linked to a signal
