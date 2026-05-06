import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import type { LiveAsset, LiveContract } from '../lib/binanceApi'
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
function fmtOI(n: number) {
  if (!n || isNaN(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
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
  { key: 'bid',   label: 'Bid',     sub: 'IV',   align: 'left', width: 80,
    render: (r) => <div><div className="text-emerald-400 font-semibold font-mono">{fmtPrice(r.call.bid)}</div><div className="text-[9px] text-slate-500">{r.call.bidIV > 0 ? r.call.bidIV.toFixed(2) + '%' : '—'}</div></div> },
  { key: 'ask',   label: 'Ask',     sub: 'IV',   align: 'left', width: 80,
    render: (r) => <div><div className="text-slate-300 font-mono">{fmtPrice(r.call.ask)}</div><div className="text-[9px] text-slate-500">{r.call.askIV > 0 ? r.call.askIV.toFixed(2) + '%' : '—'}</div></div> },
  { key: 'mark',  label: 'Mark',    sub: 'IV',   align: 'left', width: 80,
    render: (r) => <div><div className="text-indigo-300 font-mono">{fmtPrice(r.call.markPrice)}</div><div className="text-[9px] text-indigo-500">{r.call.iv > 0 ? r.call.iv.toFixed(1) + '%' : '—'}</div></div> },
  { key: 'delta', label: 'Δ Delta', sub: '',      align: 'left', width: 56,  render: (r) => <span className="text-emerald-400">{fmtNum(r.call.delta, 3)}</span> },
  { key: 'theta', label: 'θ',       sub: '/day',  align: 'left', width: 52,  render: (r) => <span className="text-red-400">{fmtNum(r.call.theta, 2)}</span> },
  { key: 'gamma', label: 'Γ',       sub: 'gamma', align: 'left', width: 52,  render: (r) => <span className="text-slate-400">{fmtNum(r.call.gamma, 4)}</span> },
  { key: 'vega',  label: 'ν Vega',  sub: '',      align: 'left', width: 56,  render: (r) => <span className="text-violet-400">{fmtNum(r.call.vega, 1)}</span> },
  { key: 'vol',   label: 'Vol',     sub: '',      align: 'left', width: 52,  render: (r) => <span className="text-slate-400">{fmtVol(r.call.volume)}</span> },
  { key: 'oi',    label: 'OI',      sub: '',      align: 'left', width: 60,  render: (r) => <span className="text-slate-400">{fmtOI(r.call.oi)}</span> },
]

const PUT_COLS: ColDef[] = [
  { key: 'bid',   label: 'Bid',     sub: 'IV',   align: 'left', width: 80,
    render: (r) => <div><div className="text-red-400 font-semibold font-mono">{fmtPrice(r.put.bid)}</div><div className="text-[9px] text-slate-500">{r.put.bidIV > 0 ? r.put.bidIV.toFixed(2) + '%' : '—'}</div></div> },
  { key: 'ask',   label: 'Ask',     sub: 'IV',   align: 'left', width: 80,
    render: (r) => <div><div className="text-slate-300 font-mono">{fmtPrice(r.put.ask)}</div><div className="text-[9px] text-slate-500">{r.put.askIV > 0 ? r.put.askIV.toFixed(2) + '%' : '—'}</div></div> },
  { key: 'mark',  label: 'Mark',    sub: 'IV',   align: 'left', width: 80,
    render: (r) => <div><div className="text-indigo-300 font-mono">{fmtPrice(r.put.markPrice)}</div><div className="text-[9px] text-indigo-500">{r.put.iv > 0 ? r.put.iv.toFixed(1) + '%' : '—'}</div></div> },
  { key: 'delta', label: 'Δ Delta', sub: '',      align: 'left', width: 56,  render: (r) => <span className="text-red-400">{fmtNum(r.put.delta, 3)}</span> },
  { key: 'theta', label: 'θ',       sub: '/day',  align: 'left', width: 52,  render: (r) => <span className="text-red-400">{fmtNum(r.put.theta, 2)}</span> },
  { key: 'gamma', label: 'Γ',       sub: 'gamma', align: 'left', width: 52,  render: (r) => <span className="text-slate-400">{fmtNum(r.put.gamma, 4)}</span> },
  { key: 'vega',  label: 'ν Vega',  sub: '',      align: 'left', width: 56,  render: (r) => <span className="text-violet-400">{fmtNum(r.put.vega, 1)}</span> },
  { key: 'vol',   label: 'Vol',     sub: '',      align: 'left', width: 52,  render: (r) => <span className="text-slate-400">{fmtVol(r.put.volume)}</span> },
  { key: 'oi',    label: 'OI',      sub: '',      align: 'left', width: 60,  render: (r) => <span className="text-slate-400">{fmtOI(r.put.oi)}</span> },
]

// ── Row types ─────────────────────────────────────────────────────────

interface Side {
  bid: number; ask: number; iv: number; bidIV: number; askIV: number; markPrice: number
  delta: number; gamma: number; theta: number; vega: number
  volume: number; oi: number
}

interface ChainRow {
  strike: number
  call: Side
  put: Side
  isATM: boolean
}

const EMPTY_SIDE: Side = { bid: 0, ask: 0, iv: 0, bidIV: 0, askIV: 0, markPrice: 0, delta: 0, gamma: 0, theta: 0, vega: 0, volume: 0, oi: 0 }

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
        bid: call.bid, ask: call.ask, iv: call.iv, bidIV: call.bidIV, askIV: call.askIV, markPrice: call.markPrice,
        delta: call.delta, gamma: call.gamma, theta: call.theta, vega: call.vega,
        volume: call.volume, oi: call.openInterest,
      } : EMPTY_SIDE,
      put: put ? {
        bid: put.bid, ask: put.ask, iv: put.iv, bidIV: put.bidIV, askIV: put.askIV, markPrice: put.markPrice,
        delta: put.delta, gamma: put.gamma, theta: put.theta, vega: put.vega,
        volume: put.volume, oi: put.openInterest,
      } : EMPTY_SIDE,
      isATM: Math.abs(strike - price) / price < 0.015,
    }
  }).filter(r => r.call.bid > 0 || r.put.bid > 0 || r.call.iv > 0 || r.put.iv > 0)
}


// ── Scrollable table ──────────────────────────────────────────────────

function ChainTable({ rows, side }: { rows: ChainRow[]; side: 'call' | 'put'; price: number }) {
  const cols = side === 'call' ? CALL_COLS : PUT_COLS
  const totalW = cols.reduce((s, c) => s + c.width, 0) + 64

  return (
    <div className="rounded-2xl border border-[#1e1e3f] overflow-auto max-h-[62svh]"
      style={{ WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth: totalW }}>
        {/* Header row — sticky top */}
        <div className="flex bg-[#0a0a18] border-b border-[#1e1e3f] sticky top-0 z-20">
          {/* Strike header — sticky left + top (corner freeze) */}
          <div style={{ width: 64, minWidth: 64 }}
            className="sticky left-0 z-30 px-2 py-2 text-center bg-indigo-950/60 border-r border-indigo-900/30">
            <div className="text-[10px] font-bold text-indigo-400">Strike</div>
            <div className="text-[9px] text-slate-600">price</div>
          </div>
          {cols.map(c => (
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
            {/* Strike cell — sticky left */}
            <div style={{ width: 64, minWidth: 64 }}
              className={`sticky left-0 z-10 px-2 py-2.5 text-center border-r border-indigo-900/20 ${
                row.isATM ? 'bg-indigo-950/60' : i % 2 === 0 ? 'bg-[#0a0a14]' : 'bg-[#0c0c1a]'
              }`}>
              <div className={`text-xs font-bold font-mono ${row.isATM ? 'text-indigo-300' : 'text-slate-200'}`}>
                {fmtPrice(row.strike)}
              </div>
              {row.isATM && (
                <div className="text-[9px] bg-indigo-600/40 text-indigo-300 rounded px-1 mt-0.5 inline-block">ATM</div>
              )}
            </div>
            {cols.map(c => (
              <div key={c.key} style={{ width: c.width, minWidth: c.width }} className="px-2 py-2.5 text-left text-xs">
                {c.render(row, side)}
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

const OPTIONS_ASSETS = new Set(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'])

const NO_OPTIONS_INFO: Record<string, { venue: string; url: string }> = {
  BNBUSDT:  { venue: 'Binance options not available for BNB', url: 'https://www.binance.com/en/options' },
  SOLUSDT:  { venue: 'Deribit lists SOL options',             url: 'https://www.deribit.com' },
  XRPUSDT:  { venue: 'No major venue lists XRP options yet',  url: '' },
  DOGEUSDT: { venue: 'No major venue lists DOGE options yet', url: '' },
}

function NoOptionsState({ symbol, price }: { symbol: string; price: number }) {
  const asset = symbol.replace('USDT', '')
  const info  = NO_OPTIONS_INFO[symbol]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] p-6 text-center space-y-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mx-auto text-2xl font-bold text-slate-500">
        {asset[0]}
      </div>
      <div>
        <p className="text-base font-bold text-white mb-1">{asset} Options</p>
        <p className="text-sm text-slate-400 leading-relaxed">
          Binance European Options only lists <span className="text-indigo-300 font-medium">BTC</span> and{' '}
          <span className="text-indigo-300 font-medium">ETH</span> contracts.
          {asset} does not have an options market on this exchange.
        </p>
      </div>

      <div className="rounded-xl bg-indigo-950/40 border border-indigo-800/30 p-3 text-left">
        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Live spot price</p>
        <p className="text-xl font-bold font-mono text-white">{fmtPrice(price)}</p>
        <p className="text-xs text-slate-500 mt-1">Source: Binance spot · refreshes every 30s</p>
      </div>

      {info?.venue && (
        <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-3 text-left">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Alternative venue</p>
          <p className="text-xs text-slate-300">{info.venue}</p>
          {info.url && (
            <a href={info.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block">
              Visit {info.url.replace('https://', '')} →
            </a>
          )}
        </div>
      )}
    </motion.div>
  )
}

export function OptionChainView({ selectedAsset }: Props) {
  const { data: liveAssets } = useQuery<LiveAsset[]>({ queryKey: ['binance-options'], enabled: false })

  const liveAsset = liveAssets?.find(a => a.symbol === selectedAsset)
  const mockAsset = ASSETS.find(a => a.symbol === selectedAsset) || ASSETS[0]
  const price     = liveAsset?.price || mockAsset.price
  const hasOptions = OPTIONS_ASSETS.has(selectedAsset)
  const isLive    = hasOptions && !!(liveAsset?.contracts?.length)

  const expiryDates = useMemo(() => {
    if (isLive) return liveAsset!.expiryDates.slice(0, 6)
    return []
  }, [isLive, liveAsset])

  const [expiry, setExpiry] = useState<string>('')
  const [side,   setSide]   = useState<'call' | 'put'>('call')

  const activeExpiry = expiry || expiryDates[0] || ''

  const chain: ChainRow[] = useMemo(() => {
    if (!isLive || !activeExpiry) return []
    return buildLiveChain(liveAsset!.contracts, activeExpiry, price)
  }, [isLive, liveAsset, activeExpiry, price])

  // ── No options available for this asset ─────────────────────────────
  if (!hasOptions) {
    return <NoOptionsState symbol={selectedAsset} price={price} />
  }

  // ── Options chain (BTC / ETH live) ────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
          isLive
            ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/30'
            : 'bg-indigo-900/50 text-indigo-400 border border-indigo-700/30'
        }`}>
          {isLive ? '● Live Binance Options' : '◌ Connecting…'} · {selectedAsset.replace('USDT', '')}
        </span>
        <span className="text-xs font-mono font-semibold text-indigo-300">{fmtPrice(price)}</span>
      </div>

      {/* Expiry pills */}
      {expiryDates.length > 0 && (
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
      )}

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
          { color: 'text-slate-400',   label: 'Γ' },
          { color: 'text-slate-400',   label: 'Vol/OI' },
        ].map(l => (
          <span key={l.label} className={`text-[10px] ${l.color}`}>{l.label}</span>
        ))}
        <span className="text-[10px] text-slate-600 ml-auto">← scroll →</span>
      </div>

      {/* Table or loading/empty */}
      <AnimatePresence mode="wait">
        {!isLive ? (
          <motion.div key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] py-12 text-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading live contracts…</p>
          </motion.div>
        ) : chain.length === 0 ? (
          <motion.div key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] py-10 text-center">
            <p className="text-sm text-slate-500">No contracts for this expiry</p>
          </motion.div>
        ) : (
          <motion.div key={side + activeExpiry}
            initial={{ opacity: 0, x: side === 'call' ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{    opacity: 0, x: side === 'call' ? 10 : -10 }}
            transition={{ duration: 0.16 }}>
            <ChainTable rows={chain} side={side} price={price} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
