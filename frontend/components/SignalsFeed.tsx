'use client'

import { useEffect, useState } from 'react'
import { fetchSignals } from '@/lib/api'

interface Signal {
  id: number
  signal_type: string
  url: string | null
  title: string | null
  published_at: string | null
  ingested_at: string
  account_id: number | null
}

const TYPE_LABEL: Record<string, string> = {
  news:        'News',
  job_posting: 'Job',
  regulatory:  'Regulatory',
  earnings:    'Earnings',
  blog:        'Blog',
  social:      'Social',
  manual:      'Manual',
}

const TYPE_STYLE: Record<string, string> = {
  news:        'bg-blue-50 text-blue-700',
  job_posting: 'bg-purple-50 text-purple-700',
  regulatory:  'bg-amber-50 text-amber-700',
  earnings:    'bg-emerald-50 text-emerald-700',
  blog:        'bg-gray-100 text-gray-600',
  social:      'bg-sky-50 text-sky-700',
  manual:      'bg-gray-100 text-gray-600',
}

interface Props {
  companyId: string
  region: string | null
}

export default function SignalsFeed({ companyId, region }: Props) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSignals(companyId, region)
      .then((d: any) => setSignals(d.signals))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [companyId, region])

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100 flex-none">
        <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          Signals Feed
        </h2>
        <span className="text-[10px] text-gray-400">Ingestion runs every 6 hours</span>
      </div>

      <div className="flex-1 flex gap-2.5 overflow-x-auto px-4 py-2.5 items-start">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="flex-none w-60 h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))
        ) : signals.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-gray-400">
              No signals ingested yet. Ingestion runs every 6 hours.
            </p>
          </div>
        ) : (
          signals.map(s => (
            <div
              key={s.id}
              className="flex-none w-60 rounded-lg border border-gray-200 bg-white p-3 space-y-1.5 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_STYLE[s.signal_type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {TYPE_LABEL[s.signal_type] ?? s.signal_type}
                </span>
                <span className="text-[10px] text-gray-400 ml-auto whitespace-nowrap">
                  {new Date(s.ingested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug">
                {s.title ?? 'Untitled signal'}
              </p>
              {s.url && (() => {
                try {
                  return (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-500 hover:underline truncate block"
                    >
                      {new URL(s.url).hostname}
                    </a>
                  )
                } catch {
                  return null
                }
              })()}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
