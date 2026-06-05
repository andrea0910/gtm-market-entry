'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchAccounts } from '@/lib/api'

interface TopSignal {
  one_line_summary: string
  importance: string
  signal_type: string
  url: string | null
}

interface Account {
  id: number
  name: string
  type: 'competitor' | 'partner' | 'prospect' | 'regulator'
  tier: number
  status: string
  hq_country: string | null
  signal_count: number
  enriched_count: number
  heat_score: number
  signal_count_30d: number
  top_signal: TopSignal | null
}

const TYPE_COLOR: Record<string, string> = {
  competitor: 'text-rose-600 bg-rose-50 border-rose-200',
  regulator:  'text-amber-600 bg-amber-50 border-amber-200',
  partner:    'text-emerald-600 bg-emerald-50 border-emerald-200',
  prospect:   'text-blue-600 bg-blue-50 border-blue-200',
}

const HEAT_COLOR = (score: number, max: number) => {
  const pct = score / max
  if (pct > 0.7) return 'text-rose-600'
  if (pct > 0.4) return 'text-amber-600'
  return 'text-slate-500'
}

type SortKey = 'heat' | 'tier' | 'name'

export default function AccountBoard({ companyId, region }: { companyId: string; region: string | null }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('heat')

  useEffect(() => {
    setLoading(true)
    fetchAccounts(companyId, region)
      .then((d: any) => setAccounts(d.accounts))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [companyId, region])

  const sorted = useMemo(() => {
    const arr = [...accounts]
    if (sort === 'heat') return arr.sort((a, b) => b.heat_score - a.heat_score)
    if (sort === 'tier') return arr.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
    return arr.sort((a, b) => a.name.localeCompare(b.name))
  }, [accounts, sort])

  const maxHeat = useMemo(() => Math.max(...accounts.map(a => a.heat_score), 1), [accounts])

  return (
    <div>
      {/* Header */}
      <div className="px-8 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-0.5">Account Board</p>
          <p className="text-lg font-black text-slate-900">
            Intelligence Leaderboard
            {region && <span className="text-indigo-500 ml-2">· {region}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400 font-semibold">Sort:</span>
          {(['heat', 'tier', 'name'] as SortKey[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors capitalize ${
                sort === s
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard rows */}
      {loading ? (
        <div className="px-8 pb-6 space-y-3 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="px-8 pb-6">
          <p className="text-base text-gray-400">No accounts found.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 pb-6">
          {sorted.map((a, idx) => {
            const heatPct = (a.heat_score / maxHeat) * 100
            return (
              <div key={a.id} className="px-8 py-4 hover:bg-slate-50 transition-colors flex items-center gap-5">
                {/* Rank */}
                <span className="text-xl font-black text-slate-200 flex-none w-8 text-right">
                  {idx + 1}
                </span>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <p className="text-base font-black text-slate-900 truncate">{a.name}</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex-none ${TYPE_COLOR[a.type] ?? 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                      {a.type}
                    </span>
                    {a.hq_country && (
                      <span className="text-xs text-slate-400 font-medium flex-none">{a.hq_country}</span>
                    )}
                  </div>
                  {/* Top signal */}
                  {a.top_signal ? (
                    a.top_signal.url ? (
                      <a
                        href={a.top_signal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-500 hover:text-indigo-600 transition-colors line-clamp-2 block"
                        title={a.top_signal.one_line_summary}
                      >
                        "{a.top_signal.one_line_summary}" ↗
                      </a>
                    ) : (
                      <p className="text-xs text-slate-500 line-clamp-2" title={a.top_signal.one_line_summary}>
                        "{a.top_signal.one_line_summary}"
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-slate-400">
                      No signals yet{' '}
                      <span className="text-slate-300">— no triggering inputs or observable activity detected</span>
                    </p>
                  )}
                </div>

                {/* Heat bar + score */}
                <div className="flex-none w-40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Heat</span>
                    <span className={`text-lg font-black tabular-nums ${HEAT_COLOR(a.heat_score, maxHeat)}`}>
                      {a.heat_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.max(heatPct, 2)}%`,
                        background: heatPct > 70 ? '#e11d48' : heatPct > 40 ? '#d97706' : '#818cf8',
                      }}
                    />
                  </div>
                  {a.signal_count_30d > 0 && (
                    <p className="text-[11px] text-slate-400 font-medium mt-1">
                      {a.signal_count_30d} signals (30d)
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
