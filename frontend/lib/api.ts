const BASE = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

async function get(path: string): Promise<any> {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(`API ${r.status}: ${path}`)
  return r.json()
}

async function post(path: string, body?: unknown): Promise<any> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  if (!r.ok) throw new Error(`API ${r.status}: ${path}`)
  return r.json()
}

export const fetchBrief = (companyId: string) =>
  get(`/api/brief?company_id=${companyId}`)

export const regenerateBrief = (companyId: string) =>
  post(`/api/brief/regenerate?company_id=${companyId}`)

export const fetchAccounts = (companyId: string, region: string | null) =>
  get(`/api/accounts?company_id=${companyId}${region ? `&region=${encodeURIComponent(region)}` : ''}`)

export const fetchStakeholders = (companyId: string) =>
  get(`/api/stakeholders?company_id=${companyId}`)

export const fetchSignals = (companyId: string, region: string | null, limit = 20) =>
  get(`/api/signals?company_id=${companyId}&limit=${limit}${region ? `&region=${encodeURIComponent(region)}` : ''}`)

export const fetchLatestPlan = (companyId: string, horizonDays: number) =>
  get(`/api/plans/latest?company_id=${companyId}&horizon_days=${horizonDays}`)

export const triggerGeneratePlan = (companyId: string, horizonDays: number) =>
  post(`/api/plans/generate?company_id=${companyId}&horizon_days=${horizonDays}`)

export const fetchComposedSignals = (companyId: string, limit = 5) =>
  get(`/api/composed-signals?company_id=${companyId}&limit=${limit}`)

export const runComposition = (companyId: string) =>
  post(`/api/admin/run-composition?company_id=${companyId}`)

export const runEvalVanilla  = () => get('/api/eval/vanilla')
export const runEvalGrounded = () => get('/api/eval/grounded')

export const runEvalVerify = (vanillaMarkdown: string) =>
  post('/api/eval/verify', { vanilla_markdown: vanillaMarkdown })

export const fetchHypothesis = (companyId: string, question: string) =>
  post('/api/brief/hypothesis', { company_id: companyId, question })
