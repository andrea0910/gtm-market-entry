'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchLatestPlan, triggerGeneratePlan } from '@/lib/api'

interface Milestone {
  timing: string
  milestone: string
  anchor: string
}

interface Plan {
  id: number
  objective: string
  milestones: Milestone[]
  account_priorities: string[]
  watch_items: string[]
  critique_markdown: string | null
  signal_count: number
  created_at: string
}

interface Props {
  companyId: string
  horizon: number
  generateTrigger: number
}

export default function GTMPlan({ companyId, horizon, generateTrigger }: Props) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasEverGeneratedRef = useRef(false)
  const prevHorizonRef = useRef<number | null>(null)
  const prevTriggerRef = useRef(0)

  useEffect(() => {
    const horizonChanged = prevHorizonRef.current !== null && prevHorizonRef.current !== horizon
    prevHorizonRef.current = horizon

    setLoading(true)
    setError(null)
    fetchLatestPlan(companyId, horizon)
      .then((d: any) => {
        if (d.no_plan) {
          setPlan(null)
          if (horizonChanged && hasEverGeneratedRef.current) {
            generate()
          }
        } else {
          setPlan(d as Plan)
          hasEverGeneratedRef.current = true
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [companyId, horizon])

  useEffect(() => {
    if (generateTrigger > prevTriggerRef.current) {
      prevTriggerRef.current = generateTrigger
      generate()
    }
  }, [generateTrigger])

  function generate() {
    setGenerating(true)
    setError(null)
    triggerGeneratePlan(companyId, horizon)
      .then((d: any) => {
        setPlan(d as Plan)
        hasEverGeneratedRef.current = true
      })
      .catch((e: any) => setError(e.message ?? 'Generation failed'))
      .finally(() => setGenerating(false))
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white flex-none">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
          GTM Plan · {horizon}d
        </h2>
        <div className="flex items-center gap-3">
          {plan && (
            <span className="text-xs text-gray-400">
              {new Date(plan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {plan.signal_count > 0 && (
                <span className="ml-1 text-gray-300">· {plan.signal_count} signals</span>
              )}
            </span>
          )}
          {plan && (
            <button
              onClick={generate}
              disabled={generating}
              className="text-xs font-medium text-indigo-500 hover:text-indigo-700 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? 'Generating…' : 'Regenerate'}
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`h-3 bg-gray-100 rounded ${i % 2 === 0 ? 'w-full' : 'w-4/5'}`} />
            ))}
          </div>
        ) : generating ? (
          <div className="space-y-2 animate-pulse">
            <p className="text-xs text-gray-400 mb-2">Generating {horizon}d plan from recent signals…</p>
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`h-3 bg-indigo-50 rounded ${i % 3 === 0 ? 'w-3/4' : 'w-full'}`} />
            ))}
          </div>
        ) : error ? (
          <p className="text-xs text-rose-500">{error}</p>
        ) : !plan ? (
          <div className="py-2 space-y-2">
            <p className="text-xs text-gray-500">No plan generated for this horizon.</p>
            <button
              onClick={generate}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Generate {horizon}d Plan →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
                Objective
              </p>
              <p className="text-xs text-gray-800 font-medium leading-relaxed">{plan.objective}</p>
            </div>

            {plan.milestones.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1.5">
                  Milestones
                </p>
                <div className="space-y-2">
                  {plan.milestones.map((m, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span className="flex-none text-xs font-semibold text-indigo-400 mt-0.5 w-20 shrink-0 leading-tight">
                        {m.timing}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 leading-snug">{m.milestone}</p>
                        {m.anchor && (
                          <p className="text-xs text-gray-400 mt-0.5 italic leading-snug">{m.anchor}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.account_priorities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
                  Account Priorities
                </p>
                <div className="space-y-0.5">
                  {plan.account_priorities.map((ap, i) => (
                    <div key={i} className="flex gap-1.5 items-start">
                      <span className="text-gray-300 flex-none mt-0.5 select-none">·</span>
                      <p className="text-xs text-gray-600 leading-relaxed">{ap}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.watch_items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
                  Watch
                </p>
                <div className="space-y-0.5">
                  {plan.watch_items.map((w, i) => (
                    <div key={i} className="flex gap-1.5 items-start">
                      <span className="text-amber-400 flex-none mt-0.5 select-none text-[9px]">◆</span>
                      <p className="text-xs text-gray-600 leading-relaxed">{w}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.critique_markdown && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                  Constraint Advisory
                </p>
                <p className="text-xs text-amber-800 leading-relaxed">{plan.critique_markdown}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
