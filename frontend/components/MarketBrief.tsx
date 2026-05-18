'use client'

import { useEffect, useState } from 'react'
import { fetchBrief } from '@/lib/api'

interface Section {
  heading: string
  body: string
}
interface Brief {
  title: string
  last_updated: string
  content: Section[]
}

export default function MarketBrief({ companyId }: { companyId: string }) {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBrief(companyId)
      .then(setBrief)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [companyId])

  return (
    <div className="rounded-lg border border-gray-200 bg-white flex-none">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          Market Brief
        </h2>
        {brief && (
          <span className="text-[10px] text-gray-400">
            {new Date(brief.last_updated).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            })}
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3 max-h-60 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded" />
            <div className="h-3 bg-gray-100 rounded w-5/6" />
          </div>
        ) : brief ? (
          <>
            <p className="text-xs font-semibold text-gray-800 leading-snug">{brief.title}</p>
            {brief.content.map((s, i) => (
              <div key={i}>
                <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-0.5">
                  {s.heading}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </>
        ) : (
          <p className="text-xs text-gray-400">No brief available.</p>
        )}
      </div>
    </div>
  )
}
