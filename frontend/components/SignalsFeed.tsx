'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchSignals } from '@/lib/api'

interface StructuredData {
  importance?: 'low' | 'medium' | 'high'
  one_line_summary?: string
  region?: string | null
  publication?: string
  form_type?: string
  rule_type?: string
  signal_tags?: string[]
}

interface Signal {
  id: number
  signal_type: string
  url: string | null
  title: string | null
  published_at: string | null
  ingested_at: string
  account_id: number | null
  account_name: string | null
  structured_data: StructuredData | null
  processed: number
}

const TYPE_LABEL: Record<string, string> = {
  news:        'News',
  job_posting: 'Job',
  regulatory:  'Reg',
  earnings:    'Earnings',
  blog:        'Blog',
  social:      'Social',
  manual:      'Manual',
}

const TYPE_COLOR: Record<string, string> = {
  news:        'bg-blue-900 text-blue-300',
  job_posting: 'bg-violet-900 text-violet-300',
  regulatory:  'bg-amber-900 text-amber-300',
  earnings:    'bg-emerald-900 text-emerald-300',
  blog:        'bg-slate-800 text-slate-400',
  social:      'bg-sky-900 text-sky-300',
  manual:      'bg-slate-800 text-slate-400',
}

const IMPORTANCE_DOT: Record<string, string> = {
  high:   'bg-rose-400',
  medium: 'bg-amber-400',
  low:    'bg-slate-300',
}

interface Props {
  companyId: string
  region: string | null
}

// px/sec auto-scroll speed
const SCROLL_SPEED = 28

export default function SignalsFeed({ companyId, region }: Props) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    setLoading(true)
    fetchSignals(companyId, region, 60)
      .then((d: any) => setSignals(d.signals ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [companyId, region])

  // JS auto-scroll — pausedRef controls play/pause, wheel events work naturally
  useEffect(() => {
    const el = scrollRef.current
    if (!el || signals.length === 0) return

    let lastTime = performance.now()

    function tick(now: number) {
      const dt = now - lastTime
      lastTime = now

      if (!pausedRef.current && el) {
        el.scrollTop += (SCROLL_SPEED * dt) / 1000
        // Seamless loop: reset when past the first copy (half of doubled list)
        if (el.scrollTop >= el.scrollHeight / 2) {
          el.scrollTop -= el.scrollHeight / 2
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [signals])

  const items = [...signals, ...signals]

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-none">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <h2 className="text-xs font-black text-white tracking-widest uppercase">Live Feed</h2>
        </div>
      </div>

      {/* Scrollable ticker */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
        onMouseEnter={() => { pausedRef.current = true }}
        onMouseLeave={() => { pausedRef.current = false }}
      >
        {loading ? (
          <div className="p-5 space-y-4 animate-pulse">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-slate-800 rounded w-2/3" />
                <div className="h-2.5 bg-slate-800 rounded w-full" />
              </div>
            ))}
          </div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-5 text-center">
            <p className="text-sm font-bold text-slate-500">No signals yet</p>
            <p className="text-xs text-slate-600">Run ingestion to populate</p>
          </div>
        ) : (
          items.map((s, i) => {
            const sd = s.structured_data
            const importance = sd?.importance
            const summary = sd?.one_line_summary
            const enriched = s.processed === 1 && !!summary

            return (
              <a
                key={`${s.id}-${i}`}
                href={s.url ?? undefined}
                target={s.url ? '_blank' : undefined}
                rel={s.url ? 'noopener noreferrer' : undefined}
                className={`flex items-start gap-3 px-5 py-4 border-b border-slate-800 hover:bg-slate-900 transition-colors ${s.url ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-2 h-2 rounded-full flex-none mt-1.5 ${IMPORTANCE_DOT[importance ?? 'low']}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${TYPE_COLOR[s.signal_type] ?? 'bg-slate-800 text-slate-400'}`}>
                      {TYPE_LABEL[s.signal_type] ?? s.signal_type}
                    </span>
                    {s.account_name && (
                      <span className="text-xs font-black text-white truncate">{s.account_name}</span>
                    )}
                    <span className="text-[11px] text-slate-500 ml-auto flex-none whitespace-nowrap">
                      {new Date(s.ingested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-300 leading-snug line-clamp-2">
                    {enriched ? summary : (s.title ?? 'Untitled signal')}
                  </p>
                </div>
              </a>
            )
          })
        )}
      </div>
    </div>
  )
}
