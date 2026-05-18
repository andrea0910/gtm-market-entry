'use client'

import { useEffect, useState } from 'react'
import { fetchAccounts } from '@/lib/api'

interface Account {
  id: number
  name: string
  type: 'competitor' | 'partner' | 'prospect' | 'regulator'
  tier: number
  status: string
  hq_country: string | null
}

const TYPE_STYLE: Record<string, string> = {
  competitor: 'bg-red-50 text-red-700 border-red-100',
  regulator:  'bg-amber-50 text-amber-700 border-amber-100',
  partner:    'bg-emerald-50 text-emerald-700 border-emerald-100',
  prospect:   'bg-blue-50 text-blue-700 border-blue-100',
}

interface Props {
  companyId: string
  region: string | null
}

export default function AccountBoard({ companyId, region }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchAccounts(companyId, region)
      .then((d: any) => setAccounts(d.accounts))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [companyId, region])

  return (
    <div className="rounded-lg border border-gray-200 bg-white flex-none">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          Account Board
        </h2>
        <span className="text-[10px] text-gray-400">
          {loading ? '—' : `${accounts.length} accounts`}
          {region && <span className="ml-1 text-indigo-500">· {region}</span>}
        </span>
      </div>

      <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-7 bg-gray-100 rounded" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <p className="px-4 py-4 text-xs text-gray-400">No accounts.</p>
        ) : (
          accounts.map(a => (
            <div key={a.id} className="px-4 py-2 flex items-center gap-2.5 hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-900 truncate">{a.name}</span>
                  {a.hq_country && (
                    <span className="text-[10px] text-gray-400 flex-none">{a.hq_country}</span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Tier {a.tier} · No signals yet
                </p>
              </div>
              <span className={`flex-none text-[10px] font-medium px-1.5 py-0.5 rounded border ${TYPE_STYLE[a.type] ?? 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                {a.type}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
