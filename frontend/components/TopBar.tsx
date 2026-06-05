const HORIZONS = [30, 90, 180, 365] as const
type Horizon = typeof HORIZONS[number]

const REGIONS = [
  { label: 'All',      value: null },
  { label: 'TX',       value: 'Texas' },
  { label: 'CA',       value: 'California' },
  { label: 'FL',       value: 'Florida' },
  { label: 'NY',       value: 'New York' },
  { label: 'IL',       value: 'Illinois' },
] as const

interface Props {
  horizon: Horizon
  onHorizonChange: (h: Horizon) => void
  onGeneratePlan: () => void
  selectedRegion: string | null
  onRegionSelect: (r: string | null) => void
}

export default function TopBar({ horizon, onHorizonChange, onGeneratePlan, selectedRegion, onRegionSelect }: Props) {
  return (
    <div className="h-16 flex-none flex items-center gap-6 px-6 bg-slate-900 text-white">
      {/* Brand */}
      <div className="flex items-center gap-3 flex-none">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-black text-sm">
          N
        </div>
        <div className="leading-tight">
          <p className="text-sm font-black tracking-tight">NUBANK US</p>
          <p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">Market Intelligence</p>
        </div>
      </div>

      <div className="w-px h-8 bg-slate-700 flex-none" />

      {/* Horizon */}
      <div className="flex items-center gap-2 flex-none">
        <span className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold">Horizon</span>
        <div className="flex gap-0.5">
          {HORIZONS.map(h => (
            <button
              key={h}
              onClick={() => onHorizonChange(h)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                horizon === h
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {h}d
            </button>
          ))}
        </div>
      </div>

      <div className="w-px h-8 bg-slate-700 flex-none" />

      {/* Region */}
      <div className="flex items-center gap-2 flex-none">
        <span className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold">Region</span>
        <div className="flex gap-0.5">
          {REGIONS.map(r => (
            <button
              key={r.label}
              onClick={() => onRegionSelect(r.value)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                selectedRegion === r.value
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-3 flex-none">
        <a
          href="/eval"
          className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded hover:bg-slate-700 transition-colors tracking-wide uppercase"
        >
          Eval
        </a>
        <button
          onClick={onGeneratePlan}
          className="text-xs font-black text-white px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 transition-colors tracking-wide uppercase"
        >
          Generate Plan
        </button>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <span className="text-xs text-slate-400 font-semibold">LIVE</span>
        </div>
      </div>
    </div>
  )
}
