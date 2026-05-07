import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, Clock, TrendingUp, TrendingDown, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, ComposedChart } from 'recharts'
import { useAuth } from '../hooks/useAuth'
import { useTrades, useCloseTrade } from '../hooks/useTrades'
import { usePnlHistory, usePnlSnapshotter, calcUnrealisedPnl } from '../hooks/usePnL'
import { LoginModal } from './LoginModal'
import { useState } from 'react'
import type { Trade } from '../lib/supabase'
import { solveIV as solveIVFromMark } from '../lib/blackScholes'

interface Props {
  markPrices: Record<string, number>
  spotPrices: Record<string, number>
}

function fmtUsd(n: number) {
  if (isNaN(n) || n === 0) return '—'
  const abs = Math.abs(n)
  const str = abs > 1000
    ? `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${abs.toFixed(2)}`
  return n < 0 ? `-${str}` : str
}

function msToExpiry(ms: number) {
  const days = Math.round((ms - Date.now()) / 86_400_000)
  if (days <= 0) return 'Expired'
  return `${days}d`
}

function buildPayoff(trade: Trade, spotPrice: number) {
  const { strike_price: K, entry_price: premium, side, option_side, asset } = trade
  const mult = asset === 'BTC' ? 0.1 : 1
  const dir  = side === 'BUY' ? 1 : -1

  const low  = K * 0.7
  const high = K * 1.35
  const steps = 60
  const step = (high - low) / steps

  return Array.from({ length: steps + 1 }, (_, i) => {
    const S = low + i * step
    let intrinsic = 0
    if (option_side === 'CALL') intrinsic = Math.max(0, S - K)
    else                        intrinsic = Math.max(0, K - S)

    const atExpiry = (intrinsic - (dir === 1 ? premium : -premium)) * mult * trade.quantity * dir
    return {
      price: +S.toFixed(0),
      pnl:   +atExpiry.toFixed(2),
      isSpot: Math.abs(S - spotPrice) < step * 0.6,
    }
  })
}

function SignInPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-indigo-800/40 bg-indigo-950/20 p-6 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto">
        <LogIn className="w-6 h-6 text-indigo-400" />
      </div>
      <div>
        <p className="text-base font-bold text-white mb-1">Sign in to view your portfolio</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          Book simulated trades, track unrealised P&L, and see your equity curve over time.
        </p>
      </div>
      <button onClick={onLogin}
        className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold text-sm">
        Sign in with Google
      </button>
    </motion.div>
  )
}

export function PortfolioView({ markPrices, spotPrices }: Props) {
  const { user } = useAuth()
  const [showLogin, setLogin] = useState(false)
  const [tab, setTab] = useState<'open' | 'history'>('open')

  const { data: trades = [], isLoading } = useTrades(user?.id)
  const { data: pnlHistory = [] } = usePnlHistory(user?.id)
  const closeTrade = useCloseTrade()

  const openTrades   = trades.filter(t => t.status === 'OPEN')
  const closedTrades = trades.filter(t => t.status === 'CLOSED')

  usePnlSnapshotter(user?.id, openTrades, markPrices)

  const totalUnrealisedPnl = openTrades.reduce((sum, t) =>
    sum + calcUnrealisedPnl(t, markPrices[t.symbol]), 0)

  const totalRealisedPnl = closedTrades.reduce((sum, t) => {
    if (!t.exit_price) return sum
    const mult = t.asset === 'BTC' ? 0.1 : 1
    return sum + (t.exit_price - t.entry_price) * t.quantity * mult * (t.side === 'BUY' ? 1 : -1)
  }, 0)

  const chartData = pnlHistory.map(p => ({
    time: new Date(p.snapshot_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    pnl: +p.total_pnl.toFixed(2),
  }))

  return (
    <>
      {showLogin && <LoginModal onClose={() => setLogin(false)} />}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-0.5">Portfolio</h2>
            <p className="text-xs text-slate-500">Simulated trades & P&L</p>
          </div>
          {user && (
            <img src={user.user_metadata?.avatar_url} alt=""
              className="w-7 h-7 rounded-full border border-indigo-700/40" />
          )}
          {isLoading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
        </div>

        {!user ? (
          <SignInPrompt onLogin={() => setLogin(true)} />
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Unrealised P&L', value: fmtUsd(totalUnrealisedPnl), color: totalUnrealisedPnl >= 0 ? 'emerald' : 'red' },
                { label: 'Realised P&L',   value: fmtUsd(totalRealisedPnl),   color: totalRealisedPnl >= 0 ? 'emerald' : 'red' },
                { label: 'Open Positions', value: String(openTrades.length),   color: 'indigo' },
                { label: 'Closed Trades',  value: String(closedTrades.length), color: 'violet' },
              ].map((c, i) => (
                <motion.div key={c.label}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-2xl p-4 border ${
                    c.color === 'emerald' ? 'bg-emerald-950/30 border-emerald-800/30' :
                    c.color === 'red'     ? 'bg-red-950/30 border-red-800/30' :
                    c.color === 'violet'  ? 'bg-violet-950/30 border-violet-800/30' :
                    'bg-indigo-950/30 border-indigo-800/30'
                  }`}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{c.label}</p>
                  <p className={`text-lg font-bold font-mono ${
                    c.color === 'emerald' ? 'text-emerald-400' :
                    c.color === 'red'     ? 'text-red-400' :
                    c.color === 'violet'  ? 'text-violet-300' : 'text-indigo-300'
                  }`}>{c.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Equity curve */}
            {chartData.length > 1 && (
              <div className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] p-4">
                <p className="text-xs font-semibold text-slate-400 mb-3">Equity Curve</p>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={45} />
                    <Tooltip
                      contentStyle={{ background: '#0d0d20', border: '1px solid #1e1e3f', borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: '#94a3b8' }}
                      formatter={(v) => [`$${Number(v).toFixed(2)}`, 'P&L']}
                    />
                    <Area type="monotone" dataKey="pnl" stroke="#6366f1" strokeWidth={2} fill="url(#pnlGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabs */}
            <div className="flex bg-[#0d0d20] border border-[#1e1e3f] rounded-2xl p-1">
              {(['open', 'history'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                    tab === t ? 'bg-indigo-600 text-white' : 'text-slate-500'
                  }`}>
                  {t === 'open' ? `Open (${openTrades.length})` : `History (${closedTrades.length})`}
                </button>
              ))}
            </div>

            {tab === 'open' && (
              <div className="space-y-2">
                {openTrades.length === 0 ? (
                  <div className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] p-8 text-center text-sm text-slate-500">
                    No open positions — book a trade from the Screener
                  </div>
                ) : openTrades.map((t, i) => (
                  <OpenPositionCard key={t.id} trade={t} markPrices={markPrices}
                    spotPrice={spotPrices[t.asset] ?? 0} index={i} onClose={closeTrade.mutate} />
                ))}
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-2">
                {closedTrades.length === 0 ? (
                  <div className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] p-8 text-center text-sm text-slate-500">
                    No closed trades yet
                  </div>
                ) : closedTrades.map((t, i) => (
                  <ClosedTradeCard key={t.id} trade={t} index={i} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

function OpenPositionCard({ trade: t, markPrices, spotPrice, index, onClose }: {
  trade: Trade
  markPrices: Record<string, number>
  spotPrice: number
  index: number
  onClose: (args: { id: string; exit_price: number }) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const mark = markPrices[t.symbol]
  const pnl  = calcUnrealisedPnl(t, mark)
  const pct  = mark && t.entry_price > 0 ? ((mark - t.entry_price) / t.entry_price * 100) : 0
  const mult = t.asset === 'BTC' ? 0.1 : 1
  const dir  = t.side === 'BUY' ? 1 : -1

  // Per-leg P&L stats
  const maxProfit = t.option_side === 'CALL'
    ? (t.side === 'BUY' ? Infinity : t.entry_price * mult * t.quantity)
    : (t.side === 'BUY' ? (t.strike_price - t.entry_price) * mult * t.quantity : t.entry_price * mult * t.quantity)
  const maxLoss = t.option_side === 'CALL'
    ? (t.side === 'BUY' ? t.entry_price * mult * t.quantity : Infinity)
    : (t.side === 'BUY' ? t.entry_price * mult * t.quantity : Infinity)
  const breakeven = t.option_side === 'CALL'
    ? (t.side === 'BUY' ? t.strike_price + t.entry_price : t.strike_price - t.entry_price)
    : (t.side === 'BUY' ? t.strike_price - t.entry_price : t.strike_price + t.entry_price)

  const payoffData = buildPayoff(t, spotPrice)

  // Snap spot and strike to nearest data point for ReferenceLine
  const snapToData = (val: number) =>
    payoffData.reduce((best, d) => Math.abs(d.price - val) < Math.abs(best.price - val) ? d : best, payoffData[0])
  const spotSnap  = spotPrice > 0 ? snapToData(spotPrice).price : null
  const strikeSnap = snapToData(t.strike_price).price

  const livePnlPoint = spotPrice > 0 ? +(
    (t.option_side === 'CALL'
      ? Math.max(0, spotPrice - t.strike_price)
      : Math.max(0, t.strike_price - spotPrice)
    - (dir === 1 ? t.entry_price : -t.entry_price)) * mult * t.quantity * dir
  ).toFixed(2) : null

  // Expected move bands from IV — annualised vol scaled to DTE
  const dte = Math.max(1, Math.round((t.expiry_date - Date.now()) / 86_400_000))
  const markIV = mark ? solveIVFromMark(mark, spotPrice, t.strike_price, dte, t.option_side) : 0
  const oneSdMove  = spotPrice > 0 && markIV > 0 ? spotPrice * (markIV / 100) * Math.sqrt(dte / 365) : 0
  const twoSdMove  = oneSdMove * 2
  const sd1Lo = spotPrice - oneSdMove
  const sd1Hi = spotPrice + oneSdMove
  const sd2Lo = spotPrice - twoSdMove
  const sd2Hi = spotPrice + twoSdMove

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-2xl border ${pnl >= 0 ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-red-950/20 border-red-800/30'}`}>

      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono font-bold text-white">{t.symbol}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                t.option_side === 'CALL' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'
              }`}>{t.option_side}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                t.side === 'BUY' ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'
              }`}>{t.side}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <Clock className="w-2.5 h-2.5" />
              {msToExpiry(t.expiry_date)} · Strike ${Number(t.strike_price).toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className={`flex items-center gap-1 justify-end text-sm font-bold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {pnl >= 0 ? '+' : ''}{fmtUsd(pnl)}
            </div>
            <div className={`text-[10px] font-mono mt-0.5 ${pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[10px] mb-3">
          <div><span className="text-slate-600">Qty</span><div className="text-slate-300 font-mono">{t.quantity}</div></div>
          <div><span className="text-slate-600">Entry</span><div className="text-slate-300 font-mono">${Number(t.entry_price).toFixed(4)}</div></div>
          <div><span className="text-slate-600">Mark</span><div className="text-slate-300 font-mono">{mark ? `$${mark.toFixed(4)}` : '—'}</div></div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setExpanded(e => !e)}
            className="flex-1 py-1.5 rounded-xl bg-indigo-900/30 border border-indigo-700/30 text-indigo-400 text-[11px] font-medium hover:bg-indigo-900/50 transition-colors flex items-center justify-center gap-1">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Payoff diagram
          </button>
          <button onClick={() => onClose({ id: t.id, exit_price: mark ?? t.entry_price })}
            className="flex-1 py-1.5 rounded-xl bg-slate-800 border border-slate-700/50 text-slate-400 text-[11px] font-medium hover:bg-slate-700 transition-colors">
            Close position
          </button>
        </div>
      </div>

      {/* Expandable payoff diagram */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5">
            <div className="p-4 space-y-3">

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="rounded-xl bg-slate-800/60 p-2 text-center">
                  <div className="text-slate-500 mb-0.5">Max Profit</div>
                  <div className="text-emerald-400 font-mono font-bold">
                    {maxProfit === Infinity ? '∞' : fmtUsd(maxProfit)}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-800/60 p-2 text-center">
                  <div className="text-slate-500 mb-0.5">Max Loss</div>
                  <div className="text-red-400 font-mono font-bold">
                    {maxLoss === Infinity ? '∞' : fmtUsd(-maxLoss)}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-800/60 p-2 text-center">
                  <div className="text-slate-500 mb-0.5">Breakeven</div>
                  <div className="text-indigo-300 font-mono font-bold">${breakeven.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                </div>
              </div>

              {/* Payoff chart */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-500">At-expiry payoff · spot <span className="text-indigo-300 font-mono">${spotPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></p>
                  {oneSdMove > 0 && (
                    <div className="flex items-center gap-2 text-[9px] text-slate-500">
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-indigo-500/30 border border-indigo-500/50" />1-SD {(oneSdMove / spotPrice * 100).toFixed(1)}%</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-violet-500/20 border border-violet-500/30" />2-SD {(twoSdMove / spotPrice * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <ComposedChart data={payoffData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`payGrad-${t.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={pnl >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={pnl >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="price" tick={{ fontSize: 8, fill: '#64748b' }} tickLine={false} axisLine={false}
                      tickFormatter={v => `$${(v/1000).toFixed(0)}k`} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 8, fill: '#64748b' }} tickLine={false} axisLine={false}
                      tickFormatter={v => v >= 0 ? `+$${v}` : `-$${Math.abs(v)}`} width={44} />
                    <Tooltip
                      contentStyle={{ background: '#0d0d20', border: '1px solid #1e1e3f', borderRadius: 8, fontSize: 10 }}
                      formatter={(v) => { const n = Number(v); return [n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`, 'P&L at expiry'] }}
                      labelFormatter={v => `Spot $${Number(v).toLocaleString()}`}
                    />
                    {/* 2-SD expected move band (95% probability) */}
                    {twoSdMove > 0 && (
                      <ReferenceArea x1={+sd2Lo.toFixed(0)} x2={+sd2Hi.toFixed(0)}
                        fill="#7c3aed" fillOpacity={0.07} stroke="#7c3aed" strokeOpacity={0.2} strokeDasharray="3 3" />
                    )}
                    {/* 1-SD expected move band (68% probability) */}
                    {oneSdMove > 0 && (
                      <ReferenceArea x1={+sd1Lo.toFixed(0)} x2={+sd1Hi.toFixed(0)}
                        fill="#6366f1" fillOpacity={0.12} stroke="#6366f1" strokeOpacity={0.4} strokeDasharray="2 2" />
                    )}
                    {/* Zero line */}
                    <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
                    {/* Strike price */}
                    <ReferenceLine x={strikeSnap} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3"
                      label={{ value: 'Strike', position: 'insideTopLeft', fontSize: 8, fill: '#94a3b8', dy: -2 }} />
                    {/* Current spot price */}
                    {spotSnap && <ReferenceLine x={spotSnap} stroke="#6366f1" strokeWidth={2}
                      label={{ value: '▼ Spot', position: 'insideTopRight', fontSize: 8, fill: '#818cf8', dy: -2 }} />}
                    <Area type="monotone" dataKey="pnl" stroke={pnl >= 0 ? '#10b981' : '#ef4444'}
                      strokeWidth={2} fill={`url(#payGrad-${t.id})`}
                      dot={(props) => {
                        if (props.payload?.price !== spotSnap) return <g key={props.key} />
                        return (
                          <circle key={props.key} cx={props.cx} cy={props.cy} r={5}
                            fill="#6366f1" stroke="#fff" strokeWidth={1.5} />
                        )
                      }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Live P&L breakdown */}
              <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Live P&L breakdown</p>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">{t.side} {t.option_side} · {t.quantity} contract{t.quantity > 1 ? 's' : ''}</span>
                  <span className={`font-mono font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}{fmtUsd(pnl)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-600">Entry premium</span>
                  <span className="text-slate-400 font-mono">${t.entry_price.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-600">Current mark</span>
                  <span className="text-slate-400 font-mono">{mark ? `$${mark.toFixed(4)}` : '—'}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-600">P&L at expiry (if spot stays here)</span>
                  <span className={`font-mono ${(livePnlPoint ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {livePnlPoint !== null ? (livePnlPoint >= 0 ? `+$${livePnlPoint}` : `-$${Math.abs(livePnlPoint)}`) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ClosedTradeCard({ trade: t, index }: { trade: Trade; index: number }) {
  const mult        = t.asset === 'BTC' ? 0.1 : 1
  const realisedPnl = t.exit_price != null
    ? (t.exit_price - t.entry_price) * t.quantity * mult * (t.side === 'BUY' ? 1 : -1)
    : 0

  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-mono text-slate-300">{t.symbol}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
              t.option_side === 'CALL' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'
            }`}>{t.option_side}</span>
          </div>
          <div className="text-[10px] text-slate-500">
            {new Date(t.created_at).toLocaleDateString()} · {t.quantity} × ${Number(t.entry_price).toFixed(4)}
          </div>
        </div>
        <span className={`text-sm font-bold font-mono ${realisedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {realisedPnl >= 0 ? '+' : ''}{fmtUsd(realisedPnl)}
        </span>
      </div>
    </motion.div>
  )
}
