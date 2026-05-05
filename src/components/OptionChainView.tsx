import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import type { LiveAsset, LiveContract } from '../lib/binanceApi'
import type { Asset } from '../data/mockData'
import { ASSETS } from '../data/mockData'

// ── Formatting ────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  if (!n || isNaN(n)) return '—'
  if (n > 10000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n > 1)     return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}
function fmtNum(n: number, dp = 2) {
  if (!n || isNaN(n)) return '—'
  return n.toFixed(dp)
}
function fmtVol(n: number) {
  if (!n || isNaN(n)) return '—'
  if (n > 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toFixed(0)
}

// ── Columns ───────────────────────────────────────────────────────────

interface ColDef {
  key: string
  label: string
  sub?: string
  align?: 'left' | 'right' | 'center'
  width: number
  render: (row: ChainRow, side: 'call' | 'put') => React.ReactNode
}

const CALL_COLS: ColDef[] = [
  { key: 'oi',    label: 'OI',     sub: 'open int',  align: 'right', width: 56,  render: (r) => <span className="text-slate-400">{fmtVol(r.call.oi)}</span> },
  { key: 'vol',   label: 'Vol',    sub: 'volume',    align: 'right', width: 52,  render: (r) => <span className="text-slate-400">{fmtVol(r.call.volume)}</span> },
  { key: 'vega',  label: 'ν Vega', sub: '',          align: 'right', width: 56,  render: (r) => <span className="text-violet-400">{fmtNum(r.call.vega, 1)}</span> },
  { key: 'gamma', label: 'Γ',      sub: 'gamma',     align: 'right', width: 52,  render: (r) => <span className="text-slate-400">{fmtNum(r.call.gamma, 4)}</span> },
  { key: 'theta', label: 'θ Theta',sub: '/day',      align: 'right', width: 60,  render: (r) => <span className="text-red-400">{fmtNum(r.call.theta, 2)}</span> },
  { key: 'delta', label: 'Δ Delta',sub: '',          align: 'right', width: 56,  render: (r) => <span className="text-emerald-400">{fmtNum(r.call.delta, 3)}</span> },
  { key: 'iv',    label: 'IV',     sub: '%',         align: 'right', width: 52,  render: (r) => <span className="text-indigo-300">{r.call.iv > 0 ? r.call.iv.toFixed(1) + '%' : '—'}</span> },
  { key: 'ask',   label: 'Ask',    sub: '',          align: 'right', width: 72,  render: (r) => <span className="text-slate-300 font-mono">{fmtPrice(r.call.ask)}</span> },
  { key: 'bid',   label: 'Bid',    sub: '',          align: 'right', width: 72,  render: (r) => <span className="text-emerald-400 font-semibold font-mono">{fmtPrice(r.call.bid)}</span> },
]

const PUT_COLS: ColDef[] = [
  { key: 'bid',   label: 'Bid',    sub: '',          align: 'left',  width: 72,  render: (r) => <span className="text-red-400 font-semibold font-mono">{fmtPrice(r.put.bid)}</span> },
  { key: 'ask',   label: 'Ask',    sub: '',          align: 'left',  width: 72,  render: (r) => <span className="text-slate-300 font-mono">{fmtPrice(r.put.ask)}</span> },
  { key: 'iv',    label: 'IV',     sub: '%',         align: 'left',  width: 52,  render: (r) => <span className="text-indigo-300">{r.put.iv > 0 ? r.put.iv.toFixed(1) + '%' : '—'}</span> },
  { key: 'delta', label: 'Δ Delta',sub: '',          align: 'left',  width: 56,  render: (r) => <span className="text-red-400">{fmtNum(r.put.delta, 3)}</span> },
  { key: 'theta', label: 'θ Theta',sub: '/day',      align: 'left',  width: 60,  render: (r) => <span className="text-red-400">{fmtNum(r.put.theta, 2)}</span> },
  { key: 'gamma', label: 'Γ',      sub: 'gamma',     align: 'left',  width: 52,  render: (r) => <span className="text-slate-400">{fmtNum(r.put.gamma, 4)}</span> },
  { key: 'vega',  label: 'ν Vega', sub: '',          align: 'left',  width: 56,  render: (r) => <span className="text-violet-400">{fmtNum(r.put.vega, 1)}</span> },
  { key: 'vol',   label: 'Vol',    sub: 'volume',    align: 'left',  width: 52,  render: (r) => <span className="text-slate-400">{fmtVol(r.put.volume)}</span> },
  { key: 'oi',    label: 'OI',     sub: 'open int',  align: 'left',  width: 56,  render: (r) => <span className="text-slate-400">{fmtVol(r.put.oi)}</span> },
]

// ── Row types ─────────────────────────────────────────────────────────

interface Side {
  bid: number; ask: number; iv: number
  delta: number; gamma: number; theta: number; vega: number
  volume: number; oi: number
}

interface ChainRow {
  strike: number
  call: Side
  put: Side
  isATM: boolean
}

const EMPTY_SIDE: Side = { bid: 0, ask: 0, iv: 0, delta: 0, gamma: 0, theta: 0, vega: 0, volume: 0, oi: 0 }

// ── Chain builders ────────────────────────────────────────────────────

function buildLiveChain(contracts: LiveContract[], expiry: string, price: number): ChainRow[] {
  const forExpiry = contracts.filter(c => c.expiry === expiry)
  const strikes   = [...new Set(forExpiry.map(c => c.strike))].sort((a, b) => a - b)
  const callMap   = new Map(forExpiry.filter(c => c.type === 'CALL').map(c => [c.strike, c]))
  const putMap    = new Map(forExpiry.filter(c => c.type === 'PUT' ).map(c => [c.strike, c]))

  return strikes.map(strike => {
    const call = callMap.get(strike)
    const put  = putMap.get(strike)
    return {
      strike,
      call: call ? {
        bid: call.bid, ask: call.ask, iv: call.iv,
        delta: call.delta, gamma: call.gamma, theta: call.theta, vega: call.vega,
        volume: call.volume, oi: call.openInterest,
      } : EMPTY_SIDE,
      put: put ? {
        bid: put.bid, ask: put.ask, iv: put.iv,
        delta: put.delta, gamma: put.gamma, theta: put.theta, vega: put.vega,
        volume: put.volume, oi: put.openInterest,
      } : EMPTY_SIDE,
      isATM: Math.abs(strike - price) / price < 0.015,
    }
  }).filter(r => r.call.bid > 0 || r.put.bid > 0 || r.call.iv > 0 || r.put.iv > 0)
}

function buildMockChain(asset: Asset): ChainRow[] {
  const price = asset.price
  const iv    = asset.iv30
  return Array.from({ length: 13 }, (_, i) => {
    const strike    = Math.round(price * (0.88 + i * 0.02))
    const moneyness = (price - strike) / price
    const callBid   = Math.max(0.001, Math.max(0, price - strike) + price * (iv / 100) * 0.12)
    const putBid    = Math.max(0.001, Math.max(0, strike - price) + price * (iv / 100) * 0.12)
    const cDelta    = Math.max(0.01, Math.min(0.99, 0.5 + moneyness * 4))
    return {
      strike,
      call: { bid: +callBid.toFixed(4), ask: +(callBid * 1.04).toFixed(4), iv, delta: cDelta,  gamma: 0.002, theta: -price * 0.0003, vega: price * 0.01, volume: 0, oi: 0 },
      put:  { bid: +putBid.toFixed(4),  ask: +(putBid  * 1.04).toFixed(4), iv, delta: -(1 - cDelta), gamma: 0.002, theta: -price * 0.0003, vega: price * 0.01, volume: 0, oi: 0 },
      isATM: Math.abs(strike - price) / price < 0.015,
    }
  })
}

// ── Scrollable table ──────────────────────────────────────────────────

function ChainTable({ rows, side }: { rows: ChainRow[]; side: 'call' | 'put'; price: number }) {
  const cols = side === 'call' ? CALL_COLS : PUT_COLS
  const totalW = cols.reduce((s, c) => s + c.width, 0) + 64 // +64 for strike column

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#1e1e3f]" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth: totalW }}>
        {/* Header */}
        <div className="flex bg-[#0a0a18] border-b border-[#1e1e3f] sticky top-0 z-10">
          {side === 'call' && cols.map(c => (
            <div key={c.key} style={{ width: c.width, minWidth: c.width }} className="px-2 py-2 text-right">
              <div className="text-[10px] font-semibold text-slate-400">{c.label}</div>
              {c.sub && <div className="text-[9px] text-slate-600">{c.sub}</div>}
            </div>
          ))}
          {/* Strike — always center */}
          <div style={{ width: 64, minWidth: 64 }} className="px-2 py-2 text-center bg-indigo-950/30">
            <div className="text-[10px] font-bold text-indigo-400">Strike</div>
            <div className="text-[9px] text-slate-600">price</div>
          </div>
          {side === 'put' && cols.map(c => (
            <div key={c.key} style={{ width: c.width, minWidth: c.width }} className="px-2 py-2 text-left">
              <div className="text-[10px] font-semibold text-slate-400">{c.label}</div>
              {c.sub && <div className="text-[9px] text-slate-600">{c.sub}</div>}
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <motion.div
            key={row.strike}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.015 }}
            className={`flex border-b border-[#12122a] items-center ${
              row.isATM ? 'bg-indigo-950/25' : i % 2 === 0 ? 'bg-transparent' : 'bg-[#0d0d1e]/30'
            }`}
          >
            {side === 'call' && cols.map(c => (
              <div key={c.key} style={{ width: c.width, minWidth: c.width }} className="px-2 py-2.5 text-right text-xs">
                {c.render(row, 'call')}
              </div>
            ))}
            {/* Strike */}
            <div style={{ width: 64, minWidth: 64 }} className={`px-2 py-2.5 text-center bg-indigo-950/20 border-x border-indigo-900/20`}>
              <div className={`text-xs font-bold font-mono ${row.isATM ? 'text-indigo-300' : 'text-slate-200'}`}>
                {fmtPrice(row.strike)}
              </div>
              {row.isATM && (
                <div className="text-[9px] bg-indigo-600/40 text-indigo-300 rounded px-1 mt-0.5 inline-block">ATM</div>
              )}
            </div>
            {side === 'put' && cols.map(c => (
              <div key={c.key} style={{ width: c.width, minWidth: c.width }} className="px-2 py-2.5 text-left text-xs">
                {c.render(row, 'put')}
              </div>
            ))}
          </motion.div>
        ))}

        {rows.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">No contracts for this expiry</div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────

interface Props { selectedAsset: string }

export function OptionChainView({ selectedAsset }: Props) {
  const { data: liveAssets } = useQuery<LiveAsset[]>({ queryKey: ['binance-options'], enabled: false })

  const liveAsset  = liveAssets?.find(a => a.symbol === selectedAsset)
  const mockAsset  = ASSETS.find(a => a.symbol === selectedAsset) || ASSETS[0]
  const price      = liveAsset?.price || mockAsset.price
  const isLive     = !!(liveAsset?.contracts?.length)

  const expiryDates = useMemo(() => {
    if (isLive) return liveAsset!.expiryDates.slice(0, 6)
    return ['2026-05-16', '2026-05-23', '2026-05-30', '2026-06-27']
  }, [isLive, liveAsset])

  const [expiry, setExpiry]   = useState<string>('')
  const [side, setSide]       = useState<'call' | 'put'>('call')

  const activeExpiry = expiry || expiryDates[0] || ''

  const chain: ChainRow[] = useMemo(() => {
    if (isLive && activeExpiry) {
      const rows = buildLiveChain(liveAsset!.contracts, activeExpiry, price)
      if (rows.length) return rows
    }
    return buildMockChain(mockAsset)
  }, [isLive, liveAsset, activeExpiry, price, mockAsset])

  return (
    <div className="space-y-3">
      {/* Live/mock status + asset price */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
            isLive
              ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/30'
              : 'bg-amber-900/40 text-amber-500 border border-amber-700/30'
          }`}>
            {isLive ? '● Live' : '◎ Simulated'} · {selectedAsset.replace('USDT', '')}
          </span>
          {!isLive && (
            <span className="text-[10px] text-slate-600">Options only on BTC & ETH</span>
          )}
        </div>
        <span className="text-xs font-mono font-semibold text-indigo-300">{fmtPrice(price)}</span>
      </div>

      {/* Expiry pills */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {expiryDates.map(e => (
          <button key={e} onClick={() => setExpiry(e)}
            className={`flex-shrink-0 text-[11px] px-3 py-1.5 rounded-full font-medium transition-all ${
              activeExpiry === e ? 'tab-active text-white' : 'bg-[#1a1a3a] text-slate-400 border border-[#1e1e3f]'
            }`}>
            {e.slice(5)}
          </button>
        ))}
      </div>

      {/* Calls / Puts tabs */}
      <div className="flex gap-1 bg-[#0d0d20] rounded-xl p-1 border border-[#1e1e3f]">
        {(['call', 'put'] as const).map(s => (
          <button key={s} onClick={() => setSide(s)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              side === s
                ? s === 'call'
                  ? 'bg-emerald-600/80 text-white shadow-sm'
                  : 'bg-red-700/70 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}>
            {s === 'call' ? '↑ Calls' : '↓ Puts'}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
        {[
          { color: 'text-emerald-400', label: 'Bid' },
          { color: 'text-slate-300',   label: 'Ask' },
          { color: 'text-indigo-300',  label: 'IV%' },
          { color: 'text-emerald-400', label: 'Δ Delta' },
          { color: 'text-red-400',     label: 'θ Theta' },
          { color: 'text-violet-400',  label: 'ν Vega' },
          { color: 'text-slate-400',   label: 'Γ Gamma' },
          { color: 'text-slate-400',   label: 'Vol / OI' },
        ].map(l => (
          <span key={l.label} className={`text-[10px] ${l.color}`}>{l.label}</span>
        ))}
        <span className="text-[10px] text-slate-600 ml-auto">← scroll →</span>
      </div>

      {/* Animated table swap */}
      <AnimatePresence mode="wait">
        <motion.div
          key={side + activeExpiry}
          initial={{ opacity: 0, x: side === 'call' ? -12 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: side === 'call' ? 12 : -12 }}
          transition={{ duration: 0.18 }}
        >
          <ChainTable rows={chain} side={side} price={price} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
