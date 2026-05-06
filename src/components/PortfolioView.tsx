import { motion } from 'framer-motion'
import { LogIn, Clock, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '../hooks/useAuth'
import { useTrades, useCloseTrade } from '../hooks/useTrades'
import { usePnlHistory, usePnlSnapshotter, calcUnrealisedPnl } from '../hooks/usePnL'
import { LoginModal } from './LoginModal'
import { useState } from 'react'
import type { Trade } from '../lib/supabase'

interface Props {
  markPrices: Record<string, number>
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

export function PortfolioView({ markPrices }: Props) {
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
                  <OpenPositionCard key={t.id} trade={t} markPrices={markPrices} index={i}
                    onClose={closeTrade.mutate} />
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

function OpenPositionCard({ trade: t, markPrices, index, onClose }: {
  trade: Trade
  markPrices: Record<string, number>
  index: number
  onClose: (args: { id: string; exit_price: number }) => void
}) {
  const mark = markPrices[t.symbol]
  const pnl  = calcUnrealisedPnl(t, mark)
  const pct  = mark && t.entry_price > 0 ? ((mark - t.entry_price) / t.entry_price * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-2xl border p-4 ${pnl >= 0 ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-red-950/20 border-red-800/30'}`}>
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
      <button onClick={() => onClose({ id: t.id, exit_price: mark ?? t.entry_price })}
        className="w-full py-1.5 rounded-xl bg-slate-800 border border-slate-700/50 text-slate-400 text-[11px] font-medium hover:bg-slate-700 transition-colors">
        Close position
      </button>
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
