'use client'

import { useEffect, useState } from 'react'
import { fetchBrief, regenerateBrief, fetchHypothesis } from '@/lib/api'

interface Brief {
  id?: number
  title: string
  generated_at: string | null
  markdown_content: string | null
  signal_count: number
  no_brief: boolean
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-black text-slate-900">{part.slice(2, -2)}</strong>
      : part
  )
}

function OpenQuestionsSection({ lines, companyId }: { lines: string[]; companyId: string }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [hypotheses, setHypotheses] = useState<Record<number, string>>({})
  const [loadingIdx, setLoadingIdx] = useState<Set<number>>(new Set())

  async function toggle(idx: number, question: string) {
    if (expanded.has(idx)) {
      setExpanded(prev => { const n = new Set(prev); n.delete(idx); return n })
      return
    }
    setExpanded(prev => new Set([...prev, idx]))
    if (hypotheses[idx] !== undefined) return

    setLoadingIdx(prev => new Set([...prev, idx]))
    try {
      const res = await fetchHypothesis(companyId, question)
      setHypotheses(prev => ({ ...prev, [idx]: res.hypothesis ?? '' }))
    } catch {
      setHypotheses(prev => ({ ...prev, [idx]: '—' }))
    } finally {
      setLoadingIdx(prev => { const n = new Set(prev); n.delete(idx); return n })
    }
  }

  return (
    <div className="space-y-3">
      {lines.map((line, j) => {
        const trimmed = line.trimStart()
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ')
        const text = isBullet ? trimmed.slice(2) : line.trim()
        if (!text) return null

        if (!isBullet) {
          return <p key={j} className="text-[15px] text-gray-800 leading-relaxed">{renderInline(text)}</p>
        }

        const isOpen = expanded.has(j)
        const isLoading = loadingIdx.has(j)
        const hypothesis = hypotheses[j]

        return (
          <div key={j}>
            <button
              onClick={() => toggle(j, text)}
              className="flex gap-3 items-start w-full text-left group"
            >
              <span className="text-indigo-400 flex-none font-black mt-1 text-xs transition-transform group-hover:text-indigo-600">
                {isOpen ? '▾' : '▸'}
              </span>
              <p className="text-[15px] text-gray-800 leading-relaxed group-hover:text-slate-900 transition-colors">
                {renderInline(text)}
              </p>
            </button>
            {isOpen && (
              <div className="ml-5 mt-2 pl-4 border-l-2 border-indigo-100">
                {isLoading ? (
                  <div className="space-y-1.5 animate-pulse py-1">
                    <div className="h-3 bg-indigo-50 rounded w-full" />
                    <div className="h-3 bg-indigo-50 rounded w-4/5" />
                    <div className="h-3 bg-indigo-50 rounded w-3/5" />
                  </div>
                ) : (
                  <p className="text-[14px] text-indigo-900 leading-relaxed py-1">
                    <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mr-2">Hypothesis</span>
                    {hypothesis}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MarkdownBrief({ content, companyId }: { content: string; companyId: string }) {
  // Strip leading `# Title` lines — keep only `## Section` blocks
  const sections = content.split(/\n(?=## )/).filter(s => s.trimStart().startsWith('## '))

  return (
    <div className="divide-y divide-gray-100">
      {sections.map((section, i) => {
        const lines = section.split('\n')
        const heading = lines[0].replace(/^#+\s*/, '').trim()
        const bodyLines = lines.slice(1).filter(l => l.trim())
        const isOpenQuestions = /open.?question/i.test(heading)

        return (
          <div key={i} className="px-8 py-6">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-3">
              <span className="inline-block w-5 h-0.5 bg-indigo-500" />
              {heading}
              {isOpenQuestions && (
                <span className="text-[10px] text-slate-400 normal-case tracking-normal font-medium">click to expand hypothesis</span>
              )}
            </p>
            {isOpenQuestions ? (
              <OpenQuestionsSection lines={bodyLines} companyId={companyId} />
            ) : (
              <div className="space-y-2.5">
                {bodyLines.map((line, j) => {
                  const trimmed = line.trimStart()
                  const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ')
                  const text = isBullet ? trimmed.slice(2) : line
                  return isBullet ? (
                    <div key={j} className="flex gap-3 items-start">
                      <span className="text-indigo-400 flex-none font-black mt-0.5">›</span>
                      <p className="text-[15px] text-gray-800 leading-relaxed">{renderInline(text)}</p>
                    </div>
                  ) : (
                    <p key={j} className="text-[15px] text-gray-800 leading-relaxed">{renderInline(text)}</p>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function MarketBrief({ companyId }: { companyId: string }) {
  const [brief, setBrief]   = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBrief(companyId)
      .then(async (d: Brief) => {
        if (d.no_brief) {
          // Auto-generate on first load — no button needed
          const generated = await regenerateBrief(companyId)
          setBrief(generated)
        } else {
          setBrief(d)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [companyId])

  return (
    <div>
      {/* Hero header */}
      <div className="px-8 pt-8 pb-5 border-b border-gray-100">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Market Brief</p>
        <h1 className="text-2xl font-black text-slate-900 leading-tight">
          Nubank US Expansion
        </h1>
        {brief?.generated_at && (
          <p className="text-sm text-slate-500 mt-1 font-medium flex items-center gap-2">
            {new Date(brief.generated_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {brief.signal_count > 0 && (
              <span className="text-indigo-500 font-bold">· {brief.signal_count} signals</span>
            )}
          </p>
        )}
      </div>

      {loading ? (
        <div className="px-8 py-8 space-y-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`h-4 bg-gray-100 rounded ${i % 3 === 0 ? 'w-2/5' : 'w-full'}`} />
          ))}
        </div>
      ) : brief?.markdown_content ? (
        <MarkdownBrief content={brief.markdown_content} companyId={companyId} />
      ) : (
        <div className="px-8 py-8">
          <p className="text-base text-gray-600 font-medium">No brief generated yet.</p>
          <p className="text-sm text-gray-400 mt-1">Run signal enrichment to populate.</p>
        </div>
      )}
    </div>
  )
}
