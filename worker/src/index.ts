export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: cors });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const { pathname, searchParams } = new URL(request.url);

    try {
      if (pathname === '/api/health')       return json({ status: 'ok', timestamp: new Date().toISOString() });
      if (pathname === '/api/brief')        return brief(searchParams, env);
      if (pathname === '/api/accounts')     return accounts(searchParams, env);
      if (pathname === '/api/stakeholders') return stakeholders(searchParams, env);
      if (pathname === '/api/signals')      return signals(searchParams, env);
    } catch (e) {
      console.error(e);
      return json({ error: 'Internal error' }, 500);
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Entry point for hourly cron-triggered ingestion jobs
    console.log('Ingestion job triggered:', new Date(event.scheduledTime).toISOString());
  },
};

async function brief(params: URLSearchParams, env: Env): Promise<Response> {
  const companyId = params.get('company_id') ?? '1';
  const company = await env.DB.prepare('SELECT name FROM companies WHERE id = ?')
    .bind(companyId).first<{ name: string }>();

  if (!company) return json({ error: 'Company not found' }, 404);

  return json({
    company_id: companyId,
    title: `${company.name} · US Market Entry Brief`,
    last_updated: new Date().toISOString(),
    content: [
      {
        heading: 'Market Context',
        body: 'The US neobanking market has seen consolidation among top players. Chime maintains the largest account base at ~22M users, while SoFi leverages its bank charter for higher-margin lending. CFPB rulemaking on open banking (Section 1033) creates both compliance cost and product opportunity for new entrants.',
      },
      {
        heading: 'Competitive Positioning',
        body: 'No current US neobank owns the Latino immigrant segment with native-language, culturally-resonant digital banking at scale. Remitly addresses remittance but not a full banking relationship. This is the primary whitespace for Nubank US.',
      },
      {
        heading: 'Priority Watch Items',
        body: "Monitor CFPB Section 1033 final rule timeline. Track Chime and Dave hiring signals for product-direction clues. Varo's national bank charter experience is the closest direct reference case for OCC application sequencing.",
      },
    ],
  });
}

async function accounts(params: URLSearchParams, env: Env): Promise<Response> {
  const companyId = params.get('company_id') ?? '1';
  const region = params.get('region');

  // region filter passed through for future use once accounts gain a region column
  const { results } = await env.DB.prepare(
    `SELECT id, name, type, tier, status, hq_country, website, description, metadata
     FROM accounts WHERE company_id = ? ORDER BY tier, type, name`
  ).bind(companyId).all();

  return json({ accounts: results, region: region ?? null });
}

async function stakeholders(params: URLSearchParams, env: Env): Promise<Response> {
  const companyId = params.get('company_id') ?? '1';

  const { results } = await env.DB.prepare(
    `SELECT id, name, role, type, public_positions, account_id
     FROM stakeholders WHERE company_id = ? ORDER BY type, name`
  ).bind(companyId).all();

  // Group by type in the worker so the frontend can render sections directly
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
    `SELECT id, signal_type, url, title, published_at, ingested_at, account_id, stakeholder_id
     FROM signals WHERE company_id = ? ORDER BY ingested_at DESC LIMIT ?`
  ).bind(companyId, limit).all();

  return json({ signals: results, region: region ?? null });
}
