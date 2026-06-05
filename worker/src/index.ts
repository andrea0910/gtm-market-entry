import { XMLParser } from 'fast-xml-parser';

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;   // reserved for future direct use
  OPENROUTER_API_KEY: string;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: cors });
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseJson<T = any>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

// ─── Model constants ──────────────────────────────────────────────────────────

const EXTRACTION_MODEL = 'anthropic/claude-3-haiku';
const REASONING_MODEL  = 'anthropic/claude-sonnet-4';

// ─── Shared types ─────────────────────────────────────────────────────────────

interface AccountWithBoard {
  id: number;
  name: string;
  company_id: number;
  job_board_provider: 'greenhouse' | 'lever';
  job_board_slug: string;
}

interface NormalizedPosting {
  title: string;
  url: string;
  location: string | null;
  department: string | null;
  publishedAt: string | null;
  raw: unknown;
}

interface IngestResult {
  total: number;
  succeeded: number;
  failed: number;
  newPostings: number;
  failures: Array<{ account: string; error: string }>;
  summary: string;
}

interface RawSignalRow {
  id: number;
  signal_type: string;
  title: string | null;
  structured_data: string | null;
  account_name: string | null;
  account_type: string | null;
}

interface EnrichedFields {
  signal_category: string;
  importance: 'low' | 'medium' | 'high';
  one_line_summary: string;
  region: string | null;
}

interface EnrichResult {
  total: number;
  enriched: number;
  failed: number;
  skipped: number;
  summary: string;
}

interface BriefGenerateResult {
  id: number;
  markdown_content: string;
  signal_count: number;
}

interface PlanMilestone {
  timing: string;
  milestone: string;
  anchor: string;
}

interface PlanResponseJson {
  objective: string;
  milestones: PlanMilestone[];
  account_priorities: string[];
  watch_items: string[];
  critique: string | null;
}

interface PlanGenerateResult {
  id: number;
  objective: string;
  milestones: PlanMilestone[];
  account_priorities: string[];
  watch_items: string[];
  critique_markdown: string | null;
  signal_count: number;
  created_at: string;
}

interface RssArticle {
  title: string;
  url: string;
  pubDate: string | null;
  publication: string | null;
  description: string | null;
}

interface EdgarFiling {
  title: string;
  url: string;
  formType: string;
  filedAt: string | null;
  summary: string | null;
}

interface FedRegArticle {
  title: string;
  url: string;
  documentNumber: string;
  abstract: string | null;
  publicationDate: string | null;
  ruleType: string;
}

interface RecentSignalRow {
  account_id: number;
  signal_type: string;
  ingested_at: string;
  structured_data: string | null;
  signal_region: string | null;
  url: string | null;
}

interface TopSignalPayload {
  one_line_summary: string;
  importance: string;
  signal_type: string;
  url: string | null;
}

// ─── Composition types ────────────────────────────────────────────────────────

type CompositionType = 'hiring_cluster' | 'cross_source_pattern' | 'regulatory_overlap' | 'competitive_escalation';

interface EnrichedSignalForComposition {
  id: number;
  signal_type: string;
  ingested_at: string;
  signal_category: string | null;
  importance: string | null;
  one_line_summary: string | null;
  account_id: number;
  account_name: string;
  account_type: string;
}

interface SignalSummaryInput {
  signal_type: string;
  one_line_summary: string;
  importance: string;
}

interface ComposedSignalCandidate {
  compositionType: CompositionType;
  accountId: number | null;
  accountName: string | null;
  signalIds: number[];
  signals: SignalSummaryInput[];
  importance: 'high' | 'medium' | 'low';
}

interface CompositionResult {
  detected: number;
  skipped: number;
  failed: number;
  patterns: Record<CompositionType, number>;
  summary: string;
}

// ─── Greenhouse API types ─────────────────────────────────────────────────────

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  departments: Array<{ id: number; name: string }>;
  updated_at: string;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

// ─── Lever API types ──────────────────────────────────────────────────────────

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  categories: {
    location?: string;
    department?: string;
    team?: string;
    commitment?: string;
  };
  createdAt: number; // Unix ms
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const { pathname, searchParams } = new URL(request.url);

    try {
      if (request.method === 'GET') {
        if (pathname === '/api/health')        return json({ status: 'ok', timestamp: new Date().toISOString() });
        if (pathname === '/api/brief')         return briefHandler(searchParams, env);
        if (pathname === '/api/accounts')      return accounts(searchParams, env);
        if (pathname === '/api/stakeholders')  return stakeholders(searchParams, env);
        if (pathname === '/api/signals')       return signals(searchParams, env);
        if (pathname === '/api/plans/latest')  return planLatestHandler(searchParams, env);
        if (pathname === '/api/eval/vanilla')     return evalVanillaHandler(env);
        if (pathname === '/api/eval/grounded')    return evalGroundedHandler(env);
        if (pathname === '/api/composed-signals') return composedSignalsHandler(searchParams, env);
      }

      if (request.method === 'POST') {
        if (pathname === '/api/admin/run-ingestion')  return runIngestionEndpoint(searchParams, env);
        if (pathname === '/api/admin/run-enrichment') return runEnrichmentEndpoint(searchParams, env);
        if (pathname === '/api/brief/regenerate')     return regenerateBriefEndpoint(searchParams, env);
        if (pathname === '/api/brief/hypothesis')     return hypothesisHandler(request, env);
        if (pathname === '/api/plans/generate')       return planGenerateEndpoint(searchParams, env);
        if (pathname === '/api/eval/verify')           return evalVerifyHandler(request, env);
        if (pathname === '/api/admin/run-composition') return runCompositionEndpoint(searchParams, env);
      }
    } catch (e) {
      console.error('[fetch] Unhandled error:', e);
      return json({ error: 'Internal error' }, 500);
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    if (event.cron === '0 */6 * * *') {
      console.log('[cron] Job postings ingestion triggered');
      const result = await runJobPostingsIngestion(env);
      console.log('[cron] Ingestion complete:', result.summary);
    } else if (event.cron === '0 * * * *') {
      console.log('[cron] Signal enrichment triggered');
      const result = await runSignalEnrichment(env, 50);
      console.log('[cron] Enrichment complete:', result.summary);
    } else if (event.cron === '0 */2 * * *') {
      console.log('[cron] News ingestion triggered');
      const result = await runNewsIngestion(env);
      console.log('[cron] News ingestion complete:', result.summary);
    } else if (event.cron === '0 22 * * *') {
      console.log('[cron] Regulatory sources ingestion triggered (EDGAR + Federal Register)');
      await runSecFilingsIngestion(env);
      await runFedRegisterIngestion(env);
    } else if (event.cron === '0 */4 * * *') {
      console.log('[cron] Signal composition triggered');
      try {
        const result = await runComposition(env, 1);
        console.log('[cron] Composition complete:', result.summary);
      } catch (err) {
        console.error('[cron] Composition failed:', err instanceof Error ? err.message : err);
      }
    } else if (event.cron === '0 8 * * *') {
      console.log('[cron] Daily brief generation triggered');
      try {
        const result = await generateBrief(env, 1);
        console.log(`[cron] Brief generated: ${result.signal_count} signals referenced, id=${result.id}`);
      } catch (err) {
        console.error('[cron] Brief generation failed:', err instanceof Error ? err.message : err);
      }
    } else {
      console.warn('[cron] Unknown cron expression:', event.cron);
    }
  },
};

// ─── API handlers ─────────────────────────────────────────────────────────────

async function briefHandler(params: URLSearchParams, env: Env): Promise<Response> {
  const companyId = parseInt(params.get('company_id') ?? '1', 10);

  const company = await env.DB.prepare('SELECT name FROM companies WHERE id = ?')
    .bind(companyId).first<{ name: string }>();
  if (!company) return json({ error: 'Company not found' }, 404);

  const row = await env.DB.prepare(
    `SELECT id, generated_at, markdown_content, signal_ids_referenced
     FROM briefs WHERE company_id = ? ORDER BY generated_at DESC LIMIT 1`
  ).bind(companyId).first<{
    id: number; generated_at: string; markdown_content: string; signal_ids_referenced: string | null;
  }>();

  if (!row) {
    return json({
      company_id: companyId,
      title: `${company.name} · US Market Entry Brief`,
      generated_at: null,
      markdown_content: null,
      signal_count: 0,
      no_brief: true,
    });
  }

  const signalIds = parseJson<number[]>(row.signal_ids_referenced) ?? [];
  return json({
    id: row.id,
    company_id: companyId,
    title: `${company.name} · US Market Entry Brief`,
    generated_at: row.generated_at,
    markdown_content: row.markdown_content,
    signal_count: signalIds.length,
    no_brief: false,
  });
}

async function accounts(params: URLSearchParams, env: Env): Promise<Response> {
  const companyId = params.get('company_id') ?? '1';
  const region = params.get('region');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Run both queries in parallel
  const [{ results: accountRows }, { results: recentRows }] = await Promise.all([
    // All accounts with all-time signal totals
    env.DB.prepare(
      `SELECT a.id, a.name, a.type, a.tier, a.status, a.hq_country, a.website, a.description, a.metadata,
              COUNT(s.id) AS signal_count,
              SUM(CASE WHEN s.processed = 1 THEN 1 ELSE 0 END) AS enriched_count
       FROM accounts a
       LEFT JOIN signals s ON s.account_id = a.id
       WHERE a.company_id = ?
       GROUP BY a.id
       ORDER BY a.tier, a.type, a.name`
    ).bind(companyId).all<any>(),

    // All recent signals — always fetch everything, region is a boost multiplier not a filter
    env.DB.prepare(
      `SELECT account_id, signal_type, ingested_at, structured_data, url,
              json_extract(structured_data, '$.region') AS signal_region
       FROM signals
       WHERE company_id = ? AND ingested_at >= ?
       ORDER BY ingested_at DESC`
    ).bind(companyId, thirtyDaysAgo).all<RecentSignalRow>(),
  ]);

  // Group recent signals by account_id (already sorted newest-first)
  const sigsByAccount = new Map<number, RecentSignalRow[]>();
  for (const sig of recentRows) {
    const arr = sigsByAccount.get(sig.account_id) ?? [];
    arr.push(sig);
    sigsByAccount.set(sig.account_id, arr);
  }

  const now = Date.now();
  const sevenDaysAgo = now - 7  * 24 * 60 * 60 * 1000;
  const threeDaysAgo = now - 3  * 24 * 60 * 60 * 1000;

  const enriched = accountRows.map((account: any) => {
    const recentSigs = sigsByAccount.get(account.id) ?? [];
    let heatScore = 0;
    let topHighSignal: TopSignalPayload | null = null;
    let topAnySignal: TopSignalPayload | null = null;

    for (const sig of recentSigs) {
      const sd = parseJson<any>(sig.structured_data);
      const importance: string = sd?.importance ?? 'low';
      const inRegion = region ? sig.signal_region === region : false;

      const importanceWeight = importance === 'high' ? 3 : importance === 'medium' ? 1 : 0.3;
      const ingestedMs = new Date(sig.ingested_at).getTime();
      const recencyMult = ingestedMs >= threeDaysAgo ? 3 : ingestedMs >= sevenDaysAgo ? 2 : 1;
      const typeMult   = (sig.signal_type === 'news' || sig.signal_type === 'regulatory') ? 1.5 : 1;
      const regionBoost = inRegion ? 2.0 : 1.0;
      heatScore += importanceWeight * recencyMult * typeMult * regionBoost;

      if (sd?.one_line_summary) {
        // When region selected, prefer region-matched signals for top_signal display
        const regionMatch = !region || inRegion;
        if (!topHighSignal && importance === 'high' && regionMatch) {
          topHighSignal = { one_line_summary: sd.one_line_summary, importance, signal_type: sig.signal_type, url: sig.url };
        }
        if (!topHighSignal && importance === 'high' && !topAnySignal) {
          topHighSignal = { one_line_summary: sd.one_line_summary, importance, signal_type: sig.signal_type, url: sig.url };
        }
        if (!topAnySignal && regionMatch) {
          topAnySignal = { one_line_summary: sd.one_line_summary, importance, signal_type: sig.signal_type, url: sig.url };
        }
        if (!topAnySignal) {
          topAnySignal = { one_line_summary: sd.one_line_summary, importance, signal_type: sig.signal_type, url: sig.url };
        }
      }
    }

    const regionalCount = region
      ? recentSigs.filter(s => s.signal_region === region).length
      : recentSigs.length;

    return {
      ...account,
      heat_score:       Math.round(heatScore * 10) / 10,
      signal_count_30d: regionalCount,
      top_signal:       topHighSignal ?? topAnySignal,
    };
  });

  return json({ accounts: enriched, region: region ?? null });
}

async function stakeholders(params: URLSearchParams, env: Env): Promise<Response> {
  const companyId = params.get('company_id') ?? '1';

  const { results } = await env.DB.prepare(
    `SELECT id, name, role, type, public_positions, account_id
     FROM stakeholders WHERE company_id = ? ORDER BY type, name`
  ).bind(companyId).all();

  const grouped: Record<string, typeof results> = {};
  for (const row of results) {
    const t = row.type as string;
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(row);
  }

  return json({ stakeholders: grouped });
}

async function signals(params: URLSearchParams, env: Env): Promise<Response> {
  const companyId = params.get('company_id') ?? '1';
  const region = params.get('region');
  const limit = Math.min(parseInt(params.get('limit') ?? '20', 10), 100);

  const { results } = await env.DB.prepare(
    `SELECT s.id, s.signal_type, s.url, s.title, s.published_at, s.ingested_at,
            s.account_id, s.stakeholder_id, s.structured_data, s.processed,
            a.name AS account_name
     FROM signals s
     LEFT JOIN accounts a ON a.id = s.account_id
     WHERE s.company_id = ?
     ORDER BY s.ingested_at DESC
     LIMIT ?`
  ).bind(companyId, limit).all<any>();

  const parsed = results.map(s => ({
    ...s,
    structured_data: s.structured_data
      ? (() => { try { return JSON.parse(s.structured_data); } catch { return null; } })()
      : null,
  }));

  return json({ signals: parsed, region: region ?? null });
}

// ─── Manual triggers ──────────────────────────────────────────────────────────

async function runIngestionEndpoint(params: URLSearchParams, env: Env): Promise<Response> {
  const source = params.get('source') ?? 'job_postings';
  if (source === 'job_postings')      return json(await runJobPostingsIngestion(env));
  if (source === 'news')             return json(await runNewsIngestion(env));
  if (source === 'sec_filings')      return json(await runSecFilingsIngestion(env));
  if (source === 'federal_register') return json(await runFedRegisterIngestion(env));
  return json({ error: `Unknown source "${source}". Valid: job_postings, news, sec_filings, federal_register` }, 400);
}

async function runEnrichmentEndpoint(params: URLSearchParams, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY not configured' }, 500);
  const limit = Math.min(parseInt(params.get('limit') ?? '100', 10), 200);
  return json(await runSignalEnrichment(env, limit));
}

async function regenerateBriefEndpoint(params: URLSearchParams, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY not configured' }, 500);
  const companyId = parseInt(params.get('company_id') ?? '1', 10);

  const company = await env.DB.prepare('SELECT name FROM companies WHERE id = ?')
    .bind(companyId).first<{ name: string }>();
  if (!company) return json({ error: 'Company not found' }, 404);

  console.log(`[brief] Manual regeneration triggered for company ${companyId}`);
  const result = await generateBrief(env, companyId);

  return json({
    id: result.id,
    company_id: companyId,
    title: `${company.name} · US Market Entry Brief`,
    generated_at: new Date().toISOString(),
    markdown_content: result.markdown_content,
    signal_count: result.signal_count,
    no_brief: false,
  });
}

async function hypothesisHandler(request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY not configured' }, 500);

  const body = await request.json<{ company_id?: string; question: string }>();
  const companyId = parseInt(body.company_id ?? '1', 10);
  const question = body.question?.trim();
  if (!question) return json({ error: 'question required' }, 400);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { results: sigs } = await env.DB.prepare(
    `SELECT s.signal_type, s.structured_data, a.name AS account_name
     FROM signals s
     LEFT JOIN accounts a ON a.id = s.account_id
     WHERE s.company_id = ? AND s.processed = 1 AND s.ingested_at >= ?
     ORDER BY s.ingested_at DESC
     LIMIT 60`
  ).bind(companyId, thirtyDaysAgo).all<{ signal_type: string; structured_data: string | null; account_name: string | null }>();

  const context = sigs
    .map(s => {
      const sd = parseJson<any>(s.structured_data);
      const summary = sd?.one_line_summary;
      return summary ? `[${s.account_name ?? 'Unknown'} | ${s.signal_type}] ${summary}` : null;
    })
    .filter(Boolean)
    .join('\n');

  const prompt = `You are a market intelligence analyst for Nubank's US expansion team. Based only on the signals below, write a 2-3 sentence working hypothesis answering the question. Be specific about what the signals suggest. If signals don't fully answer it, state what they imply and what remains genuinely uncertain.

QUESTION: ${question}

SIGNALS (last 30 days):
${context || 'No enriched signals available.'}

Write only the hypothesis — no headers, no labels, no preamble.`;

  const hypothesis = await callOpenRouter(env.OPENROUTER_API_KEY, REASONING_MODEL, [{ role: 'user', content: prompt }], false, 200);
  return json({ hypothesis });
}

// ─── Brief generation ─────────────────────────────────────────────────────────

async function generateBrief(env: Env, companyId: number, dryRun = false): Promise<BriefGenerateResult> {
  // 1. Company context
  const company = await env.DB.prepare(
    'SELECT name, product_surface, entry_thesis FROM companies WHERE id = ?'
  ).bind(companyId).first<{ name: string; product_surface: string; entry_thesis: string }>();
  if (!company) throw new Error(`Company ${companyId} not found`);

  const productSurface = parseJson<string[]>(company.product_surface)?.join(', ') ?? company.product_surface;

  // 2. Watchlist
  const { results: accountRows } = await env.DB.prepare(
    `SELECT name, type, tier, description FROM accounts WHERE company_id = ? ORDER BY tier, type, name`
  ).bind(companyId).all<{ name: string; type: string; tier: number; description: string | null }>();

  // 3. Enriched signals from the last 14 days, ranked by importance then recency
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { results: signalRows } = await env.DB.prepare(`
    SELECT s.id, s.structured_data, a.name AS account_name
    FROM signals s
    LEFT JOIN accounts a ON a.id = s.account_id
    WHERE s.company_id = ? AND s.processed = 1 AND s.ingested_at >= ?
    ORDER BY
      CASE json_extract(s.structured_data, '$.importance')
        WHEN 'high'   THEN 1
        WHEN 'medium' THEN 2
        ELSE               3
      END,
      s.ingested_at DESC
    LIMIT 60
  `).bind(companyId, cutoff).all<{ id: number; structured_data: string | null; account_name: string | null }>();

  // 4. Build signal context lines
  const signalIds: number[] = [];
  const signalLines: string[] = [];

  for (const row of signalRows) {
    const sd = parseJson<any>(row.structured_data);
    if (!sd?.one_line_summary) continue;
    signalIds.push(row.id);
    signalLines.push(
      `[${row.account_name ?? 'Unknown'} | ${sd.signal_category ?? 'other'} | ${(sd.importance ?? 'low').toUpperCase()}] ${sd.one_line_summary}`
    );
  }

  // 5. Build prompt
  const accountList = accountRows
    .map(a => `- ${a.name} (${a.type}, Tier ${a.tier})${a.description ? ': ' + a.description.slice(0, 100) : ''}`)
    .join('\n');

  const signalContext = signalLines.length > 0
    ? signalLines.join('\n')
    : '(No enriched signals in the last 14 days — the team has not yet run enrichment, or no new signals arrived.)';

  const prompt = `You are a market intelligence analyst writing a brief for the Country GM of ${company.name}'s US expansion.

COMPANY: ${company.name}
PRODUCTS: ${productSurface}
ENTRY THESIS: ${company.entry_thesis}

MONITORED ACCOUNTS (${accountRows.length} total):
${accountList}

ENRICHED SIGNALS — last 14 days (${signalLines.length} signals):
Format: [Account | category | IMPORTANCE] one-line summary
${signalContext}

---

Write a market brief in markdown. Use exactly these four section headers in this order:

## Where we are
2-3 sentences on the current state of the US neobank market as it relates to ${company.name}'s entry. Ground it in what the signals show, not generic knowledge.

## What changed this week
Bullet points only. Each bullet must reference a specific signal from the list above with a citation like (Chime, hiring) or (SoFi, leadership). Do not cite anything not in the list above.

## What this means
2-3 sentences interpreting what these changes mean for ${company.name}'s entry timing, positioning, or priorities.

## Open questions
Bullet points naming specific gaps the in-country team must investigate — things the signals explicitly cannot answer. Be honest about what is unknown. Do not speculate.

---
RULES (follow strictly):
1. Only reference signals provided above. Never invent events or companies.
2. Citations format: (CompanyName, category) — e.g. (Chime, hiring), (CFPB, regulatory).
3. Entire brief must be under 400 words.
4. "Open questions" must be specific and actionable — not generic platitudes like "monitor the market".
5. If signal data is thin, say so plainly in "Where we are" rather than padding with speculation.
6. Use **bold** (double asterisks) to emphasize specific company names, key actions, and critical insights throughout the brief.`;

  console.log(`[brief] Calling ${REASONING_MODEL} with ${signalLines.length} signals`);

  // 6. Call reasoning model (markdown output, not JSON)
  const markdown = await callOpenRouter(
    env.OPENROUTER_API_KEY,
    REASONING_MODEL,
    [{ role: 'user', content: prompt }],
    false,
    700,
  );

  console.log(`[brief] Generated ${markdown.length} chars`);

  // 7. Persist (skipped when dryRun)
  if (dryRun) {
    return { id: -1, markdown_content: markdown.trim(), signal_count: signalLines.length };
  }

  const insert = await env.DB.prepare(
    `INSERT INTO briefs (company_id, generated_at, markdown_content, signal_ids_referenced)
     VALUES (?, datetime('now'), ?, ?)`
  ).bind(companyId, markdown.trim(), JSON.stringify(signalIds)).run();

  return {
    id: insert.meta.last_row_id as number,
    markdown_content: markdown.trim(),
    signal_count: signalLines.length,
  };
}

// ─── GTM Plan handlers ────────────────────────────────────────────────────────

async function planLatestHandler(params: URLSearchParams, env: Env): Promise<Response> {
  const companyId = parseInt(params.get('company_id') ?? '1', 10);
  const horizonDays = parseInt(params.get('horizon_days') ?? '90', 10);

  const row = await env.DB.prepare(
    `SELECT id, content, critique_markdown, signal_ids_referenced, created_at
     FROM plans WHERE company_id = ? AND horizon_days = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(companyId, horizonDays).first<{
    id: number; content: string | null;
    critique_markdown: string | null; signal_ids_referenced: string | null; created_at: string;
  }>();

  if (!row?.content) return json({ no_plan: true });

  const plan = parseJson<PlanResponseJson>(row.content);
  if (!plan?.objective) return json({ no_plan: true });

  const signalIds = parseJson<number[]>(row.signal_ids_referenced) ?? [];
  return json({
    id: row.id,
    company_id: companyId,
    horizon_days: horizonDays,
    objective: plan.objective,
    milestones: plan.milestones ?? [],
    account_priorities: plan.account_priorities ?? [],
    watch_items: plan.watch_items ?? [],
    critique_markdown: row.critique_markdown ?? null,
    signal_count: signalIds.length,
    created_at: row.created_at,
    no_plan: false,
  });
}

async function planGenerateEndpoint(params: URLSearchParams, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY not configured' }, 500);
  const companyId = parseInt(params.get('company_id') ?? '1', 10);
  const horizonDays = parseInt(params.get('horizon_days') ?? '90', 10);

  if (![30, 90, 180, 365].includes(horizonDays)) {
    return json({ error: 'horizon_days must be one of: 30, 90, 180, 365' }, 400);
  }

  const company = await env.DB.prepare('SELECT name FROM companies WHERE id = ?')
    .bind(companyId).first<{ name: string }>();
  if (!company) return json({ error: 'Company not found' }, 404);

  console.log(`[plan] Generating ${horizonDays}d plan for company ${companyId}`);
  const result = await generatePlan(env, companyId, horizonDays);

  return json({
    id: result.id,
    company_id: companyId,
    horizon_days: horizonDays,
    objective: result.objective,
    milestones: result.milestones,
    account_priorities: result.account_priorities,
    watch_items: result.watch_items,
    critique_markdown: result.critique_markdown,
    signal_count: result.signal_count,
    created_at: result.created_at,
    no_plan: false,
  });
}

async function generatePlan(env: Env, companyId: number, horizonDays: number): Promise<PlanGenerateResult> {
  const company = await env.DB.prepare(
    'SELECT name, product_surface, entry_thesis FROM companies WHERE id = ?'
  ).bind(companyId).first<{ name: string; product_surface: string; entry_thesis: string }>();
  if (!company) throw new Error(`Company ${companyId} not found`);

  const productSurface = parseJson<string[]>(company.product_surface)?.join(', ') ?? company.product_surface;

  const { results: accountRows } = await env.DB.prepare(
    `SELECT name, type, tier, description FROM accounts WHERE company_id = ? ORDER BY tier, type, name`
  ).bind(companyId).all<{ name: string; type: string; tier: number; description: string | null }>();

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { results: signalRows } = await env.DB.prepare(`
    SELECT s.id, s.structured_data, a.name AS account_name
    FROM signals s
    LEFT JOIN accounts a ON a.id = s.account_id
    WHERE s.company_id = ? AND s.processed = 1 AND s.ingested_at >= ?
    ORDER BY
      CASE json_extract(s.structured_data, '$.importance')
        WHEN 'high'   THEN 1
        WHEN 'medium' THEN 2
        ELSE               3
      END,
      s.ingested_at DESC
    LIMIT 40
  `).bind(companyId, cutoff).all<{ id: number; structured_data: string | null; account_name: string | null }>();

  const signalIds: number[] = [];
  const signalLines: string[] = [];
  for (const row of signalRows) {
    const sd = parseJson<any>(row.structured_data);
    if (!sd?.one_line_summary) continue;
    signalIds.push(row.id);
    signalLines.push(
      `[${row.account_name ?? 'Unknown'} | ${sd.signal_category ?? 'other'} | ${(sd.importance ?? 'low').toUpperCase()}] ${sd.one_line_summary}`
    );
  }

  const accountList = accountRows
    .map(a => `- ${a.name} (${a.type}, Tier ${a.tier})${a.description ? ': ' + a.description.slice(0, 100) : ''}`)
    .join('\n');

  const signalContext = signalLines.length > 0
    ? signalLines.join('\n')
    : '(No enriched signals in the last 30 days — run signal enrichment first.)';

  const milestoneCount = horizonDays <= 30 ? '2-3' : horizonDays <= 90 ? '3-5' : horizonDays <= 180 ? '4-6' : '5-8';

  const prompt = `You are a senior GTM strategist generating a ${horizonDays}-day market entry plan for ${company.name}'s US expansion.

COMPANY: ${company.name}
PRODUCTS: ${productSurface}
ENTRY THESIS: ${company.entry_thesis}

REGULATORY DOMAIN KNOWLEDGE (hard constraints — these timelines cannot be compressed):
- Bank charter (OCC or state): 12–18 months minimum from application filing
- Sponsor bank partnership (BaaS): 4–6 months to select, negotiate, and integrate
- Money transmitter license: 3–9 months per state; 50-state coverage = 3–5 years
- FinCEN BSA/AML compliance program: must be fully operational before first live transaction
- CFPB registration (if applicable): 30–60 days
- Realistic timeline from first US hire to regulated consumer product launch: 18–36 months

MONITORED ACCOUNTS (${accountRows.length} total):
${accountList}

ENRICHED SIGNALS — last 30 days (${signalLines.length} signals):
Format: [Account | category | IMPORTANCE] one-line summary
${signalContext}

---

Generate a ${horizonDays}-day GTM plan grounded in the signals above. Respond with ONLY a valid JSON object — no markdown fences, no explanation:

{
  "objective": "One sentence: the single most important thing to accomplish in ${horizonDays} days, specific and measurable",
  "milestones": [
    {
      "timing": "e.g. Days 1-30, Month 2-3, Q3",
      "milestone": "What concretely gets built, signed, or decided",
      "anchor": "The specific signal or regulatory fact that makes this timing realistic or urgent"
    }
  ],
  "account_priorities": [
    "AccountName: one sentence on what action to take and why now, grounded in signals"
  ],
  "watch_items": [
    "Specific event to watch + what you would do if it tips bearish or bullish"
  ],
  "critique": null
}

CONSTRAINTS:
- Milestones: exactly ${milestoneCount}, ordered chronologically
- Account priorities: 3-5 most relevant accounts; cite specific signals
- Watch items: 2-4 items tied to specific signals or regulatory risks
- All claims must be grounded in the signals or domain knowledge above

CRITIQUE FIELD — read carefully:
Set to null UNLESS there is a real contradiction between the ${horizonDays}-day horizon and what is achievable.

Critique SHOULD fire when:
- A milestone requires a regulatory process that physically cannot complete in ${horizonDays} days (e.g. launching a regulated deposit product in 30 days when sponsor bank partnership alone takes 4-6 months)
- A milestone assumes a partnership that signals show is at risk
- The thesis contradicts a condition the recent signals directly evidence

Critique MUST NOT fire when:
- The plan is appropriately scoped (a 365-day plan focused on "establish regulatory roadmap" deserves no critique)
- You want to add general caveats about uncertainty
- The plan is cautious or conservative

If critique IS warranted: 2-4 sentences naming the exact milestone that is infeasible, the exact constraint it violates, and the realistic minimum timeline.
If critique IS NOT warranted: return null exactly — not an empty string, not "null", but JSON null.`;

  console.log(`[plan] Calling ${REASONING_MODEL} with ${signalLines.length} signals`);

  const raw = await callOpenRouter(
    env.OPENROUTER_API_KEY,
    REASONING_MODEL,
    [{ role: 'user', content: prompt }],
    true,
    2000,
  );

  let planJson: PlanResponseJson;
  try {
    planJson = JSON.parse(raw) as PlanResponseJson;
  } catch {
    throw new Error(`Plan JSON parse failed: ${raw.slice(0, 200)}`);
  }

  if (!planJson.objective || !Array.isArray(planJson.milestones)) {
    throw new Error(`Plan response missing required fields: ${raw.slice(0, 200)}`);
  }

  const critique = typeof planJson.critique === 'string' && planJson.critique.trim().length > 10
    ? planJson.critique.trim()
    : null;

  console.log(`[plan] Generated: ${planJson.milestones.length} milestones, critique=${critique ? 'yes' : 'no'}`);

  const insert = await env.DB.prepare(
    `INSERT INTO plans (company_id, name, horizon_days, thesis, content, critique_markdown, signal_ids_referenced, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`
  ).bind(
    companyId,
    `${company.name} — ${horizonDays}d GTM Plan`,
    horizonDays,
    company.entry_thesis ?? '',
    JSON.stringify(planJson),
    critique,
    JSON.stringify(signalIds),
  ).run();

  const now = new Date().toISOString();
  return {
    id: insert.meta.last_row_id as number,
    objective: planJson.objective,
    milestones: planJson.milestones,
    account_priorities: planJson.account_priorities ?? [],
    watch_items: planJson.watch_items ?? [],
    critique_markdown: critique,
    signal_count: signalIds.length,
    created_at: now,
  };
}

// ─── Job postings ingestion ───────────────────────────────────────────────────

async function runJobPostingsIngestion(env: Env): Promise<IngestResult> {
  const { results: accountRows } = await env.DB.prepare(
    `SELECT id, name, company_id, job_board_provider, job_board_slug
     FROM accounts WHERE job_board_provider IS NOT NULL`
  ).all<AccountWithBoard>();

  console.log(`[job-postings] Processing ${accountRows.length} accounts`);

  const failures: Array<{ account: string; error: string }> = [];
  let succeeded = 0;
  let newPostings = 0;

  for (const account of accountRows) {
    try {
      console.log(`[job-postings] Fetching ${account.name} (${account.job_board_provider}:${account.job_board_slug})`);
      const postings = account.job_board_provider === 'greenhouse'
        ? await fetchGreenhouseJobs(account.job_board_slug)
        : await fetchLeverPostings(account.job_board_slug);
      console.log(`[job-postings] ${account.name}: ${postings.length} postings fetched`);
      const inserted = await writeJobSignals(env, account, postings);
      newPostings += inserted;
      succeeded++;
      console.log(`[job-postings] ${account.name}: ${inserted} new, ${postings.length - inserted} already seen`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ account: account.name, error: msg });
      console.error(`[job-postings] ${account.name} FAILED: ${msg}`);
    }
  }

  const failed = failures.length;
  const summary = [
    `Processed ${accountRows.length} accounts:`,
    `${succeeded} succeeded (${newPostings} new postings),`,
    `${failed} failed${failed > 0 ? ` (${failures.map(f => `${f.account}: ${f.error}`).join(', ')})` : ''}`,
  ].join(' ');

  console.log(`[job-postings] SUMMARY: ${summary}`);
  return { total: accountRows.length, succeeded, failed, newPostings, failures, summary };
}

// ─── Source fetchers ──────────────────────────────────────────────────────────

async function fetchGreenhouseJobs(slug: string): Promise<NormalizedPosting[]> {
  let res: Response;
  try {
    res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, {
      headers: { 'User-Agent': 'gtm-market-intel/1.0' },
    });
  } catch (err) {
    throw new Error(`network error: ${err}`);
  }
  if (res.status === 404) throw new Error('404 — slug not found on Greenhouse');
  if (!res.ok) throw new Error(`HTTP ${res.status} from Greenhouse`);

  const data = (await res.json()) as GreenhouseResponse;
  return (data.jobs ?? []).map(job => ({
    title: job.title,
    url: job.absolute_url,
    location: job.location?.name ?? null,
    department: job.departments?.[0]?.name ?? null,
    publishedAt: job.updated_at ?? null,
    raw: job,
  }));
}

async function fetchLeverPostings(slug: string): Promise<NormalizedPosting[]> {
  let res: Response;
  try {
    res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
      headers: { 'User-Agent': 'gtm-market-intel/1.0' },
    });
  } catch (err) {
    throw new Error(`network error: ${err}`);
  }
  if (res.status === 404) throw new Error('404 — slug not found on Lever');
  if (!res.ok) throw new Error(`HTTP ${res.status} from Lever`);

  const data = (await res.json()) as LeverPosting[];
  if (!Array.isArray(data)) throw new Error(`Lever returned unexpected format: ${typeof data}`);

  return data.map(posting => ({
    title: posting.text,
    url: posting.hostedUrl,
    location: posting.categories?.location ?? null,
    department: posting.categories?.department ?? posting.categories?.team ?? null,
    publishedAt: posting.createdAt ? new Date(posting.createdAt).toISOString() : null,
    raw: posting,
  }));
}

// ─── Signal writer ────────────────────────────────────────────────────────────

const INSERT_SQL = `
  INSERT OR IGNORE INTO signals
    (company_id, signal_type, account_id, url, title, raw_content, structured_data, published_at, url_hash, processed)
  VALUES (?, 'job_posting', ?, ?, ?, ?, ?, ?, ?, 0)
`;

const BATCH_SIZE = 50;

async function writeJobSignals(
  env: Env,
  account: AccountWithBoard,
  postings: NormalizedPosting[],
): Promise<number> {
  if (postings.length === 0) return 0;

  const stmts = await Promise.all(
    postings.map(async posting => {
      const hash = await sha256(`${account.id}:${posting.url}`);
      const structuredData = JSON.stringify({
        job_title: posting.title,
        location: posting.location,
        department: posting.department,
        signal_tags: [],
      });
      return env.DB.prepare(INSERT_SQL).bind(
        account.company_id,
        account.id,
        posting.url,
        posting.title,
        JSON.stringify(posting.raw),
        structuredData,
        posting.publishedAt,
        hash,
      );
    }),
  );

  let inserted = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const results = await env.DB.batch(stmts.slice(i, i + BATCH_SIZE));
    for (const r of results) {
      if (r.meta.changes > 0) inserted++;
    }
  }
  return inserted;
}

async function enrichRegulatorySignal(env: Env, signal: RawSignalRow): Promise<EnrichedFields | null> {
  const structured = parseJson<any>(signal.structured_data) ?? {};
  const description = (structured.description ?? structured.abstract ?? '').toString().slice(0, 400);
  const filingType = structured.form_type ?? structured.rule_type ?? 'regulatory filing';

  const prompt = `You are a competitive intelligence analyst for Nubank's US market expansion team.

Analyze this regulatory filing or rule and classify it.

Issuing authority: ${signal.account_name ?? 'Unknown'} (${signal.account_type ?? 'regulator'})
Filing type: ${filingType}
Title: ${signal.title ?? 'Unknown'}
Description: ${description || 'No description available'}

Respond with a JSON object only — no explanation, no markdown:
{
  "signal_category": one of ["regulatory_change","competitor_funding","leadership_change","product_launch","market_news","other"],
  "importance": one of ["low","medium","high"],
  "one_line_summary": "under 15 words: why this matters for Nubank US entry strategy",
  "region": "US state name" or null
}

Importance guide:
- high = rule or event that directly changes Nubank's compliance requirements, product design constraints, or competitor charter status (open banking mandate, fintech charter rule, enforcement action against a direct competitor)
- medium = notable regulatory development to monitor closely
- low = routine administrative action unlikely to affect Nubank's entry plan`;

  const raw = await callOpenRouter(env.OPENROUTER_API_KEY, EXTRACTION_MODEL, [
    { role: 'user', content: prompt },
  ]);

  return parseEnrichedFields(raw, signal.id);
}

// ─── News ingestion ───────────────────────────────────────────────────────────

async function runNewsIngestion(env: Env): Promise<IngestResult> {
  const { results: accountRows } = await env.DB.prepare(
    `SELECT id, name, company_id, news_query FROM accounts WHERE news_query IS NOT NULL`
  ).all<{ id: number; name: string; company_id: number; news_query: string }>();

  console.log(`[news] Processing ${accountRows.length} accounts`);

  const failures: Array<{ account: string; error: string }> = [];
  let succeeded = 0;
  let newArticles = 0;

  for (const account of accountRows) {
    try {
      console.log(`[news] Fetching: ${account.name}`);
      const articles = await fetchNewsRss(account.news_query);
      console.log(`[news] ${account.name}: ${articles.length} articles in feed`);
      const inserted = await writeNewsSignals(env, account, articles);
      newArticles += inserted;
      succeeded++;
      console.log(`[news] ${account.name}: ${inserted} new, ${articles.length - inserted} already seen`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ account: account.name, error: msg });
      console.error(`[news] ${account.name} FAILED: ${msg}`);
    }
    // Polite delay — Google News 429s on rapid bursts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const failed = failures.length;
  const summary = [
    `Processed ${accountRows.length} accounts:`,
    `${succeeded} succeeded (${newArticles} new articles),`,
    `${failed} failed${failed > 0 ? ` (${failures.map(f => `${f.account}: ${f.error}`).join(', ')})` : ''}`,
  ].join(' ');

  console.log(`[news] SUMMARY: ${summary}`);
  return { total: accountRows.length, succeeded, failed, newPostings: newArticles, failures, summary };
}

async function fetchNewsRss(query: string): Promise<RssArticle[]> {
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'gtm-market-intel/1.0' },
  });

  if (res.status === 429) throw new Error('Rate limited (429)');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xml = await res.text();
  if (!xml.includes('<item>')) {
    console.log(`[news] Empty feed for: ${query.slice(0, 60)}`);
    return [];
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'item',
    allowBooleanAttributes: true,
  });

  let parsed: any;
  try { parsed = parser.parse(xml); } catch { throw new Error('RSS XML parse failed'); }

  const items: any[] = parsed?.rss?.channel?.item ?? [];
  if (items.length === 0) return [];

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  return items
    .map((item): RssArticle => {
      // pubDate
      let pubDate: string | null = null;
      if (item.pubDate) {
        const d = new Date(String(item.pubDate));
        if (!isNaN(d.getTime())) pubDate = d.toISOString();
      }

      // source element: can be string or {#text, @_url}
      let publication: string | null = null;
      if (item.source) {
        publication = typeof item.source === 'string'
          ? item.source
          : (item.source['#text'] ?? null);
      }

      // Strip HTML/entities from description
      const description = item.description
        ? String(item.description).replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim().slice(0, 500)
        : null;

      return {
        title: String(item.title ?? '').trim(),
        url: String(item.link ?? '').trim(),
        pubDate,
        publication,
        description,
      };
    })
    .filter(a => {
      if (!a.url || !a.title) return false;
      if (!a.pubDate) return true; // keep if no date — better than discarding
      return new Date(a.pubDate) >= cutoff;
    });
}

const NEWS_INSERT_SQL = `
  INSERT OR IGNORE INTO signals
    (company_id, signal_type, account_id, url, title, raw_content, structured_data, published_at, url_hash, processed)
  VALUES (?, 'news', ?, ?, ?, ?, ?, ?, ?, 0)
`;

async function writeNewsSignals(
  env: Env,
  account: { id: number; company_id: number; name: string },
  articles: RssArticle[],
): Promise<number> {
  if (articles.length === 0) return 0;

  const stmts = await Promise.all(
    articles.map(async article => {
      const hash = await sha256(`${account.id}:${article.url}`);
      const structuredData = JSON.stringify({
        title: article.title,
        publication: article.publication,
        description: article.description,
        signal_tags: [],
      });
      return env.DB.prepare(NEWS_INSERT_SQL).bind(
        account.company_id,
        account.id,
        article.url,
        article.title,
        JSON.stringify(article),
        structuredData,
        article.pubDate,
        hash,
      );
    }),
  );

  let inserted = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const results = await env.DB.batch(stmts.slice(i, i + BATCH_SIZE));
    for (const r of results) {
      if (r.meta.changes > 0) inserted++;
    }
  }
  return inserted;
}

// ─── SEC EDGAR ingestion ─────────────────────────────────────────────────────

async function runSecFilingsIngestion(env: Env): Promise<IngestResult> {
  const { results: accountRows } = await env.DB.prepare(
    `SELECT id, name, company_id, sec_cik FROM accounts WHERE sec_cik IS NOT NULL`
  ).all<{ id: number; name: string; company_id: number; sec_cik: string }>();

  console.log(`[edgar] Processing ${accountRows.length} accounts with SEC CIKs`);

  const failures: Array<{ account: string; error: string }> = [];
  let succeeded = 0, newFilings = 0;

  for (const account of accountRows) {
    try {
      const filings = await fetchEdgarFilings(account.sec_cik);
      console.log(`[edgar] ${account.name}: ${filings.length} recent filings`);
      const inserted = await writeRegulatorySignals(
        env, account,
        filings.map(f => ({
          title: f.title,
          url: f.url,
          publishedAt: f.filedAt,
          structuredData: { form_type: f.formType, description: f.summary, signal_tags: [] },
        })),
      );
      newFilings += inserted;
      succeeded++;
      console.log(`[edgar] ${account.name}: ${inserted} new`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ account: account.name, error: msg });
      console.error(`[edgar] ${account.name} FAILED: ${msg}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const summary = `${succeeded}/${accountRows.length} accounts (${newFilings} new filings, ${failures.length} failed)`;
  console.log(`[edgar] SUMMARY: ${summary}`);
  return { total: accountRows.length, succeeded, failed: failures.length, newPostings: newFilings, failures, summary };
}

async function fetchEdgarFilings(cik: string): Promise<EdgarFiling[]> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=8-K&dateb=&owner=include&count=20&search_text=&output=atom`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'gtm-market-intel research@gtm-intel.dev',
      'Accept': 'application/atom+xml, application/xml',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from EDGAR`);

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'entry',
    removeNSPrefix: true,
    allowBooleanAttributes: true,
  });

  let parsed: any;
  try { parsed = parser.parse(xml); } catch { throw new Error('EDGAR Atom parse failed'); }

  const entries: any[] = parsed?.feed?.entry ?? [];
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return entries
    .map((entry): EdgarFiling | null => {
      // Title may be {#text, @_type} or plain string
      const titleRaw = entry.title;
      const title = (typeof titleRaw === 'object' ? titleRaw['#text'] : String(titleRaw ?? '')).trim();

      // <link rel="alternate" href="..."/> → object with @_href
      const linkRaw = entry.link;
      let url = '';
      if (Array.isArray(linkRaw)) {
        const alt = linkRaw.find((l: any) => l['@_rel'] === 'alternate') ?? linkRaw[0];
        url = alt?.['@_href'] ?? '';
      } else if (linkRaw && typeof linkRaw === 'object') {
        url = linkRaw['@_href'] ?? '';
      }
      if (!url) return null;

      // <category term="8-K"/>
      const cat = entry.category;
      const formType = (cat && typeof cat === 'object') ? (cat['@_term'] ?? '') : '';

      // <updated> → ISO date
      let filedAt: string | null = null;
      if (entry.updated) {
        const d = new Date(String(entry.updated));
        if (!isNaN(d.getTime())) filedAt = d.toISOString();
      }
      if (filedAt && new Date(filedAt) < cutoff) return null;

      // <summary> → strip HTML
      const summaryRaw = entry.summary;
      const summaryText = (typeof summaryRaw === 'object' ? summaryRaw['#text'] : String(summaryRaw ?? ''));
      const summary = summaryText
        .replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) || null;

      return { title, url, formType, filedAt, summary };
    })
    .filter((f): f is EdgarFiling => f !== null);
}

// ─── Federal Register ingestion ───────────────────────────────────────────────

async function runFedRegisterIngestion(env: Env): Promise<IngestResult> {
  const { results: accountRows } = await env.DB.prepare(
    `SELECT id, name, company_id, fed_register_agency FROM accounts WHERE fed_register_agency IS NOT NULL`
  ).all<{ id: number; name: string; company_id: number; fed_register_agency: string }>();

  console.log(`[fedreg] Processing ${accountRows.length} regulator accounts`);

  const failures: Array<{ account: string; error: string }> = [];
  let succeeded = 0, newRules = 0;

  for (const account of accountRows) {
    try {
      const articles = await fetchFedRegisterRules(account.fed_register_agency);
      console.log(`[fedreg] ${account.name}: ${articles.length} rules/proposals`);
      const inserted = await writeRegulatorySignals(
        env, account,
        articles.map(a => ({
          title: a.title,
          url: a.url,
          publishedAt: a.publicationDate ? new Date(a.publicationDate).toISOString() : null,
          structuredData: {
            rule_type: a.ruleType,
            document_number: a.documentNumber,
            description: a.abstract,
            signal_tags: [],
          },
        })),
      );
      newRules += inserted;
      succeeded++;
      console.log(`[fedreg] ${account.name}: ${inserted} new`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ account: account.name, error: msg });
      console.error(`[fedreg] ${account.name} FAILED: ${msg}`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const summary = `${succeeded}/${accountRows.length} accounts (${newRules} new rules, ${failures.length} failed)`;
  console.log(`[fedreg] SUMMARY: ${summary}`);
  return { total: accountRows.length, succeeded, failed: failures.length, newPostings: newRules, failures, summary };
}

async function fetchFedRegisterRules(agencySlug: string): Promise<FedRegArticle[]> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const dateStr = cutoff.toISOString().split('T')[0];

  // Build URL manually — URLSearchParams doesn't handle repeated keys the way the API needs
  const base = 'https://www.federalregister.gov/api/v1/articles.json';
  const qs = [
    `conditions[agencies][]=${encodeURIComponent(agencySlug)}`,
    `conditions[type][]=Rule`,
    `conditions[type][]=Proposed+Rule`,
    `conditions[publication_date][gte]=${dateStr}`,
    `per_page=20`,
    `order=newest`,
    `fields[]=document_number`,
    `fields[]=title`,
    `fields[]=abstract`,
    `fields[]=html_url`,
    `fields[]=publication_date`,
    `fields[]=type`,
  ].join('&');

  const res = await fetch(`${base}?${qs}`, {
    headers: { 'User-Agent': 'gtm-market-intel/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from Federal Register API`);

  const data = await res.json() as any;
  return (data.results ?? [])
    .map((r: any): FedRegArticle => ({
      title: String(r.title ?? '').trim(),
      url: String(r.html_url ?? '').trim(),
      documentNumber: String(r.document_number ?? ''),
      abstract: r.abstract ? String(r.abstract).slice(0, 600) : null,
      publicationDate: r.publication_date ?? null,
      ruleType: String(r.type ?? 'Rule'),
    }))
    .filter((a: FedRegArticle) => a.title && a.url);
}

// Shared writer for EDGAR + Federal Register signals
async function writeRegulatorySignals(
  env: Env,
  account: { id: number; company_id: number },
  items: Array<{
    title: string;
    url: string;
    publishedAt: string | null;
    structuredData: Record<string, unknown>;
  }>,
): Promise<number> {
  if (items.length === 0) return 0;

  const stmts = await Promise.all(
    items.map(async item => {
      const hash = await sha256(`${account.id}:${item.url}`);
      return env.DB.prepare(`
        INSERT OR IGNORE INTO signals
          (company_id, signal_type, account_id, url, title, raw_content, structured_data, published_at, url_hash, processed)
        VALUES (?, 'regulatory', ?, ?, ?, '{}', ?, ?, ?, 0)
      `).bind(
        account.company_id,
        account.id,
        item.url,
        item.title,
        JSON.stringify(item.structuredData),
        item.publishedAt,
        hash,
      );
    }),
  );

  let inserted = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const results = await env.DB.batch(stmts.slice(i, i + BATCH_SIZE));
    for (const r of results) {
      if (r.meta.changes > 0) inserted++;
    }
  }
  return inserted;
}

// ─── OpenRouter client ────────────────────────────────────────────────────────

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  jsonMode = true,
  maxTokens = 200,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gtm-market-intel.workers.dev',
      'X-Title': 'GTM Market Intelligence',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  return data.choices[0].message.content as string;
}

// ─── Signal enrichment ────────────────────────────────────────────────────────

const ENRICH_CONCURRENCY = 10;

const VALID_CATEGORIES = new Set([
  // job posting
  'ai_ml_hiring', 'eng_expansion', 'sales_expansion', 'leadership_hire',
  'geographic_expansion', 'infrastructure',
  // news article
  'regulatory_change', 'competitor_funding', 'leadership_change',
  'product_launch', 'market_news',
  // shared
  'other',
]);

const VALID_IMPORTANCE = new Set(['low', 'medium', 'high']);

async function runSignalEnrichment(env: Env, limit: number): Promise<EnrichResult> {
  const { results } = await env.DB.prepare(`
    SELECT s.id, s.signal_type, s.title, s.structured_data,
           a.name AS account_name, a.type AS account_type
    FROM signals s
    LEFT JOIN accounts a ON a.id = s.account_id
    WHERE s.processed = 0
    LIMIT ?
  `).bind(limit).all<RawSignalRow>();

  if (results.length === 0) {
    console.log('[enrichment] No unenriched signals');
    return { total: 0, enriched: 0, failed: 0, skipped: 0, summary: 'No unenriched signals' };
  }

  console.log(`[enrichment] Processing ${results.length} signals (concurrency=${ENRICH_CONCURRENCY})`);

  let enriched = 0, failed = 0, skipped = 0;

  for (let i = 0; i < results.length; i += ENRICH_CONCURRENCY) {
    const batch = results.slice(i, i + ENRICH_CONCURRENCY);
    await Promise.all(batch.map(async signal => {
      try {
        const fields = await enrichOneSignal(env, signal);
        if (fields === null) { skipped++; return; }
        await writeEnrichedFields(env, signal.id, signal.structured_data, fields);
        enriched++;
        console.log(`[enrichment] #${signal.id} ${signal.account_name}: [${fields.importance}] ${fields.one_line_summary}`);
      } catch (err) {
        failed++;
        console.error(`[enrichment] #${signal.id} FAILED:`, err instanceof Error ? err.message : err);
      }
    }));
  }

  const summary = `${enriched}/${results.length} enriched (${failed} failed, ${skipped} skipped)`;
  console.log(`[enrichment] SUMMARY: ${summary}`);
  return { total: results.length, enriched, failed, skipped, summary };
}

async function enrichOneSignal(env: Env, signal: RawSignalRow): Promise<EnrichedFields | null> {
  if (signal.signal_type === 'job_posting') return enrichJobPosting(env, signal);
  if (signal.signal_type === 'news')        return enrichNewsArticle(env, signal);
  if (signal.signal_type === 'regulatory')  return enrichRegulatorySignal(env, signal);
  // All other types: mark processed, skip enrichment
  await env.DB.prepare('UPDATE signals SET processed = 1 WHERE id = ?').bind(signal.id).run();
  return null;
}

async function enrichJobPosting(env: Env, signal: RawSignalRow): Promise<EnrichedFields | null> {
  const structured = parseJson<any>(signal.structured_data) ?? {};

  const prompt = `You are a competitive intelligence analyst for Nubank's US market expansion team.

Analyze this job posting and classify it.

Company: ${signal.account_name ?? 'Unknown'} (${signal.account_type ?? 'unknown'})
Job Title: ${structured.job_title ?? signal.title ?? 'Unknown'}
Department: ${structured.department ?? 'Unknown'}
Location: ${structured.location ?? 'Unknown'}

Respond with a JSON object only — no explanation, no markdown:
{
  "signal_category": one of ["ai_ml_hiring","eng_expansion","sales_expansion","leadership_hire","geographic_expansion","infrastructure","other"],
  "importance": one of ["low","medium","high"],
  "one_line_summary": "under 15 words: why this role matters for Nubank US entry strategy",
  "region": "US state name" or "Remote" or null
}

Importance guide: high = C-suite/VP hire or clear new market signal; medium = director/senior in strategic function; low = IC role or backfill.`;

  const raw = await callOpenRouter(env.OPENROUTER_API_KEY, EXTRACTION_MODEL, [
    { role: 'user', content: prompt },
  ]);

  return parseEnrichedFields(raw, signal.id);
}

async function enrichNewsArticle(env: Env, signal: RawSignalRow): Promise<EnrichedFields | null> {
  const structured = parseJson<any>(signal.structured_data) ?? {};

  const prompt = `You are a competitive intelligence analyst for Nubank's US market expansion team.

Analyze this news article and classify it.

Company covered: ${signal.account_name ?? 'Unknown'} (${signal.account_type ?? 'unknown'})
Headline: ${structured.title ?? signal.title ?? 'Unknown'}
Publication: ${structured.publication ?? 'Unknown'}
Description: ${structured.description ?? 'No description available'}

Respond with a JSON object only — no explanation, no markdown:
{
  "signal_category": one of ["regulatory_change","competitor_funding","leadership_change","product_launch","market_news","other"],
  "importance": one of ["low","medium","high"],
  "one_line_summary": "under 15 words: why this matters for Nubank US entry strategy",
  "region": "US state name" or null
}

Category guide:
- regulatory_change: new rules, enforcement actions, charter decisions, CFPB/OCC/state regulator moves
- competitor_funding: funding rounds, valuations, IPO filings, M&A
- leadership_change: C-suite hires or departures, board changes
- product_launch: new products, features, market entries
- market_news: earnings, user growth, market share, strategic partnerships

Importance guide: high = directly affects Nubank's US entry strategy or a major competitor move; medium = notable competitive development; low = general market noise.`;

  const raw = await callOpenRouter(env.OPENROUTER_API_KEY, EXTRACTION_MODEL, [
    { role: 'user', content: prompt },
  ]);

  return parseEnrichedFields(raw, signal.id);
}

function parseEnrichedFields(raw: string, signalId: number): EnrichedFields | null {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error(`[enrichment] #${signalId}: JSON parse failed — ${raw.slice(0, 120)}`);
    return null;
  }

  if (!VALID_CATEGORIES.has(data.signal_category)) {
    console.warn(`[enrichment] #${signalId}: unknown category "${data.signal_category}" → "other"`);
    data.signal_category = 'other';
  }
  if (!VALID_IMPORTANCE.has(data.importance)) {
    console.warn(`[enrichment] #${signalId}: unknown importance "${data.importance}" → "low"`);
    data.importance = 'low';
  }

  return {
    signal_category: data.signal_category,
    importance: data.importance as 'low' | 'medium' | 'high',
    one_line_summary: String(data.one_line_summary ?? '').slice(0, 120),
    region: data.region ? String(data.region) : null,
  };
}

async function writeEnrichedFields(
  env: Env,
  signalId: number,
  currentData: string | null,
  fields: EnrichedFields,
): Promise<void> {
  const base = parseJson<any>(currentData) ?? {};
  const updated = JSON.stringify({
    ...base,
    signal_tags:      [fields.signal_category],
    importance:       fields.importance,
    one_line_summary: fields.one_line_summary,
    region:           fields.region,
  });

  await env.DB.prepare(
    'UPDATE signals SET structured_data = ?, processed = 1 WHERE id = ?'
  ).bind(updated, signalId).run();
}

// ─── Signal composition ───────────────────────────────────────────────────────

async function composedSignalsHandler(params: URLSearchParams, env: Env): Promise<Response> {
  const companyId = params.get('company_id') ?? '1';
  const limit = Math.min(parseInt(params.get('limit') ?? '5', 10), 20);

  const [{ results }, { results: countRows }] = await Promise.all([
    env.DB.prepare(`
      SELECT id, company_id, created_at, signal_ids_referenced,
             composition_type, account_id, importance, one_line_summary, explanation
      FROM composed_signals
      WHERE company_id = ?
      ORDER BY
        CASE importance WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT ?
    `).bind(companyId, limit).all<any>(),

    env.DB.prepare(`
      SELECT composition_type, COUNT(*) AS count
      FROM composed_signals
      WHERE company_id = ?
      GROUP BY composition_type
    `).bind(companyId).all<{ composition_type: string; count: number }>(),
  ]);

  const pattern_counts: Record<string, number> = {};
  for (const row of countRows) {
    pattern_counts[row.composition_type] = row.count;
  }

  return json({
    composed_signals: results.map(r => ({
      ...r,
      signal_ids_referenced: parseJson<number[]>(r.signal_ids_referenced) ?? [],
    })),
    pattern_counts,
  });
}

async function runCompositionEndpoint(params: URLSearchParams, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY not configured' }, 500);
  const companyId = parseInt(params.get('company_id') ?? '1', 10);
  return json(await runComposition(env, companyId));
}

async function runComposition(env: Env, companyId: number): Promise<CompositionResult> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { results: rawSignals } = await env.DB.prepare(`
    SELECT s.id, s.signal_type, s.ingested_at,
           json_extract(s.structured_data, '$.signal_category') AS signal_category,
           json_extract(s.structured_data, '$.importance')      AS importance,
           json_extract(s.structured_data, '$.one_line_summary') AS one_line_summary,
           a.id   AS account_id,
           a.name AS account_name,
           a.type AS account_type
    FROM signals s
    JOIN accounts a ON a.id = s.account_id
    WHERE s.company_id = ? AND s.processed = 1 AND s.ingested_at >= ?
    ORDER BY s.ingested_at DESC
  `).bind(companyId, cutoff).all<EnrichedSignalForComposition>();

  const signals = rawSignals;
  console.log(`[composition] ${signals.length} enriched signals loaded`);

  const candidates: ComposedSignalCandidate[] = [
    ...detectHiringClusters(signals),
    ...detectCrossSourcePatterns(signals),
    ...detectRegulatoryOverlap(signals),
    ...detectCompetitiveEscalation(signals),
  ];

  console.log(`[composition] ${candidates.length} raw pattern candidates`);

  const patternCounts: Record<CompositionType, number> = {
    hiring_cluster: 0,
    cross_source_pattern: 0,
    regulatory_overlap: 0,
    competitive_escalation: 0,
  };

  let detected = 0, skipped = 0, failed = 0;

  for (const candidate of candidates) {
    try {
      const sortedIds = [...candidate.signalIds].sort((a, b) => a - b);
      const dedupKey = await sha256(`${candidate.compositionType}:${candidate.accountId ?? 'null'}:${sortedIds.join(',')}`);

      const existing = await env.DB.prepare(
        'SELECT id FROM composed_signals WHERE dedup_key = ?'
      ).bind(dedupKey).first();

      if (existing) { skipped++; continue; }

      const { one_line_summary, explanation } = await generateComposedSummary(
        env, candidate.compositionType, candidate.accountName, candidate.signals,
      );

      await env.DB.prepare(`
        INSERT OR IGNORE INTO composed_signals
          (company_id, signal_ids_referenced, composition_type, account_id,
           importance, one_line_summary, explanation, dedup_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        companyId,
        JSON.stringify(sortedIds),
        candidate.compositionType,
        candidate.accountId,
        candidate.importance,
        one_line_summary,
        explanation,
        dedupKey,
      ).run();

      detected++;
      patternCounts[candidate.compositionType]++;
      console.log(`[composition] [${candidate.compositionType}] ${one_line_summary}`);
    } catch (err) {
      failed++;
      console.error('[composition] Failed:', err instanceof Error ? err.message : err);
    }
  }

  const summary = `${detected} new | ${skipped} already existed | ${failed} failed | patterns: ${JSON.stringify(patternCounts)}`;
  console.log('[composition] DONE:', summary);
  return { detected, skipped, failed, patterns: patternCounts, summary };
}

// ─── Pattern A: Hiring cluster ────────────────────────────────────────────────

function detectHiringClusters(signals: EnrichedSignalForComposition[]): ComposedSignalCandidate[] {
  const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
  const jobSignals = signals.filter(s => s.signal_type === 'job_posting' && s.signal_category);

  // Group by (account_id, signal_category)
  const groups = new Map<string, EnrichedSignalForComposition[]>();
  for (const sig of jobSignals) {
    const key = `${sig.account_id}:${sig.signal_category}`;
    const arr = groups.get(key) ?? [];
    arr.push(sig);
    groups.set(key, arr);
  }

  const candidates: ComposedSignalCandidate[] = [];

  for (const [, group] of groups) {
    if (group.length < 3) continue;

    const sorted = [...group].sort((a, b) => a.ingested_at.localeCompare(b.ingested_at));
    let bestWindow: EnrichedSignalForComposition[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const startMs = new Date(sorted[i].ingested_at).getTime();
      const window = sorted.filter(s => {
        const ms = new Date(s.ingested_at).getTime();
        return ms >= startMs && ms <= startMs + WINDOW_MS;
      });
      if (window.length >= 3 && window.length > bestWindow.length) bestWindow = window;
    }

    if (bestWindow.length >= 3) {
      const first = bestWindow[0];
      const highCount = bestWindow.filter(s => s.importance === 'high').length;
      candidates.push({
        compositionType: 'hiring_cluster',
        accountId: first.account_id,
        accountName: first.account_name,
        signalIds: bestWindow.map(s => s.id),
        signals: bestWindow.map(s => ({
          signal_type: s.signal_type,
          one_line_summary: s.one_line_summary ?? s.signal_category ?? 'job posting',
          importance: s.importance ?? 'low',
        })),
        importance: highCount >= 2 ? 'high' : 'medium',
      });
    }
  }

  return candidates;
}

// ─── Pattern B: Cross-source pattern ─────────────────────────────────────────

function detectCrossSourcePatterns(signals: EnrichedSignalForComposition[]): ComposedSignalCandidate[] {
  const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const candidates: ComposedSignalCandidate[] = [];

  // Group by account_id — only job_posting and news
  const byAccount = new Map<number, EnrichedSignalForComposition[]>();
  for (const sig of signals) {
    if (sig.signal_type !== 'job_posting' && sig.signal_type !== 'news') continue;
    const arr = byAccount.get(sig.account_id) ?? [];
    arr.push(sig);
    byAccount.set(sig.account_id, arr);
  }

  for (const [accountId, accountSignals] of byAccount) {
    const jobs = accountSignals.filter(s => s.signal_type === 'job_posting');
    const news = accountSignals.filter(
      s => s.signal_type === 'news' && (s.importance === 'medium' || s.importance === 'high'),
    );
    if (jobs.length === 0 || news.length === 0) continue;

    // Find best (news, job) pair within 7-day window
    let bestPair: { job: EnrichedSignalForComposition; news: EnrichedSignalForComposition } | null = null;

    for (const n of news) {
      const nMs = new Date(n.ingested_at).getTime();
      for (const j of jobs) {
        if (Math.abs(nMs - new Date(j.ingested_at).getTime()) <= WINDOW_MS) {
          if (!bestPair || n.importance === 'high') bestPair = { job: j, news: n };
          if (n.importance === 'high') break;
        }
      }
      if (bestPair?.news.importance === 'high') break;
    }

    if (bestPair) {
      const { job, news: n } = bestPair;
      candidates.push({
        compositionType: 'cross_source_pattern',
        accountId,
        accountName: job.account_name,
        signalIds: [job.id, n.id],
        signals: [
          { signal_type: 'job_posting', one_line_summary: job.one_line_summary ?? 'hiring signal',    importance: job.importance ?? 'low' },
          { signal_type: 'news',        one_line_summary: n.one_line_summary   ?? 'news coverage',    importance: n.importance   ?? 'medium' },
        ],
        importance: n.importance === 'high' ? 'high' : 'medium',
      });
    }
  }

  return candidates;
}

// ─── Pattern C: Regulatory overlap ───────────────────────────────────────────

function detectRegulatoryOverlap(signals: EnrichedSignalForComposition[]): ComposedSignalCandidate[] {
  const highRegSignals = signals.filter(
    s => s.account_type === 'regulator' && s.importance === 'high',
  );

  const byRegulator = new Map<number, EnrichedSignalForComposition>();
  for (const sig of highRegSignals) {
    const existing = byRegulator.get(sig.account_id);
    // Keep the most recent per regulator
    if (!existing || sig.ingested_at > existing.ingested_at) {
      byRegulator.set(sig.account_id, sig);
    }
  }

  if (byRegulator.size < 2) return [];

  // Take top 4 most recent
  const top = [...byRegulator.values()]
    .sort((a, b) => b.ingested_at.localeCompare(a.ingested_at))
    .slice(0, 4);

  return [{
    compositionType: 'regulatory_overlap',
    accountId: null,
    accountName: null,
    signalIds: top.map(s => s.id),
    signals: top.map(s => ({
      signal_type: s.signal_type,
      one_line_summary: s.one_line_summary ?? 'regulatory signal',
      importance: 'high',
    })),
    importance: 'high',
  }];
}

// ─── Pattern D: Competitive escalation ───────────────────────────────────────

function detectCompetitiveEscalation(signals: EnrichedSignalForComposition[]): ComposedSignalCandidate[] {
  const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
  const candidates: ComposedSignalCandidate[] = [];

  const competitorHigh = signals.filter(
    s => s.account_type === 'competitor' && s.importance === 'high',
  );

  const byAccount = new Map<number, EnrichedSignalForComposition[]>();
  for (const sig of competitorHigh) {
    const arr = byAccount.get(sig.account_id) ?? [];
    arr.push(sig);
    byAccount.set(sig.account_id, arr);
  }

  for (const [, accountSignals] of byAccount) {
    if (accountSignals.length < 2) continue;

    const sorted = [...accountSignals].sort((a, b) => a.ingested_at.localeCompare(b.ingested_at));
    let bestWindow: EnrichedSignalForComposition[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const startMs = new Date(sorted[i].ingested_at).getTime();
      const window = sorted.filter(s => {
        const ms = new Date(s.ingested_at).getTime();
        return ms >= startMs && ms <= startMs + WINDOW_MS;
      });
      if (window.length >= 2 && window.length > bestWindow.length) bestWindow = window;
    }

    if (bestWindow.length >= 2) {
      candidates.push({
        compositionType: 'competitive_escalation',
        accountId: bestWindow[0].account_id,
        accountName: bestWindow[0].account_name,
        signalIds: bestWindow.map(s => s.id),
        signals: bestWindow.map(s => ({
          signal_type: s.signal_type,
          one_line_summary: s.one_line_summary ?? 'high-importance signal',
          importance: 'high',
        })),
        importance: 'high',
      });
    }
  }

  return candidates;
}

// ─── Composed signal summary generator ───────────────────────────────────────

const PATTERN_DESCRIPTIONS: Record<CompositionType, string> = {
  hiring_cluster:         '3+ job postings in the same category from the same company within 14 days — signals a deliberate capability build',
  cross_source_pattern:   'A company has both job postings AND news coverage within 7 days — hiring and PR activity together signal coordinated expansion',
  regulatory_overlap:     'Multiple regulators each issued a high-importance signal within 30 days — suggests a coordinated regulatory environment shift',
  competitive_escalation: 'A competitor produced 2+ high-importance signals within 14 days — accelerating competitive momentum',
};

async function generateComposedSummary(
  env: Env,
  compositionType: CompositionType,
  accountName: string | null,
  signals: SignalSummaryInput[],
): Promise<{ one_line_summary: string; explanation: string }> {
  const signalList = signals
    .map(s => `- [${s.signal_type} | ${s.importance}] ${s.one_line_summary}`)
    .join('\n');

  const prompt = `You are a competitive intelligence analyst for Nubank's US market expansion team.

Pattern detected: ${PATTERN_DESCRIPTIONS[compositionType]}
${accountName ? `Account: ${accountName}` : 'Spans multiple regulator accounts'}

Source signals that triggered this pattern:
${signalList}

Generate a tight, specific analysis. Respond with a JSON object ONLY — no markdown:
{
  "one_line_summary": "under 20 words: what this pattern reveals, naming the specific company/regulator and the implication",
  "explanation": "2-3 sentences, under 60 words total: what this pattern means and why it matters specifically for Nubank's US entry strategy"
}`;

  const raw = await callOpenRouter(
    env.OPENROUTER_API_KEY,
    REASONING_MODEL,
    [{ role: 'user', content: prompt }],
    true,
    300,
  );

  const data = JSON.parse(raw);
  return {
    one_line_summary: String(data.one_line_summary ?? '').slice(0, 150),
    explanation:      String(data.explanation      ?? '').slice(0, 500),
  };
}

// ─── Eval handlers ────────────────────────────────────────────────────────────

const EVAL_SCENARIO = `It's June 4, 2026. I'm the country GM for Nubank's US expansion. Give me a market intelligence brief for this week — what changed, what it means, and what I should prioritize. Reference specific signals from competitors, regulators, and partners where relevant. Output in markdown with these sections: 'Where we are', 'What changed this week', 'What this means', 'Open questions'. Keep under 400 words.`;

async function evalVanillaHandler(env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY not configured' }, 500);

  const t0 = Date.now();
  const markdown = await callOpenRouter(
    env.OPENROUTER_API_KEY,
    REASONING_MODEL,
    [
      { role: 'system', content: 'You are a helpful business analyst.' },
      { role: 'user', content: EVAL_SCENARIO },
    ],
    false,
    700,
  );

  return json({ markdown, latency_ms: Date.now() - t0, model: REASONING_MODEL, mode: 'vanilla' });
}

async function evalGroundedHandler(env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY not configured' }, 500);

  const t0 = Date.now();
  const result = await generateBrief(env, 1, true);

  return json({
    markdown: result.markdown_content,
    signal_count: result.signal_count,
    latency_ms: Date.now() - t0,
    model: REASONING_MODEL,
    mode: 'grounded',
  });
}

async function evalVerifyHandler(request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY not configured' }, 500);

  let body: { vanilla_markdown?: string };
  try { body = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  if (!body.vanilla_markdown) return json({ error: 'missing vanilla_markdown' }, 400);

  // 1. Extract specific factual claims from the vanilla output
  const extractPrompt = `Extract specific factual claims from this market intelligence brief.
A claim must contain: a named company or entity + a specific action, number, or date.
Skip vague statements ("market is growing", "competition is intensifying").

Return ONLY a JSON object in this exact shape:
{"claims": [{"claim": "full claim sentence", "entity": "PrimaryCompanyName", "keywords": ["keyword1", "keyword2", "keyword3"]}]}

Limit to 10 most specific, verifiable claims.

Brief:
${body.vanilla_markdown.slice(0, 3000)}`;

  const raw = await callOpenRouter(
    env.OPENROUTER_API_KEY,
    EXTRACTION_MODEL,
    [{ role: 'user', content: extractPrompt }],
    true,
    600,
  );

  let claims: Array<{ claim: string; entity: string; keywords: string[] }>;
  try {
    const parsed = JSON.parse(raw);
    // Model may return {claims:[...]} or a bare array; handle both
    claims = Array.isArray(parsed) ? parsed : Array.isArray(parsed.claims) ? parsed.claims : [];
    if (claims.length === 0) console.warn('[eval/verify] claim extraction returned 0 claims, raw:', raw.slice(0, 300));
  } catch {
    console.error('[eval/verify] claim extraction parse failed:', raw.slice(0, 300));
    return json({ error: 'claim extraction failed', raw: raw.slice(0, 200) }, 500);
  }

  // 2. Fetch all enriched signals to match against (single query, then match in memory)
  const { results: signalRows } = await env.DB.prepare(`
    SELECT a.name AS account_name,
           json_extract(s.structured_data, '$.one_line_summary') AS summary
    FROM signals s
    LEFT JOIN accounts a ON a.id = s.account_id
    WHERE s.company_id = 1 AND s.processed = 1
    ORDER BY s.ingested_at DESC
    LIMIT 300
  `).all<{ account_name: string | null; summary: string | null }>();

  // 3. Keyword-match each claim against real signals
  const verified = claims.map(c => {
    const needles = [c.entity, ...(c.keywords ?? [])]
      .map(k => k.toLowerCase().trim())
      .filter(k => k.length > 3);

    const match = signalRows.find(s => {
      const haystack = `${s.account_name ?? ''} ${s.summary ?? ''}`.toLowerCase();
      return needles.some(k => haystack.includes(k));
    });

    return {
      claim: c.claim,
      entity: c.entity,
      grounded: !!match,
      matching_signal: match
        ? { account_name: match.account_name ?? 'Unknown', summary: match.summary ?? '' }
        : null,
    };
  });

  const groundedCount = verified.filter(v => v.grounded).length;
  console.log(`[eval/verify] ${groundedCount}/${verified.length} claims grounded`);

  return json({ claims: verified, grounded_count: groundedCount, total: verified.length });
}
