'use client'

import { useState } from 'react'
import TopBar from '@/components/TopBar'
import MarketBrief from '@/components/MarketBrief'
import AccountBoard from '@/components/AccountBoard'
import SignalsFeed from '@/components/SignalsFeed'
import ComposedSignals from '@/components/ComposedSignals'
import GTMPlanFull from '@/components/GTMPlanFull'

export default function Dashboard() {
  const [companyId] = useState('1')
  const [horizon, setHorizon] = useState<30 | 90 | 180 | 365>(90)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [generateTrigger, setGenerateTrigger] = useState(0)
  const [planOpen, setPlanOpen] = useState(false)

  function handleGeneratePlan() {
    setPlanOpen(true)
    setGenerateTrigger(t => t + 1)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <TopBar
        horizon={horizon}
        onHorizonChange={setHorizon}
        onGeneratePlan={handleGeneratePlan}
        selectedRegion={selectedRegion}
        onRegionSelect={setSelectedRegion}
      />

      <div className="flex-1 grid grid-cols-[1fr_380px] overflow-hidden min-h-0">

        {/* Main scrollable content */}
        <div className="overflow-y-auto bg-white border-r border-gray-100">
          <MarketBrief companyId={companyId} />
          <div className="border-t border-gray-100">
            <ComposedSignals companyId={companyId} />
          </div>
          <div className="border-t border-gray-100">
            <AccountBoard companyId={companyId} region={selectedRegion} />
          </div>
        </div>

        {/* Right: live ticker — always full height, never scrolls */}
        <div className="overflow-hidden flex flex-col bg-slate-950">
          <SignalsFeed companyId={companyId} region={selectedRegion} />
        </div>
      </div>

      {/* GTM Plan — full-screen overlay */}
      {planOpen && (
        <div className="fixed inset-0 z-50">
          <GTMPlanFull
            companyId={companyId}
            horizon={horizon}
            generateTrigger={generateTrigger}
            onClose={() => setPlanOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
