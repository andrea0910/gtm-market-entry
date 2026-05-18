'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import TopBar from '@/components/TopBar'
import MarketBrief from '@/components/MarketBrief'
import AccountBoard from '@/components/AccountBoard'
import StakeholderPanel from '@/components/StakeholderPanel'
import SignalsFeed from '@/components/SignalsFeed'

// SSR disabled: Leaflet reads window/document at import time
const USMap = dynamic(() => import('@/components/USMap'), { ssr: false })

export default function Dashboard() {
  const [companyId] = useState('1')
  const [horizon, setHorizon] = useState<30 | 90 | 180 | 365>(90)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      <TopBar horizon={horizon} onHorizonChange={setHorizon} />

      {/* Main two-column area */}
      <div className="flex-1 grid grid-cols-[1fr_380px] gap-2 p-2 overflow-hidden">

        {/* Left: map */}
        <div className="relative rounded-lg border border-gray-200 bg-white overflow-hidden">
          <USMap selectedRegion={selectedRegion} onRegionSelect={setSelectedRegion} />

          {selectedRegion && (
            <div className="absolute top-3 left-3 z-[1001] flex items-center gap-2 rounded border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm">
              <span className="text-xs font-medium text-gray-700">{selectedRegion}</span>
              <button
                onClick={() => setSelectedRegion(null)}
                className="text-gray-400 hover:text-gray-700 text-xs leading-none"
                aria-label="Clear region filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Right: three panels, independently scrollable */}
        <div className="flex flex-col gap-2 overflow-y-auto">
          <MarketBrief companyId={companyId} />
          <AccountBoard companyId={companyId} region={selectedRegion} />
          <StakeholderPanel companyId={companyId} />
        </div>
      </div>

      {/* Bottom: signals feed */}
      <div className="h-44 flex-none border-t border-gray-200 bg-white">
        <SignalsFeed companyId={companyId} region={selectedRegion} />
      </div>
    </div>
  )
}
