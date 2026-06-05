'use client'

import { useEffect, useState } from 'react'
import { fetchComposedSignals } from '@/lib/api'

type CompositionType = 'hiring_cluster' | 'cross_source_pattern' | 'regulatory_overlap' | 'competitive_escalation'

interface ComposedSignal {
  id: number
  created_at: string
  signal_ids_referenced: number[]
  composition_type: CompositionType
  account_id: number | null
  importance: 'high' | 'medium' | 'low'
  one_line_summary: string
  explanation: string
}

const ALL_TYPES: CompositionType[] = [
  'hiring_cluster', 'cross_source_pattern', 'regulatory_overlap', 'competitive_escalation',
]

const TYPE_LABEL: Record<CompositionType, string> = {
  hiring_cluster:         'Hiring Cluster',
  cross_source_pattern:   'Cross-Source',
  regulatory_overlap:     'Reg. Overlap',
  competitive_escalation: 'Escalation',
}

const TYPE_COLOR: Record<CompositionType, string> = {
  hiring_cluster:         'bg-violet-100 text-violet-700',
  cross_source_pattern:   'bg-blue-100 text-blue-700',
  regulatory_overlap:     'bg-amber-100 text-amber-700',
  competitive_escalation: 'bg-rose-100 text-rose-700',
}

const IMPORTANCE_COLOR: Record<string, string> = {
  high:   'text-rose-600',
  medium: 'text-amber-600',
  low:    'text-slate-400',
}

const IMPORTANCE_BAR: Record<string, string> = {
  high:   'bg-rose-500',
  medium: 'bg-amber-400',
  low:    'bg-slate-300',
}

const QUIET_EXPLANATION: Record<CompositionType, string> = {
  hiring_cluster:
    'No competitor has concentrated 3+ hires in one capability area within 14 days — hiring is spreading across functions rather than converging on a single build.',
  cross_source_pattern:
    'No account has simultaneous job postings and notable news coverage within a 7-day window.',
  regulatory_overlap:
    'No simultaneous high-importance signals from multiple regulators — no coordinated regulatory shift currently in progress.',
  competitive_escalation:
    'No competitor has produced 2+ high-importance signals within 14 days — competitive momentum is not visibly accelerating.',
}

export default function ComposedSignals({ companyId }: { companyId: string }) {
  const [signals, setSignals] = useState<ComposedSignal[]>([])
  const [patternCounts, setPatternCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchComposedSignals(companyId, 5)
      .then((d: any) => {
        setSignals(d.composed_signals ?? [])
        setPatternCounts(d.pattern_counts ?? {})
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [companyId])

  const quietTypes = ALL_TYPES.filter(t => !patternCounts[t])

  return (
    <div>
      {/* Section header */}
      <div className="px-8 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-0.5">Composed Signals</p>
          <p className="text-lg font-black text-slate-900">Pattern Detection</p>
        </div>
        {!loading && signals.length > 0 && (
          <span className="text-sm font-bold text-slate-500">{signals.length} patterns active</span>
        )}
      </div>

      {loading ? (
        <div className="px-8 pb-6 space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="px-8 pb-6">
          <p className="text-base text-gray-400">No patterns detected yet.</p>
          <p className="text-sm text-gray-300 mt-1">Run <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">POST /api/admin/run-composition</code></p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {signals.map(cs => (
            <div key={cs.id} className="px-8 py-5 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                {/* Importance bar */}
                <div className={`w-1 self-stretch rounded-full flex-none ${IMPORTANCE_BAR[cs.importance]}`} />

                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${TYPE_COLOR[cs.composition_type]}`}>
                      {TYPE_LABEL[cs.composition_type]}
                    </span>
                    <span className={`text-xs font-black uppercase ${IMPORTANCE_COLOR[cs.importance]}`}>
                      {cs.importance}
                    </span>
                  </div>

                  {/* Headline */}
                  <p className="text-[17px] font-black text-slate-900 leading-snug mb-2">
                    {cs.one_line_summary}
                  </p>

                  {/* Explanation */}
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {cs.explanation}
                  </p>

                  <p className="mt-2 text-[11px] text-slate-400 font-medium">
                    {cs.signal_ids_referenced.length} source signal{cs.signal_ids_referenced.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quiet patterns */}
      {!loading && quietTypes.length > 0 && (
        <div className="px-8 py-5 border-t border-dashed border-gray-200 bg-slate-50">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Quiet Patterns</p>
          <div className="space-y-3">
            {quietTypes.map(t => (
              <div key={t} className="flex items-start gap-3">
                <span className="flex-none text-xs font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-500 mt-0.5">
                  {TYPE_LABEL[t]}
                </span>
                <p className="text-sm text-slate-500 leading-relaxed">{QUIET_EXPLANATION[t]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
