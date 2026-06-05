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

function phaseColors(timing: string) {
  const t = timing.toLowerCase()
  if (t.includes('week') || t.includes('day') || t.includes('immediate')) {
    return { dot: 'bg-emerald-500', line: 'bg-emerald-200', badge: 'bg-emerald-50 text-emerald-700' }
  }
  if (t.match(/month\s*[12]\b/) || t.match(/^month\s*1-2/)) {
    return { dot: 'bg-blue-500', line: 'bg-blue-200', badge: 'bg-blue-50 text-blue-700' }
  }
  if (t.match(/month\s*[34]\b/) || t.match(/month\s*[23]-/)) {
    return { dot: 'bg-violet-500', line: 'bg-violet-200', badge: 'bg-violet-50 text-violet-700' }
  }
  return { dot: 'bg-amber-500', line: 'bg-amber-200', badge: 'bg-amber-50 text-amber-700' }
}

function downloadMarkdown(plan: Plan, horizon: number) {
  const sections = [
    `# GTM Plan — Nubank US · ${horizon}-Day Horizon`,
    `*Generated ${new Date(plan.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${plan.signal_count} signals*`,
    '',
    '## Objective',
    plan.objective,
    '',
    '## Milestone Timeline',
    ...plan.milestones.map(m =>
      `### ${m.timing}\n**${m.milestone}**${m.anchor ? `\n> ${m.anchor}` : ''}`
    ),
    '',
    '## Account Priorities',
    ...plan.account_priorities.map((p, i) => `${i + 1}. ${p}`),
    '',
    '## Watch Items',
    ...plan.watch_items.map(w => `- ⚠ ${w}`),
    ...(plan.critique_markdown ? ['', '## Constraint Advisory', plan.critique_markdown] : []),
  ]

  const blob = new Blob([sections.join('\n')], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nubank-gtm-${horizon}d-${new Date().toISOString().split('T')[0]}.md`
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  companyId: string
  horizon: number
  generateTrigger: number
  onClose: () => void
}

export default function GTMPlanFull({ companyId, horizon, generateTrigger, onClose }: Props) {
  const [plan, setPlan]           = useState<Plan | null>(null)
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const prevTriggerRef            = useRef(0)

  useEffect(() => {
    setLoading(true)
    fetchLatestPlan(companyId, horizon)
      .then((d: any) => setPlan(d.no_plan ? null : (d as Plan)))
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
      .then((d: any) => setPlan(d as Plan))
      .catch((e: any) => setError(e.message ?? 'Generation failed'))
      .finally(() => setGenerating(false))
  }

  const isReady = !loading && !generating && !error && plan

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex-none h-16 bg-slate-900 flex items-center px-8 gap-5 border-b border-slate-800">
        <div className="flex items-center gap-3 flex-none">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-black text-sm text-white">N</div>
          <div className="leading-tight">
            <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">GTM Plan</p>
            <p className="text-sm font-black text-white">{horizon}-Day Market Entry Roadmap</p>
          </div>
        </div>

        {plan && !generating && (
          <span className="text-xs text-slate-500 font-medium">
            {new Date(plan.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {plan.signal_count > 0 && <span className="ml-2 text-indigo-400 font-bold">· {plan.signal_count} signals</span>}
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {isReady && (
            <>
              <button
                onClick={generate}
                className="text-xs font-bold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={() => downloadMarkdown(plan, horizon)}
                className="text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg transition-colors"
              >
                ↓ Download .md
              </button>
            </>
          )}
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-base ml-1">
            ✕
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Loading */}
        {loading && (
          <div className="max-w-6xl mx-auto px-8 py-12 space-y-6 animate-pulse">
            <div className="h-10 bg-slate-200 rounded-xl w-3/4" />
            <div className="grid grid-cols-[2fr_1fr] gap-8">
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
              </div>
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl" />)}
              </div>
            </div>
          </div>
        )}

        {/* Generating */}
        {generating && (
          <div className="max-w-6xl mx-auto px-8 py-12">
            <p className="text-sm font-medium text-slate-500 mb-8 animate-pulse">Generating {horizon}-day plan from market signals…</p>
            <div className="grid grid-cols-[2fr_1fr] gap-8 animate-pulse">
              <div className="space-y-5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`h-${i % 2 === 0 ? '20' : '14'} bg-indigo-50 rounded-xl`} />
                ))}
              </div>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-indigo-50 rounded-xl" />)}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !generating && (
          <div className="max-w-6xl mx-auto px-8 py-12">
            <p className="text-sm text-rose-500 font-medium">{error}</p>
            <button onClick={generate} className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-800">Try again →</button>
          </div>
        )}

        {/* No plan */}
        {!loading && !generating && !error && !plan && (
          <div className="max-w-6xl mx-auto px-8 py-16 text-center space-y-4">
            <p className="text-lg font-black text-slate-400">No {horizon}d plan generated yet</p>
            <button
              onClick={generate}
              className="text-sm font-black text-white bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 rounded-xl transition-colors"
            >
              Generate {horizon}-Day Plan →
            </button>
          </div>
        )}

        {/* Plan content */}
        {isReady && (
          <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">

            {/* ── Objective hero ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-10 py-8">
              <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-3">
                <span className="inline-block w-5 h-0.5 bg-indigo-500" />
                Strategic Objective · {horizon}d
              </p>
              <p className="text-[22px] font-black text-slate-900 leading-snug">{plan.objective}</p>
            </div>

            {/* ── Horizon bar ── */}
            <div className="flex items-center gap-0">
              {[
                { label: 'Weeks 1-4', color: 'bg-emerald-500', sub: 'Foundation' },
                { label: 'Month 1-2', color: 'bg-blue-500', sub: 'Build' },
                { label: 'Month 2-4', color: 'bg-violet-500', sub: 'Scale' },
                { label: 'Month 4+', color: 'bg-amber-500', sub: 'Optimize' },
              ].map((phase, i) => (
                <div key={i} className="flex-1 relative group">
                  <div className={`h-2 ${phase.color} ${i === 0 ? 'rounded-l-full' : ''} ${i === 3 ? 'rounded-r-full' : ''}`} />
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full flex-none ${phase.color}`} />
                    <span className="text-[11px] font-bold text-slate-600">{phase.label}</span>
                    <span className="text-[10px] text-slate-400">{phase.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Two-column body ── */}
            <div className="grid grid-cols-[2fr_1fr] gap-8 items-start">

              {/* Timeline */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-8">
                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-8 flex items-center gap-3">
                  <span className="inline-block w-5 h-0.5 bg-indigo-500" />
                  Milestone Timeline
                </p>
                <div>
                  {plan.milestones.map((m, i) => {
                    const c = phaseColors(m.timing)
                    const isLast = i === plan.milestones.length - 1
                    return (
                      <div key={i} className="flex gap-5">
                        {/* Dot + connecting line */}
                        <div className="flex flex-col items-center flex-none w-5">
                          <div className={`w-4 h-4 rounded-full ${c.dot} ring-4 ring-white shadow z-10 flex-none`} />
                          {!isLast && <div className={`w-0.5 min-h-[2.5rem] flex-1 mt-1 ${c.line}`} />}
                        </div>
                        {/* Milestone content */}
                        <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-8'}`}>
                          <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${c.badge}`}>
                            {m.timing}
                          </span>
                          <p className="text-[16px] font-bold text-slate-900 mt-2 leading-snug">{m.milestone}</p>
                          {m.anchor && (
                            <p className="text-[13px] text-slate-400 mt-1 italic leading-relaxed">{m.anchor}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-5">

                {/* Account priorities */}
                {plan.account_priorities.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6">
                    <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-5 flex items-center gap-2">
                      <span className="inline-block w-4 h-0.5 bg-indigo-500" />
                      Account Priorities
                    </p>
                    <div className="space-y-3">
                      {plan.account_priorities.map((ap, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <span className="flex-none w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-black flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-sm text-slate-700 leading-snug">{ap}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Watch items */}
                {plan.watch_items.length > 0 && (
                  <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-6 py-6">
                    <p className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-5 flex items-center gap-2">
                      <span className="inline-block w-4 h-0.5 bg-amber-400" />
                      Watch Items
                    </p>
                    <div className="space-y-3">
                      {plan.watch_items.map((w, i) => (
                        <div key={i} className="flex gap-3 items-start p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                          <span className="text-amber-500 flex-none text-sm font-black mt-px">◆</span>
                          <p className="text-sm text-amber-900 leading-snug">{w}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Constraint advisory */}
                {plan.critique_markdown && (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 shadow-sm px-6 py-5">
                    <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span className="inline-block w-4 h-0.5 bg-rose-400" />
                      Constraint Advisory
                    </p>
                    <p className="text-sm text-rose-900 leading-relaxed">{plan.critique_markdown}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
