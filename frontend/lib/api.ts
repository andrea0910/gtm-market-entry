const BASE = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

async function get(path: string): Promise<any> {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(`API ${r.status}: ${path}`)
  return r.json()
}

export const fetchBrief = (companyId: string) =>
  get(`/api/brief?company_id=${companyId}`)

export const fetchAccounts = (companyId: string, region: string | null) =>
  get(`/api/accounts?company_id=${companyId}${region ? `&region=${encodeURIComponent(region)}` : ''}`)

export const fetchStakeholders = (companyId: string) =>
  get(`/api/stakeholders?company_id=${companyId}`)

export const fetchSignals = (companyId: string, region: string | null, limit = 20) =>
  get(`/api/signals?company_id=${companyId}&limit=${limit}${region ? `&region=${encodeURIComponent(region)}` : ''}`)
