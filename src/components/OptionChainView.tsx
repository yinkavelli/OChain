import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import type { LiveContract } from '../lib/binanceApi'
import type { Asset } from '../data/mockData'
import { ASSETS } from '../data/mockData'

function fmtPrice(n: number) {
  if (n > 10000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n > 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

interface ChainRow {
  strike: number
  call: { bid: number; ask: number; iv: number; delta: number; oi: number }
  put:  { bid: number; ask: number; iv: number; delta: number; oi: number }
  isATM: boolean
}

function buildMockChain(asset: Asset, _expiry: string): ChainRow[] {
  const price = asset.price
  const strikes = Array.from({ length: 13 }, (_, i) => {
    const pct = 0.88 + i * 0.02
    return Math.round(price * pct)
  })
  return strikes.map(strike => {
    const moneyness = (price - strike) / price
    const callBid = Math.max(0.001, Math.max(0, price - strike) + price * (asset.iv30 / 100) * 0.12)
    const putBid  = Math.max(0.001, Math.max(0, strike - price) + price * (asset.iv30 / 100) * 0.12)
    return {
      strike,
      call: { bid: +callBid.toFixed(4), ask: +(callBid * 1.04).toFixed(4), iv: asset.iv30, delta: Math.max(0.01, Math.min(0.99, 0.5 + moneyness * 4)), oi: 0 },
      put:  { bid: +putBid.toFixed(4),  ask: +(putBid  * 1.04).toFixed(4), iv: asset.iv30, delta: -Math.max(0.01, Math.min(0.99, 0.5 - moneyness * 4)), oi: 0 },
      isATM: Math.abs(strike - price) / price < 0.015,
    }
  })
}

function buildLiveChain(contracts: LiveContract[], expiry: string, price: number): ChainRow[] {
  const forExpiry = contracts.filter(c => c.expiry === expiry)
  const strikes = [...new Set(forExpiry.map(c => c.strike))].sort((a, b) => a - b)
  const callMap = new Map(forExpiry.filter(c => c.type === 'CALL').map(c => [c.strike, c]))
  const putMap  = new Map(forExpiry.filter(c => c.type === 'PUT' ).map(c => [c.strike, c]))

  return strikes.map(strike => {
    const call = callMap.get(strike)
    const put  = putMap.get(strike)
    return {
      strike,
      call: {
        bid: call?.bid ?? 0, ask: call?.ask ?? 0,
        iv: call?.iv ?? 0, delta: call?.delta ?? 0, oi: call?.openInterest ?? 0,
      },
      put: {
        bid: put?.bid ?? 0, ask: put?.ask ?? 0,
        iv: put?.iv ?? 0, delta: put?.delta ?? 0, oi: put?.openInterest ?? 0,
      },
      isATM: Math.abs(strike - price) / price < 0.015,
    }
  }).filter(r => r.call.bid > 0 || r.put.bid > 0)
}

interface Props {
  selectedAsset: string
}

export function OptionChainView({ selectedAsset }: Props) {
  const { data: liveAssets } = useQuery({
    queryKey: ['binance-options'],
    enabled: false,  // reads from cache only — fetched by App
  })

  const liveAsset = (liveAssets as any)?.find((a: any) => a.symbol === selectedAsset)
  const mockAsset = ASSETS.find(a => a.symbol === selectedAsset) || ASSETS[0]
  const price     = liveAsset?.price || mockAsset.price

  const expiryDates: string[] = liveAsset?.expiryDates?.length
    ? liveAsset.expiryDates.slice(0, 6)
    : ['2026-05-09', '2026-05-16', '2026-05-23', '2026-05-30']

  const [expiry, setExpiry] = useState<string>(expiryDates[1] ?? expiryDates[0])

  const chain: ChainRow[] = useMemo(() => {
    if (liveAsset?.contracts?.length) {
      const rows = buildLiveChain(liveAsset.contracts, expiry, price)
      if (rows.length > 0) return rows
    }
    return buildMockChain(mockAsset, expiry)
  }, [liveAsset, mockAsset, expiry, price])

  const isLive = liveAsset?.contracts?.length > 0

  return (
    <div className="space-y-4">
      {/* Live/mock badge */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          isLive ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/30'
                 : 'bg-amber-900/50 text-amber-500 border border-amber-700/30'
        }`}>
          {isLive ? '● Live' : '◎ Mock'} · {selectedAsset.replace('USDT', '')}
        </span>
        {isLive && <span className="text-[10px] text-slate-500">{chain.length} strikes</span>}
      </div>

      {/* Expiry selector */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {expiryDates.map(e => (
          <button key={e} onClick={() => setExpiry(e)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
              expiry === e ? 'tab-active text-white' : 'bg-[#1a1a3a] text-slate-400 border border-[#1e1e3f]'
            }`}>
            {e.slice(5)}
          </button>
        ))}
      </div>

      <div className="bg-[#0d0d20] rounded-2xl border border-[#1e1e3f] overflow-hidden">
        <div className="grid grid-cols-7 gap-0 text-[10px] text-slate-500 font-medium px-3 py-2 bg-[#0a0a18] border-b border-[#1e1e3f]">
          <span>Call Bid</span>
          <span>IV</span>
          <span>Δ</span>
          <span className="text-center text-indigo-400">Strike</span>
          <span className="text-right">Δ</span>
          <span className="text-right">IV</span>
          <span className="text-right">Put Bid</span>
        </div>

        {chain.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">No contracts for this expiry</div>
        ) : chain.map((row, i) => (
          <motion.div key={row.strike}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className={`grid grid-cols-7 gap-0 text-xs px-3 py-2.5 border-b border-[#1a1a30] ${
              row.isATM ? 'bg-indigo-950/30' : ''
            }`}>
            <span className="text-emerald-400 font-mono">{row.call.bid > 0 ? fmtPrice(row.call.bid) : '—'}</span>
            <span className="text-slate-400 font-mono">{row.call.iv > 0 ? `${row.call.iv.toFixed(0)}%` : '—'}</span>
            <span className="text-slate-300 font-mono">{row.call.delta !== 0 ? row.call.delta.toFixed(2) : '—'}</span>
            <span className={`text-center font-bold font-mono ${row.isATM ? 'text-indigo-300' : 'text-slate-200'}`}>
              {fmtPrice(row.strike)}
              {row.isATM && <span className="ml-1 text-[9px] bg-indigo-600/40 text-indigo-300 px-1 rounded">ATM</span>}
            </span>
            <span className="text-right text-slate-300 font-mono">{row.put.delta !== 0 ? row.put.delta.toFixed(2) : '—'}</span>
            <span className="text-right text-slate-400 font-mono">{row.put.iv > 0 ? `${row.put.iv.toFixed(0)}%` : '—'}</span>
            <span className="text-right text-red-400 font-mono">{row.put.bid > 0 ? fmtPrice(row.put.bid) : '—'}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
