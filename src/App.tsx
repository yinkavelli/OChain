import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, TrendingUp, Activity, Zap, BarChart2, WifiOff, LogIn, LogOut } from 'lucide-react'
import oChainLogo from '/OChain.png'
import { useAuth } from './hooks/useAuth'
import { LoginModal } from './components/LoginModal'

import { Ticker } from './components/Ticker'
import { StatCard } from './components/StatCard'
import { StrategyCard } from './components/StrategyCard'
import { StrategyDrawer } from './components/StrategyDrawer'
import { AssetSelector } from './components/AssetSelector'
import { FilterBar } from './components/FilterBar'
import { IVChart } from './components/IVChart'
import { BottomNav } from './components/BottomNav'
import { OptionChainView } from './components/OptionChainView'
import { PortfolioView } from './components/PortfolioView'
import { ApiKeySettings } from './components/ApiKeySettings'

import { STRATEGIES } from './data/mockData'
import type { Strategy, StrategyType } from './data/mockData'
import { useLiveData, useMergedAssets, useLiveStrategies } from './hooks/useLiveData'
import { useQueryClient } from '@tanstack/react-query'

export default function App() {
  const { user, signOut } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedAsset, setSelectedAsset] = useState('BTCUSDT')
  const [strategyFilter, setStrategyFilter] = useState<StrategyType | 'All'>('All')
  const [sentimentFilter, setSentimentFilter] = useState('All')
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)
  const [, setLastRefresh] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)

  const queryClient = useQueryClient()
  const { data: liveAssets, isLoading, isError, dataUpdatedAt } = useLiveData()

  const assets  = useMergedAssets(liveAssets)
  const liveStrategies = useLiveStrategies(liveAssets)
  const strategies = liveStrategies.length ? liveStrategies : STRATEGIES

  const asset = assets.find(a => a.symbol === selectedAsset) ?? assets[0]

  const filtered = useMemo(() => {
    return strategies.filter(s => {
      if (s.symbol !== selectedAsset) return false
      if (strategyFilter !== 'All' && s.type !== strategyFilter) return false
      if (sentimentFilter !== 'All' && s.sentiment !== sentimentFilter) return false
      return true
    })
  }, [strategies, selectedAsset, strategyFilter, sentimentFilter])

  function handleRefresh() {
    setRefreshing(true)
    queryClient.invalidateQueries({ queryKey: ['binance-options'] })
    setTimeout(() => {
      setRefreshing(false)
      setLastRefresh(new Date())
    }, 1500)
  }

  const topScore = filtered[0]?.score ?? 0
  const avgPop = filtered.length
    ? (filtered.reduce((s, x) => s + x.probabilityOfProfit, 0) / filtered.length).toFixed(1)
    : '—'

  // Build markPrices map from live contracts for P&L calculation
  const markPrices = useMemo(() => {
    const map: Record<string, number> = {}
    if (liveAssets) {
      for (const a of liveAssets) {
        for (const c of (a.contracts ?? [])) {
          if (c.symbol && c.markPrice > 0) map[c.symbol] = c.markPrice
        }
      }
    }
    return map
  }, [liveAssets])

  return (
    <>
    {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    <div className="min-h-svh bg-[#0a0a14] text-slate-200">
      <header className="sticky top-0 z-20 border-b border-[#1e1e3f]"
        style={{ background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <img src={oChainLogo} alt="OChain" className="h-10 w-auto drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-right">
              <div className="flex items-center gap-1 justify-end mb-0.5">
                {isError ? (
                  <><WifiOff className="w-2.5 h-2.5 text-amber-400" /><span className="text-amber-400 font-medium">Mock</span></>
                ) : isLoading && !liveAssets ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" /><span className="text-indigo-400 font-medium">Loading…</span></>
                ) : (
                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-emerald-400 font-medium">Live</span></>
                )}
              </div>
              <div className="text-slate-500">
                {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </div>
            </div>
            <button onClick={handleRefresh}
              className="w-8 h-8 rounded-xl bg-[#1a1a3a] border border-[#1e1e3f] flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing || isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            {user ? (
              <button onClick={() => signOut()}
                className="w-8 h-8 rounded-xl bg-[#1a1a3a] border border-[#1e1e3f] flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"
                title="Sign out">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button onClick={() => setShowLogin(true)}
                className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-700/50 flex items-center justify-center text-indigo-400 hover:bg-indigo-600/50 transition-colors"
                title="Sign in">
                <LogIn className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <Ticker />
      </header>

      <main className="px-4 pt-4 pb-24 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-5">
              <AssetSelector assets={assets} selected={selectedAsset} onSelect={setSelectedAsset} />
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="IV Rank" value={`${asset.ivRank}`}
                  sub={asset.ivRank > 70 ? '↑ Elevated — sell premium' : '↓ Low — buy premium'}
                  icon={<Activity className="w-4 h-4" />}
                  color={asset.ivRank > 70 ? 'emerald' : 'indigo'}
                  trend={asset.ivRank > 70 ? 'up' : 'down'} delay={0}
                  tooltip={{
                    title: 'IV Rank (IVR)',
                    body: 'IV Rank measures where current Implied Volatility sits relative to its 52-week high/low range. A rank of 80 means IV is in the top 20% of its annual range — options are expensive. A rank of 20 means IV is cheap relative to history.',
                    how: 'When IVR is above 70, options are richly priced — favour premium-selling strategies like Covered Calls, Cash-Secured Puts, or Iron Condors to collect inflated premium. When IVR is below 30, options are cheap — favour premium-buying strategies like Long Straddles or debit spreads.',
                    signal: 'IVR > 70 → Sell premium. IVR < 30 → Buy premium. IVR 30–70 → Neutral, favour spreads.',
                  }} />
                <StatCard label="IV30" value={`${asset.iv30 > 0 ? asset.iv30 + '%' : '—'}`} sub={`HV30: ${asset.hv30 > 0 ? asset.hv30 + '%' : '—'}`}
                  icon={<BarChart2 className="w-4 h-4" />} color="violet" delay={0.05}
                  tooltip={{
                    title: 'Implied vs Historical Volatility',
                    body: 'IV30 is the market\'s consensus forecast of annualised price movement over the next 30 days, derived from option prices. HV30 is the actual realised volatility over the past 30 days. The gap between them is the "vol premium" options sellers capture.',
                    how: 'When IV30 significantly exceeds HV30 (IV > HV by 10%+ points), options are priced above recent reality — a strong signal to sell premium. When IV30 is close to or below HV30, the edge disappears and buying vol may be worth exploring.',
                    signal: 'IV30 > HV30 by 10%+ → Sell vol. IV30 ≈ HV30 → Neutral. IV30 < HV30 → Consider long vol.',
                  }} />
                <StatCard label="Top Score" value={topScore} sub={filtered[0]?.type ?? '—'}
                  icon={<TrendingUp className="w-4 h-4" />} color="indigo" delay={0.1}
                  tooltip={{
                    title: 'Strategy Score',
                    body: 'A composite 0–100 score ranking how attractive a strategy setup is right now. It blends three factors: Probability of Profit (50% weight), Risk/Reward ratio (30% weight), and Days-to-Expiry suitability (20% weight). Scores above 75 are high-conviction setups.',
                    how: 'Sort the Screener by score to surface the highest-conviction setups for this asset. A score above 75 combined with IVR > 70 is the classic premium-selling sweet spot. Use it as a starting filter, not a final decision — always verify the payoff diagram and breakeven levels.',
                    signal: 'Score ≥ 75 → High conviction. Score 60–74 → Moderate. Score < 60 → Borderline, size down.',
                  }} />
                <StatCard label="Avg PoP" value={`${avgPop}%`} sub={`${filtered.length} strategies`}
                  icon={<Zap className="w-4 h-4" />} color="emerald" delay={0.15}
                  tooltip={{
                    title: 'Average Probability of Profit',
                    body: 'The average Probability of Profit (PoP) across all screened strategies. For each strategy, PoP estimates the likelihood the trade finishes in profit at expiry. It\'s approximated from option deltas — a short 30-delta call has roughly a 70% PoP.',
                    how: 'Higher PoP strategies (>65%) win more often but pay less per win — they\'re income-style trades. Lower PoP strategies (<50%) win less often but can pay multiples when they do. Match PoP to your risk tolerance: conservative accounts favour >65% PoP; speculative accounts can tolerate 40–50%.',
                    signal: 'PoP > 70% → Conservative, income focus. PoP 50–70% → Balanced. PoP < 50% → Speculative, size small.',
                  }} />
              </div>
              <IVChart assets={assets} selected={selectedAsset} />
              {filtered[0] && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-sm font-semibold text-slate-300">Top Opportunity</h3>
                    <button onClick={() => setActiveTab('screener')} className="text-xs text-indigo-400">View all →</button>
                  </div>
                  <StrategyCard strategy={filtered[0]} index={0} onClick={() => setSelectedStrategy(filtered[0])} />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'screener' && (
            <motion.div key="screener"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-0.5">Strategy Screener</h2>
                <p className="text-xs text-slate-500">{filtered.length} strategies found</p>
              </div>
              <AssetSelector assets={assets} selected={selectedAsset} onSelect={setSelectedAsset} />
              <FilterBar strategy={strategyFilter} sentiment={sentimentFilter}
                onStrategy={setStrategyFilter} onSentiment={setSentimentFilter} />
              <div className="space-y-3">
                {filtered.length === 0
                  ? <div className="text-center py-12 text-slate-500 text-sm">No strategies match filters</div>
                  : filtered.map((s, i) => (
                    <StrategyCard key={s.id} strategy={s} index={i} onClick={() => setSelectedStrategy(s)} />
                  ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'chains' && (
            <motion.div key="chains"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-0.5">Option Chains</h2>
                <p className="text-xs text-slate-500">Live bid/ask matrix · {selectedAsset.replace('USDT', '')}</p>
              </div>
              <AssetSelector assets={assets} selected={selectedAsset} onSelect={setSelectedAsset} />
              <OptionChainView selectedAsset={selectedAsset} />
            </motion.div>
          )}

          {activeTab === 'portfolio' && (
            <motion.div key="portfolio"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <PortfolioView markPrices={markPrices} />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-0.5">Settings</h2>
                <p className="text-xs text-slate-500">Account & preferences</p>
              </div>

              {/* API Key section */}
              <div className="gradient-card rounded-2xl p-4">
                <ApiKeySettings onChange={() => {/* triggers re-render */}} />
              </div>

              {/* App preferences */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Preferences</p>
                {[
                  { label: 'Auto-Refresh', sub: 'Refresh market data every 30s', on: true },
                  { label: 'IV Rank Alerts', sub: 'Notify when IVR > 70', on: true },
                  { label: 'Sound Alerts', sub: 'Play sound on signals', on: false },
                ].map((s, i) => (
                  <motion.div key={s.label}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="gradient-card rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{s.label}</div>
                      <div className="text-xs text-slate-500">{s.sub}</div>
                    </div>
                    <div className={`w-11 h-6 rounded-full cursor-pointer relative ${s.on ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${s.on ? 'left-6' : 'left-1'}`} />
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="gradient-card rounded-2xl p-4">
                <div className="text-sm font-medium text-white mb-1">Version</div>
                <div className="text-xs text-indigo-400 font-mono">OChain v1.1.0 · Binance Options API</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />
      <StrategyDrawer strategy={selectedStrategy} onClose={() => setSelectedStrategy(null)} />
    </div>
    </>
  )
}
