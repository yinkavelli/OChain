import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, CheckCircle2, Loader2, TrendingUp, TrendingDown, LogIn } from 'lucide-react'
import type { Strategy } from '../data/mockData'
import { useAuth } from '../hooks/useAuth'
import { useBookTrade } from '../hooks/useTrades'
import { LoginModal } from './LoginModal'

interface Props {
  strategy: Strategy | null
  onClose: () => void
}

function fmtP(n: number) {
  if (n > 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n > 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

type OrderStatus = 'idle' | 'confirm' | 'success' | 'error'

export function TradeModal({ strategy: s, onClose }: Props) {
  const [qty, setQty]           = useState('1')
  const [orderType, setType]    = useState<'LIMIT' | 'MARKET'>('LIMIT')
  const [status, setStatus]     = useState<OrderStatus>('idle')
  const [errorMsg, setError]    = useState('')
  const [showLogin, setLogin]   = useState(false)
  const { user }                = useAuth()
  const bookTrade               = useBookTrade()

  if (!s) return null

  const isBtcOrEth = s.symbol === 'BTCUSDT' || s.symbol === 'ETHUSDT'
  const qtyNum     = Math.max(0.01, parseFloat(qty) || 0)
  const asset      = s.symbol.replace('USDT', '')

  type LegDir = { symbol: string; side: 'BUY' | 'SELL'; price: number; label: string; optionSide: 'CALL' | 'PUT'; strike: number }
  function getLegs(): LegDir[] {
    return s!.legs.map((leg, i) => {
      let side: 'BUY' | 'SELL' = 'BUY'
      if (s!.type === 'Covered Call' || s!.type === 'Cash-Secured Put') side = 'SELL'
      else if (i === 1) side = 'SELL'
      else if (s!.type === 'Iron Condor' && (i === 1 || i === 2)) side = 'SELL'
      const mid = leg.bid > 0 && leg.ask > 0 ? (leg.bid + leg.ask) / 2 : leg.last
      return {
        symbol: leg.symbol,
        side,
        price: mid,
        label: `${side} ${leg.type} ${fmtP(leg.strike)}`,
        optionSide: leg.type as 'CALL' | 'PUT',
        strike: leg.strike,
      }
    })
  }

  const legs = getLegs()
  const totalCost = legs.reduce((sum, l) => {
    const legCost = l.price * qtyNum
    return l.side === 'BUY' ? sum + legCost : sum - legCost
  }, 0)

  async function submit() {
    if (!user) { setLogin(true); return }
    setStatus('confirm')
    setError('')
    try {
      for (const leg of legs) {
        await bookTrade.mutateAsync({
          user_id:     user.id,
          symbol:      leg.symbol,
          side:        leg.side,
          option_side: leg.optionSide,
          asset,
          quantity:    qtyNum,
          entry_price: leg.price,
          strike_price: leg.strike,
          expiry_date: s!.legs[0] ? Date.now() + 30 * 86_400_000 : Date.now(),
        })
      }
      setStatus('success')
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  return (
    <>
      {showLogin && <LoginModal onClose={() => setLogin(false)} />}
      <AnimatePresence>
        {s && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.94, y: 20  }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="fixed inset-x-3 bottom-4 top-auto z-[70] max-h-[88svh] overflow-y-auto rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.9)]"
              style={{ background: 'linear-gradient(160deg,#1a1a3e 0%,#0a0a18 100%)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-[1.5px] rounded-3xl"
                style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed,#4f46e5)' }}>
                <div className="rounded-3xl overflow-hidden"
                  style={{ background: 'linear-gradient(160deg,#1a1a3e 0%,#0a0a18 100%)' }}>
                  <div className="flex justify-center pt-3">
                    <div className="w-10 h-1 bg-slate-600 rounded-full" />
                  </div>
                  <div className="px-5 pt-3 pb-8">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-indigo-300 font-mono font-bold">{asset}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            s.sentiment === 'Bullish' ? 'bg-emerald-900/60 text-emerald-400' :
                            s.sentiment === 'Bearish' ? 'bg-red-900/60 text-red-400' :
                            'bg-indigo-900/60 text-indigo-400'
                          }`}>
                            {s.sentiment === 'Bullish'
                              ? <TrendingUp className="w-3 h-3 inline mr-0.5" />
                              : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
                            {s.sentiment}
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-white">{s.type}</h2>
                      </div>
                      <button onClick={onClose}
                        className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Success */}
                    {status === 'success' && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <div className="text-center py-4">
                          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                          <p className="text-lg font-bold text-white mb-1">Trade booked!</p>
                          <p className="text-xs text-slate-400">{legs.length} leg{legs.length > 1 ? 's' : ''} saved to your portfolio</p>
                        </div>
                        <button onClick={onClose}
                          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold mt-2">
                          Done
                        </button>
                      </motion.div>
                    )}

                    {/* Non-options asset */}
                    {status !== 'success' && !isBtcOrEth && (
                      <div className="rounded-2xl bg-amber-950/40 border border-amber-800/30 p-4 text-center mb-4">
                        <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-white mb-1">Simulated strategy</p>
                        <p className="text-xs text-slate-400">
                          {asset} options aren't listed on Binance. This is a reference setup only.
                        </p>
                      </div>
                    )}

                    {/* Main form */}
                    {status !== 'success' && isBtcOrEth && (
                      <div className="space-y-4">
                        {/* Sign-in nudge */}
                        {!user && (
                          <div className="rounded-2xl bg-indigo-950/50 border border-indigo-800/40 p-3 flex items-center gap-3">
                            <LogIn className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            <p className="text-xs text-slate-400 flex-1">Sign in to save trades and track P&L</p>
                            <button onClick={() => setLogin(true)}
                              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap">
                              Sign in →
                            </button>
                          </div>
                        )}

                        {/* Legs */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Order legs</p>
                          {legs.map((leg, i) => (
                            <div key={i} className={`rounded-xl border p-3 flex items-center justify-between ${
                              leg.side === 'BUY' ? 'bg-emerald-950/30 border-emerald-800/30' : 'bg-red-950/30 border-red-800/30'
                            }`}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    leg.side === 'BUY' ? 'bg-emerald-700/60 text-emerald-300' : 'bg-red-700/60 text-red-300'
                                  }`}>{leg.side}</span>
                                  <span className="text-xs text-slate-300 font-mono">{leg.symbol}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">{leg.label}</p>
                              </div>
                              <span className="text-sm font-mono font-bold text-white">{fmtP(leg.price)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Qty + type */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Contracts</label>
                            <input type="number" min="0.01" step="0.01" value={qty}
                              onChange={e => setQty(e.target.value)}
                              className="w-full bg-[#0d0d20] border border-[#1e1e3f] rounded-xl px-3 py-2.5 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none" />
                            <p className="text-[9px] text-slate-600 mt-1">1 contract = 0.1 BTC / 1 ETH</p>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Order type</label>
                            <div className="flex bg-[#0d0d20] border border-[#1e1e3f] rounded-xl p-1">
                              {(['LIMIT','MARKET'] as const).map(t => (
                                <button key={t} onClick={() => setType(t)}
                                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                                    orderType === t ? 'bg-indigo-600 text-white' : 'text-slate-500'
                                  }`}>{t}</button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Cost summary */}
                        <div className="rounded-xl bg-indigo-950/40 border border-indigo-800/30 p-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">Est. {totalCost >= 0 ? 'debit' : 'credit'}</span>
                            <span className={`font-mono font-bold ${totalCost >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {fmtP(Math.abs(totalCost))}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Max profit</span>
                            <span className="text-emerald-400 font-mono">{s.maxProfit === Infinity ? '∞' : fmtP(s.maxProfit)}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-slate-500">Max loss</span>
                            <span className="text-red-400 font-mono">{s.maxLoss === Infinity ? '∞' : fmtP(s.maxLoss)}</span>
                          </div>
                        </div>

                        <div className="rounded-xl bg-amber-950/30 border border-amber-800/20 px-3 py-2 flex gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-[10px] text-amber-600 leading-relaxed">
                            Simulated trade — no real orders are placed. P&L tracks mark-to-market in your portfolio.
                          </p>
                        </div>

                        {status === 'error' && (
                          <div className="rounded-xl bg-red-950/40 border border-red-800/30 px-3 py-2 text-xs text-red-300">{errorMsg}</div>
                        )}

                        {status !== 'confirm' ? (
                          <button onClick={() => user ? setStatus('confirm') : setLogin(true)}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-base shadow-glow hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-95">
                            {user ? 'Review trade →' : 'Sign in to book trade →'}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-center text-xs text-slate-400">
                              Book {legs.length} leg{legs.length > 1 ? 's' : ''} × {qtyNum} contracts
                            </p>
                            <button onClick={submit} disabled={bookTrade.isPending}
                              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold text-base transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                              {bookTrade.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</> : 'Confirm & Book'}
                            </button>
                            <button onClick={() => setStatus('idle')}
                              className="w-full py-3 rounded-2xl bg-slate-800 text-slate-300 text-sm font-medium">
                              Back
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
