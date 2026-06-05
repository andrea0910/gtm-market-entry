'use client'

import { useState } from 'react'
import { runEvalVanilla, runEvalGrounded, runEvalVerify } from '@/lib/api'

const WATCHLIST = ['Chime', 'SoFi', 'Cash App', 'CFPB', 'Galileo', 'Pathward', 'NYDFS', 'Remitly', 'TelevisaUnivision']

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}
function watchlistHits(text: string) {
  return WATCHLIST.filter(e => text.includes(e))
}

interface EvalResult {
  markdown: string
  latency_ms: number
  model: string
  mode: string
  signal_count?: number
}
interface VerifiedClaim {
  claim: string
  entity: string
  grounded: boolean
  matching_signal: { account_name: string; summary: string } | null
}
interface VerifyResult {
  claims: VerifiedClaim[]
  grounded_count: number
  total: number
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  if (parts.length === 1) return text
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-black text-slate-900">{p.slice(2, -2)}</strong>
      : p
  )
}

function MarkdownPanel({ content }: { content: string }) {
  const sections = content.split(/\n(?=##? )/).filter(Boolean)
  return (
    <div className="space-y-4">
      {sections.map((section, i) => {
        const lines = section.split('\n')
        const heading = lines[0].replace(/^#+\s*/, '').trim()
        const bodyLines = lines.slice(1).filter(l => l.trim())
        const isTitle = /^(US Market Intelligence Brief|Nubank)/i.test(heading)
        return (
          <div key={i}>
            {!isTitle && (
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="inline-block w-3 h-0.5 bg-indigo-400" />{heading}
              </p>
            )}
            <div className="space-y-1.5">
              {bodyLines.map((line, j) => {
                const trimmed = line.trimStart()
                const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ')
                const text = isBullet ? trimmed.slice(2) : line
                return isBullet ? (
                  <div key={j} className="flex gap-2 items-start">
                    <span className="text-indigo-400 flex-none font-black text-xs mt-0.5">›</span>
                    <p className="text-[13px] text-gray-800 leading-relaxed">{renderInline(text)}</p>
                  </div>
                ) : (
                  <p key={j} className="text-[13px] text-gray-700 leading-relaxed">{renderInline(text)}</p>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GroundedGauge({ pct }: { pct: number }) {
  const deg = Math.round(pct * 3.6)
  const color = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative w-16 h-16 flex-none">
      <div className="w-16 h-16 rounded-full" style={{ background: `conic-gradient(${color} ${deg}deg, #f1f5f9 ${deg}deg)` }} />
      <div className="absolute inset-1.5 bg-white rounded-full flex flex-col items-center justify-center">
        <span className="text-base font-black text-slate-900 leading-none">{pct}%</span>
      </div>
    </div>
  )
}

function MetricBar({ label, vanilla, grounded, max, higherIsBetter = true }: {
  label: string; vanilla: number; grounded: number; max: number; higherIsBetter?: boolean
}) {
  const vPct = max > 0 ? (vanilla / max) * 100 : 0
  const gPct = max > 0 ? (grounded / max) * 100 : 0
  const groundedWins = higherIsBetter ? grounded > vanilla : grounded < vanilla
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        {groundedWins && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Grounded wins</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400 w-14 flex-none text-right">Vanilla</span>
        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-rose-300 rounded-full" style={{ width: `${vPct}%` }} />
        </div>
        <span className="text-[10px] font-bold text-slate-600 w-10 flex-none">{vanilla}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400 w-14 flex-none text-right">Grounded</span>
        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${gPct}%` }} />
        </div>
        <span className="text-[10px] font-bold text-indigo-700 w-10 flex-none">{grounded}</span>
      </div>
    </div>
  )
}

function buildMarkdownReport(v: EvalResult, g: EvalResult, verify: VerifyResult | null): string {
  const date = new Date().toISOString().split('T')[0]
  return [
    `# Eval Comparison — ${date}`,
    '',
    `## Vanilla (${wordCount(v.markdown)} words, ${v.latency_ms}ms)`,
    v.markdown,
    '',
    `## Grounded (${wordCount(g.markdown)} words, ${g.latency_ms}ms, ${g.signal_count ?? 0} signals)`,
    g.markdown,
    verify ? [
      '',
      `## Claim Verification`,
      `${verify.grounded_count}/${verify.total} vanilla claims grounded`,
      ...verify.claims.map(c => `- [${c.grounded ? 'GROUNDED' : 'UNVERIFIED'}] ${c.entity}: ${c.claim}`),
    ].join('\n') : '',
  ].join('\n')
}

export default function EvalPage() {
  const [vanilla, setVanilla]     = useState<EvalResult | null>(null)
  const [grounded, setGrounded]   = useState<EvalResult | null>(null)
  const [verify, setVerify]       = useState<VerifyResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [verifying, setVerifying] = useState(false)
  // track whether verification was attempted so the section stays visible even on error
  const [verifyDone, setVerifyDone] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [saved, setSaved]         = useState(false)

  async function runComparison() {
    setLoading(true)
    setVerify(null); setVerifyDone(false); setVerifyError(null); setError(null); setSaved(false)

    let v: EvalResult, g: EvalResult
    try {
      ;[v, g] = await Promise.all([runEvalVanilla(), runEvalGrounded()])
      setVanilla(v); setGrounded(g)
    } catch (e: any) {
      setError(e.message ?? 'Generation failed')
      setLoading(false)
      return
    }
    setLoading(false)

    // Auto-verify vanilla claims against DB signals
    setVerifying(true)
    try {
      const result = await runEvalVerify(v.markdown)
      setVerify(result)
    } catch (e: any) {
      setVerifyError(e.message ?? 'Verification failed')
    } finally {
      setVerifying(false)
      setVerifyDone(true)
    }
  }

  async function saveMarkdown() {
    if (!vanilla || !grounded) return
    const res = await fetch('/api/eval-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: buildMarkdownReport(vanilla, grounded, verify) }),
    })
    if (res.ok) setSaved(true)
  }

  const vHits = vanilla ? watchlistHits(vanilla.markdown) : []
  const gHits = grounded ? watchlistHits(grounded.markdown) : []
  const groundedPct = verify ? Math.round((verify.grounded_count / verify.total) * 100) : null
  const wMax = Math.max(vanilla ? wordCount(vanilla.markdown) : 0, grounded ? wordCount(grounded.markdown) : 0, 1)
  const lMax = Math.max(vanilla?.latency_ms ?? 0, grounded?.latency_ms ?? 0, 1)
  const eMax = Math.max(vHits.length, gHits.length, 1)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex-none h-16 bg-slate-900 flex items-center px-8 gap-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-black text-sm text-white">N</div>
          <div className="leading-tight">
            <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Eval</p>
            <p className="text-sm font-black text-white">Vanilla vs Grounded Intelligence</p>
          </div>
        </div>
        <div className="w-px h-8 bg-slate-700" />
        <p className="text-xs text-slate-500 font-medium hidden md:block">
          no-context claude-sonnet <span className="text-slate-700 mx-2">vs</span> signal-grounded system · claims verified against live DB
        </p>
        <div className="ml-auto flex items-center gap-3">
          <a href="/" className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
            ← Dashboard
          </a>
          {vanilla && grounded && (
            <button onClick={saveMarkdown} className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
              {saved ? '✓ Saved' : '↓ Save .md'}
            </button>
          )}
          <button
            onClick={runComparison}
            disabled={loading || verifying}
            className="text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Running models…' : verifying ? 'Verifying claims…' : 'Run Comparison'}
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-8 py-7 space-y-5">

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">{error}</div>
        )}

        {/* Scenario */}
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-6 py-4">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Scenario</p>
          <p className="text-sm text-amber-900 leading-relaxed">
            It's June 4, 2026. I'm the country GM for Nubank's US expansion. Give me a market intelligence brief for this week — what changed, what it means, and what I should prioritize. Reference specific signals from competitors, regulators, and partners where relevant.
          </p>
        </div>

        {/* ── CLAIM VERIFICATION — shown first so it's always visible ── */}
        {(loading || verifying || verifyDone) && (
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${
            verifyDone && verify
              ? groundedPct! < 50 ? 'border-rose-200' : 'border-emerald-200'
              : 'border-gray-100'
          }`}>

            {/* Header */}
            <div className={`px-7 py-5 flex items-center gap-5 ${
              verifyDone && verify
                ? groundedPct! < 50 ? 'bg-rose-50' : 'bg-emerald-50'
                : 'bg-white'
            }`}>
              <div className="flex-1">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                  Hallucination Check · Vanilla Claude
                </p>
                {loading && (
                  <p className="text-sm font-black text-slate-700 animate-pulse">Running vanilla + grounded models in parallel…</p>
                )}
                {verifying && !loading && (
                  <p className="text-sm font-black text-slate-700 animate-pulse">Extracting claims from vanilla output and cross-referencing DB signals…</p>
                )}
                {verifyDone && verify && (
                  <p className={`text-lg font-black ${groundedPct! < 50 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {verify.grounded_count}/{verify.total} vanilla claims verifiable in real signals
                    <span className="ml-2 font-medium text-sm opacity-70">({groundedPct}% grounded)</span>
                  </p>
                )}
                {verifyDone && verifyError && (
                  <p className="text-sm text-rose-600 font-medium">{verifyError}</p>
                )}
              </div>

              {verifyDone && verify && groundedPct !== null && (
                <div className="flex items-center gap-4 flex-none">
                  <GroundedGauge pct={groundedPct} />
                  <div>
                    <p className={`text-3xl font-black leading-none ${groundedPct < 50 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {100 - groundedPct}%
                    </p>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">likely hallucinated</p>
                  </div>
                </div>
              )}

              {(loading || verifying) && (
                <div className="w-16 h-16 rounded-full bg-slate-100 flex-none animate-pulse" />
              )}
            </div>

            {/* Claim cards */}
            {verifyDone && verify && (
              <div className="bg-white divide-y divide-gray-50">
                {verify.claims.map((c, i) => (
                  <div key={i} className={`px-7 py-4 flex items-start gap-4 ${!c.grounded ? 'bg-rose-50/40' : ''}`}>
                    <span className={`flex-none text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wide mt-0.5 ${
                      c.grounded ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {c.grounded ? '✓ Grounded' : '✗ Unverified'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-snug">
                        <span className="font-black text-gray-500 mr-1">{c.entity}:</span>
                        {c.claim}
                      </p>
                      {c.grounded && c.matching_signal ? (
                        <p className="text-xs text-emerald-700 mt-1 italic">
                          Matched signal: "{c.matching_signal.summary}" — {c.matching_signal.account_name}
                        </p>
                      ) : !c.grounded && (
                        <p className="text-xs font-bold text-rose-500 mt-1">
                          No matching signal in DB — likely hallucinated or invented
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(loading || verifying) && (
              <div className="bg-white px-7 py-5 space-y-3 animate-pulse">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
              </div>
            )}
          </div>
        )}

        {/* ── Metrics ── */}
        {vanilla && grounded && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-7 py-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Output Metrics</p>
            <div className="grid grid-cols-3 gap-8">
              <MetricBar label="Word count" vanilla={wordCount(vanilla.markdown)} grounded={wordCount(grounded.markdown)} max={wMax} />
              <MetricBar label="Watchlist entities" vanilla={vHits.length} grounded={gHits.length} max={eMax} />
              <MetricBar label="Latency (ms)" vanilla={vanilla.latency_ms} grounded={grounded.latency_ms} max={lMax} higherIsBetter={false} />
            </div>
            <div className="grid grid-cols-2 gap-6 mt-5 pt-4 border-t border-gray-100">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Vanilla entities</p>
                <div className="flex flex-wrap gap-1.5">
                  {vHits.length === 0
                    ? <span className="text-xs text-slate-400 italic">None — training knowledge only</span>
                    : vHits.map(e => <span key={e} className="text-xs px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md border border-rose-100 font-medium">{e}</span>)
                  }
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Grounded entities</p>
                <div className="flex flex-wrap gap-1.5">
                  {gHits.length === 0
                    ? <span className="text-xs text-slate-400 italic">None found</span>
                    : gHits.map(e => <span key={e} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 font-medium">{e}</span>)
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Side-by-side outputs ── */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black text-rose-500 uppercase tracking-widest">Vanilla Claude</p>
                <p className="text-xs text-slate-400 mt-0.5">No context · generic prompt</p>
              </div>
              {vanilla && <p className="text-xs text-slate-400">{wordCount(vanilla.markdown)} words · {vanilla.latency_ms}ms</p>}
            </div>
            <div className="flex-1 px-7 py-5 overflow-auto" style={{ minHeight: 360 }}>
              {loading ? (
                <div className="space-y-2 animate-pulse">{[...Array(10)].map((_, i) => <div key={i} className="h-3 bg-gray-100 rounded" style={{ width: `${55 + (i % 4) * 12}%` }} />)}</div>
              ) : vanilla ? (
                <MarkdownPanel content={vanilla.markdown} />
              ) : (
                <p className="text-sm text-slate-400 italic">Click "Run Comparison" to generate.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm flex flex-col">
            <div className="px-7 py-5 border-b border-indigo-100 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Grounded System</p>
                <p className="text-xs text-slate-400 mt-0.5">Signal-grounded · {grounded?.signal_count ?? 0} DB signals</p>
              </div>
              {grounded && <p className="text-xs text-slate-400">{wordCount(grounded.markdown)} words · {grounded.latency_ms}ms</p>}
            </div>
            <div className="flex-1 px-7 py-5 overflow-auto" style={{ minHeight: 360 }}>
              {loading ? (
                <div className="space-y-2 animate-pulse">{[...Array(10)].map((_, i) => <div key={i} className="h-3 bg-indigo-50 rounded" style={{ width: `${55 + (i % 4) * 12}%` }} />)}</div>
              ) : grounded ? (
                <MarkdownPanel content={grounded.markdown} />
              ) : (
                <p className="text-sm text-slate-400 italic">Click "Run Comparison" to generate.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
