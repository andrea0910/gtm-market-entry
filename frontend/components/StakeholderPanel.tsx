'use client'

import { useEffect, useState } from 'react'
import { fetchStakeholders } from '@/lib/api'

interface Stakeholder {
  id: number
  name: string
  role: string | null
  type: string
}

const GROUP_LABEL: Record<string, string> = {
  buyer:     'Buyers',
  regulator: 'Regulators',
  partner:   'Partners',
  press:     'Press',
  analyst:   'Analysts',
  exec:      'Executives',
}

export default function StakeholderPanel({ companyId }: { companyId: string }) {
  const [groups, setGroups] = useState<Record<string, Stakeholder[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStakeholders(companyId)
      .then((d: any) => setGroups(d.stakeholders))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [companyId])

  const empty = !loading && Object.keys(groups).length === 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white flex-none">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          Stakeholders
        </h2>
      </div>

      <div className="max-h-52 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-1/4" />
            <div className="h-6 bg-gray-100 rounded" />
            <div className="h-6 bg-gray-100 rounded" />
          </div>
        ) : empty ? (
          <div className="px-4 py-5 text-center">
            <p className="text-xs text-gray-400">No stakeholders yet.</p>
            <p className="text-[10px] text-gray-300 mt-1">
              Add stakeholders to track key individuals in this market.
            </p>
          </div>
        ) : (
          Object.entries(groups).map(([type, people]) => (
            <div key={type}>
              <div className="px-4 py-1 bg-gray-50 border-y border-gray-100 first:border-t-0">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  {GROUP_LABEL[type] ?? type}
                </span>
              </div>
              {people.map(p => (
                <div key={p.id} className="px-4 py-2 border-b border-gray-50 hover:bg-gray-50 last:border-0">
                  <p className="text-xs font-medium text-gray-900">{p.name}</p>
                  {p.role && <p className="text-[10px] text-gray-400">{p.role}</p>}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
