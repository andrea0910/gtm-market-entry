const HORIZONS = [30, 90, 180, 365] as const
type Horizon = typeof HORIZONS[number]

interface Props {
  horizon: Horizon
  onHorizonChange: (h: Horizon) => void
}

export default function TopBar({ horizon, onHorizonChange }: Props) {
  return (
    <div className="h-11 flex-none flex items-center gap-4 px-4 bg-white border-b border-gray-200">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
          Company
        </span>
        <select className="text-sm font-medium text-gray-900 border border-gray-200 rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="1">Nubank — US</option>
        </select>
      </div>

      <div className="w-px h-4 bg-gray-200" />

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
          Horizon
        </span>
        <div className="flex gap-0.5">
          {HORIZONS.map(h => (
            <button
              key={h}
              onClick={() => onHorizonChange(h)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                horizon === h
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {h}d
            </button>
          ))}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="text-xs text-gray-400">Live</span>
      </div>
    </div>
  )
}
