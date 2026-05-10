import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, TrendingUp, TrendingDown, Minus, Lightbulb, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Strategy } from '../data/mockData'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TradeModal } from './TradeModal'
import { hasCredentials } from '../lib/binanceAuth'

interface Props {
  strategy: Strategy | null
  onClose: () => void
}

function buildPayoffData(s: Strategy) {
  const price = s.underlyingPrice
  const points = 30
  const lo = price * 0.8
  const hi = price * 1.2
  const step = (hi - lo) / points
  const data = []
  for (let i = 0; i <= points; i++) {
    const spot = lo + i * step
    let pnl = 0
    if (s.type === 'Long Call') {
      pnl = Math.max(0, spot - s.legs[0].strike) - s.netDebit
    } else if (s.type === 'Long Put') {
      pnl = Math.max(0, s.legs[0].strike - spot) - s.netDebit
    } else if (s.type === 'Long Straddle') {
      const strike = s.legs[0].strike
      pnl = Math.max(spot - strike, strike - spot) - s.netDebit
    } else if (s.type === 'Long Strangle') {
      pnl = Math.max(0, spot - s.legs[0].strike) + Math.max(0, s.legs[1].strike - spot) - s.netDebit
    }
    data.push({ spot: +spot.toFixed(2), pnl: +pnl.toFixed(4) })
  }
  return data
}

function fmtPrice(n: number) {
  if (n > 10000) return `$${(n/1000).toFixed(1)}k`
  if (n > 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n > 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

interface Rationale {
  why: string
  edge: string[]
  risks: string[]
  ideal: string
}

function buildRationale(s: Strategy): Rationale {
  const asset   = s.symbol.replace('USDT', '')
  const dte     = s.daysToExpiry
  const pop     = s.probabilityOfProfit
  const rr      = s.riskRewardRatio
  const price   = s.underlyingPrice
  const beArr = Array.isArray(s.breakeven) ? s.breakeven : [s.breakeven]
  const beStr = beArr.map(b => fmtPrice(b)).join(' / ')

  switch (s.type) {
    case 'Long Call':
      return {
        why: `This Long Call on ${asset} gives you unlimited upside if ${asset} rallies above the breakeven at ${fmtPrice(beArr[0])} — a move of ${(((beArr[0] - price) / price) * 100).toFixed(1)}% from the current price. You pay ${fmtPrice(s.netDebit)} upfront: that is your total maximum loss, no matter what happens. The delta of ${s.legs[0].delta.toFixed(2)} means the option gains approximately ${(s.legs[0].delta * 100).toFixed(0)}¢ for every $1 ${asset} rises right now, and accelerates as the option moves further in-the-money.`,
        edge: [
          `Unlimited profit potential — every dollar above ${fmtPrice(beArr[0])} is pure gain`,
          `Risk is strictly capped at the ${fmtPrice(s.netDebit)} premium paid — nothing more`,
          `Delta of ${s.legs[0].delta.toFixed(2)}: gains ~${(s.legs[0].delta * 100).toFixed(0)}¢ per $1 rise in ${asset}`,
          `${pop}% probability of finishing in-the-money at expiry`,
        ],
        risks: [
          `Full debit of ${fmtPrice(s.netDebit)} is lost if ${asset} stays at or below ${fmtPrice(s.legs[0].strike)} at expiry`,
          `Theta decay works against you every day — the option loses time value even if price is flat`,
          `IV crush after a catalyst can reduce option value even if ${asset} moves higher`,
        ],
        ideal: `Enter when you expect ${asset} to make a strong directional move higher within ${dte} days. Consider taking partial profits at 50–100% gain on the option rather than holding to expiry. If ${asset} moves quickly in your direction, close early to lock in gains and sidestep accelerating theta.`,
      }

    case 'Long Put':
      return {
        why: `This Long Put on ${asset} profits if the price falls below the breakeven at ${fmtPrice(beArr[0])}. You pay ${fmtPrice(s.netDebit)} — your maximum loss — and in return you hold the right to profit on every dollar ${asset} falls below ${fmtPrice(s.legs[0].strike)}. If ${asset} were to fall to zero, the theoretical maximum profit would be ${fmtPrice(s.maxProfit)}. The delta of ${s.legs[0].delta.toFixed(2)} means the option gains approximately ${(Math.abs(s.legs[0].delta) * 100).toFixed(0)}¢ for every $1 ${asset} drops right now.`,
        edge: [
          `Defined max loss of ${fmtPrice(s.netDebit)} — risk is fully bounded from the moment you enter`,
          `Substantial profit potential if ${asset} falls — theoretical max ${fmtPrice(s.maxProfit)}`,
          `Delta of ${s.legs[0].delta.toFixed(2)}: gains ~${(Math.abs(s.legs[0].delta) * 100).toFixed(0)}¢ per $1 drop in ${asset}`,
          `${pop}% probability of finishing in-the-money at expiry`,
        ],
        risks: [
          `Full premium of ${fmtPrice(s.netDebit)} is lost if ${asset} stays at or above ${fmtPrice(s.legs[0].strike)} at expiry`,
          `Theta decay works against you every day — position loses time value without a move`,
          `A sharp reversal higher after entry quickly erodes option value`,
        ],
        ideal: `Use when you have a bearish thesis on ${asset} — a technical breakdown, negative catalyst, or macro headwind. Consider closing at 50–100% profit rather than holding to expiry. If ${asset} makes a sharp quick drop, close early and capture gains before time decay accelerates.`,
      }

    case 'Long Straddle':
      return {
        why: `This Long Straddle on ${asset} profits from a large move in either direction — ideal when a major catalyst is imminent but direction is uncertain. By buying the ATM call and put at ${fmtPrice(s.legs[0].strike)}, you need ${asset} to move more than ${fmtPrice(beArr[1] - s.legs[0].strike)} (${(((beArr[1] - s.legs[0].strike) / price) * 100).toFixed(1)}%) in either direction within ${dte} days to break even. Both legs are long — there is no short position, making this fully compatible with buy-only accounts.`,
        edge: [
          `Profits from ANY large move — up or down`,
          `Unlimited profit potential in either direction`,
          `No directional bias needed — pure volatility play`,
          `Ideal ahead of major events: protocol upgrades, regulatory decisions, macro data`,
        ],
        risks: [
          `Costs ${fmtPrice(s.netDebit)} upfront — you lose this if ${asset} stays flat`,
          `Theta decay is aggressive — the position loses value every day without a move`,
          `Needs ${asset} to move beyond ${beStr} to profit — a moderate move isn't enough`,
          `IV crush after a catalyst can hurt even if price moves`,
        ],
        ideal: `Enter 1–2 weeks before a known catalyst and close shortly after the event, before theta decay becomes dominant. Avoid holding through expiry unless you have high conviction on a sustained large move. Consider closing one leg and letting the other run if ${asset} moves strongly in one direction.`,
      }

    case 'Long Strangle':
      return {
        why: `This Long Strangle buys an OTM call at ${fmtPrice(s.legs[0].strike)} and an OTM put at ${fmtPrice(s.legs[1].strike)} for a total cost of ${fmtPrice(s.netDebit)} — significantly cheaper than an ATM straddle. It profits from a large move in either direction, needing ${asset} to breach ${fmtPrice(beArr[0])} on the downside or ${fmtPrice(beArr[1])} on the upside within ${dte} days. Both legs are long — no short selling required.`,
        edge: [
          `Cheaper than a straddle — lower upfront cost with similar unlimited upside exposure`,
          `Profits from any large move in either direction — no directional bias needed`,
          `Lower cost means higher percentage returns on a big move`,
          `Unlimited profit potential once either breakeven is breached`,
        ],
        risks: [
          `Needs a larger move than a straddle — both wings are OTM, so the breakevens are wider`,
          `Full debit of ${fmtPrice(s.netDebit)} is lost if ${asset} stays between ${beStr} at expiry`,
          `Theta decay is aggressive — loses value daily without a move`,
          `IV crush after an event can hurt even if price moves only modestly`,
        ],
        ideal: `Best used ahead of high-impact events when you expect a large move but aren't sure of direction. The OTM structure makes it cheaper than a straddle but requires a bigger move to profit. Close one leg when ${asset} makes a decisive move and let the other run, or close both after the catalyst to avoid IV crush.`,
      }

    default:
      return {
        why: `This ${s.type} strategy on ${asset} offers a ${pop}% probability of profit with ${rr === 999 ? 'unlimited' : rr.toFixed(2) + 'x'} risk/reward over the next ${dte} days.`,
        edge: [`${pop}% probability of profit`, `Breakeven at ${beStr}`],
        risks: [`Max loss: ${s.maxLoss === Infinity ? 'unlimited' : fmtPrice(s.maxLoss)}`],
        ideal: `Review the payoff diagram to understand the full range of outcomes before entering.`,
      }
  }
}

export function StrategyDrawer({ strategy: s, onClose }: Props) {
  const [tradeOpen, setTradeOpen] = useState(false)
  const payoff = s ? buildPayoffData(s) : []
  const hasPositive = payoff.some(d => d.pnl > 0)
  const hasCreds = hasCredentials()
  const isTradeable = s && (s.symbol === 'BTCUSDT' || s.symbol === 'ETHUSDT')

  return (
    <>
    <AnimatePresence>
      {s && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90svh] overflow-y-auto"
            style={{ background: 'linear-gradient(180deg, #13132a 0%, #0a0a14 100%)' }}
          >
            <div className="rounded-t-3xl border border-[#1e1e3f] border-b-0">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-slate-600 rounded-full" />
              </div>

              <div className="px-4 pt-2 pb-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-indigo-300 font-bold font-mono text-lg">
                        {s.symbol.replace('USDT', '')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.sentiment === 'Bullish' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50' :
                        s.sentiment === 'Bearish' ? 'bg-red-900/50 text-red-400 border border-red-700/50' :
                        'bg-indigo-900/50 text-indigo-400 border border-indigo-700/50'
                      }`}>
                        {s.sentiment === 'Bullish' ? <TrendingUp className="w-3 h-3 inline mr-1" /> :
                         s.sentiment === 'Bearish' ? <TrendingDown className="w-3 h-3 inline mr-1" /> :
                         <Minus className="w-3 h-3 inline mr-1" />}
                        {s.sentiment}
                      </span>
                    </div>
                    <h2 className="text-white font-bold text-xl">{s.type}</h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: 'Max Profit', value: s.maxProfit === Infinity ? '∞' : fmtPrice(s.maxProfit), color: 'emerald' },
                    { label: 'Max Loss', value: s.maxLoss === Infinity ? '∞' : fmtPrice(s.maxLoss), color: 'red' },
                    { label: 'Prob. of Profit', value: `${s.probabilityOfProfit}%`, color: 'indigo' },
                    { label: 'Risk/Reward', value: s.riskRewardRatio === 999 ? '∞' : `${s.riskRewardRatio}x`, color: 'violet' },
                  ].map(m => (
                    <div key={m.label} className={`rounded-xl p-3 ${
                      m.color === 'emerald' ? 'bg-emerald-950/50 border border-emerald-800/30' :
                      m.color === 'red' ? 'bg-red-950/50 border border-red-800/30' :
                      m.color === 'indigo' ? 'bg-indigo-950/50 border border-indigo-800/30' :
                      'bg-violet-950/50 border border-violet-800/30'
                    }`}>
                      <div className="text-[11px] text-slate-500 mb-1">{m.label}</div>
                      <div className={`text-lg font-bold font-mono ${
                        m.color === 'emerald' ? 'text-emerald-400' :
                        m.color === 'red' ? 'text-red-400' :
                        m.color === 'indigo' ? 'text-indigo-300' : 'text-violet-300'
                      }`}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Payoff Chart */}
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Payoff Diagram</h3>
                  <div className="bg-[#0d0d20] rounded-2xl border border-[#1e1e3f] p-3">
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={payoff} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="payoffPos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="payoffNeg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="spot" hide />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ background: '#13132a', border: '1px solid #1e1e3f', borderRadius: 8, fontSize: 11 }}
                          formatter={(v) => { const n = Number(v); return [n > 0 ? `+${fmtPrice(n)}` : fmtPrice(n), 'P&L'] }}
                          labelFormatter={(l) => `Price: ${fmtPrice(Number(l))}`}
                        />
                        <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
                        <ReferenceLine x={s.underlyingPrice} stroke="#6366f1" strokeDasharray="3 3" />
                        <Area
                          type="monotone"
                          dataKey="pnl"
                          stroke={hasPositive ? '#10b981' : '#ef4444'}
                          fill={hasPositive ? 'url(#payoffPos)' : 'url(#payoffNeg)'}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Legs Table */}
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Option Legs</h3>
                  <div className="space-y-2">
                    {s.legs.map((leg, i) => (
                      <div key={i} className="bg-[#0d0d20] rounded-xl border border-[#1e1e3f] p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              leg.type === 'CALL' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
                            }`}>{leg.type}</span>
                            <span className="text-white font-mono font-medium">{fmtPrice(leg.strike)}</span>
                            <ChevronRight className="w-3 h-3 text-slate-600" />
                            <span className="text-slate-400 text-xs">{leg.expiry}</span>
                          </div>
                          <span className="text-indigo-300 font-mono text-sm">IV {leg.iv.toFixed(1)}%</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div><span className="text-slate-500">Bid</span><div className="text-slate-300 font-mono">{fmtPrice(leg.bid)}</div></div>
                          <div><span className="text-slate-500">Ask</span><div className="text-slate-300 font-mono">{fmtPrice(leg.ask)}</div></div>
                          <div><span className="text-slate-500">Δ Delta</span><div className="text-slate-300 font-mono">{leg.delta.toFixed(3)}</div></div>
                          <div><span className="text-slate-500">θ Theta</span><div className="text-slate-300 font-mono">{leg.theta.toFixed(2)}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strategy Rationale */}
                {(() => {
                  const r = buildRationale(s)
                  return (
                    <div className="mb-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-semibold text-slate-300">Why this strategy?</h3>
                      </div>

                      {/* Why card */}
                      <div className="rounded-2xl border border-amber-800/30 bg-amber-950/20 p-4">
                        <p className="text-xs text-slate-300 leading-relaxed">{r.why}</p>
                      </div>

                      {/* Edge & Risks side-by-side */}
                      <div className="grid grid-cols-1 gap-3">
                        <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/20 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide">Your Edge</span>
                          </div>
                          <ul className="space-y-1.5">
                            {r.edge.map((e, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                <span className="text-emerald-500 mt-0.5 flex-shrink-0">›</span>
                                {e}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-xl border border-red-800/30 bg-red-950/20 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wide">Key Risks</span>
                          </div>
                          <ul className="space-y-1.5">
                            {r.risks.map((risk, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                <span className="text-red-500 mt-0.5 flex-shrink-0">›</span>
                                {risk}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Ideal conditions */}
                      <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/20 p-3">
                        <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide mb-1.5">Ideal Conditions & Management</p>
                        <p className="text-xs text-slate-300 leading-relaxed">{r.ideal}</p>
                      </div>
                    </div>
                  )
                })()}

                {/* CTA */}
                <button
                  onClick={() => setTradeOpen(true)}
                  className={`w-full py-4 rounded-2xl font-semibold text-base transition-all active:scale-95 ${
                    isTradeable && hasCreds
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow hover:from-indigo-500 hover:to-violet-500'
                      : isTradeable
                      ? 'bg-gradient-to-r from-indigo-700/60 to-violet-700/60 text-indigo-200 border border-indigo-600/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700/40'
                  }`}>
                  {isTradeable && hasCreds
                    ? 'Trade this strategy →'
                    : isTradeable
                    ? 'Connect API key to trade →'
                    : 'View on Binance →'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    <TradeModal strategy={tradeOpen ? s : null} onClose={() => setTradeOpen(false)} />
    </>
  )
}
