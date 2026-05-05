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
    if (s.type === 'Covered Call') {
      pnl = Math.min(s.legs[0].strike - price, spot - price) + s.legs[0].bid
    } else if (s.type === 'Bull Call Spread') {
      const longStrike = s.legs[0].strike
      const shortStrike = s.legs[1].strike
      const debit = s.netDebit
      pnl = Math.max(0, Math.min(shortStrike, spot) - longStrike) - debit
    } else if (s.type === 'Bear Put Spread') {
      const longStrike = s.legs[0].strike
      const shortStrike = s.legs[1].strike
      const debit = s.netDebit
      pnl = Math.max(0, longStrike - Math.max(shortStrike, spot)) - debit
    } else if (s.type === 'Long Straddle') {
      const strike = s.legs[0].strike
      const debit = s.netDebit
      pnl = Math.max(spot - strike, strike - spot) - debit
    } else if (s.type === 'Iron Condor') {
      const [bp, sp, sc, bc] = s.legs
      const putPL = spot < sp.strike ? -(Math.min(sp.strike - spot, sp.strike - bp.strike)) : 0
      const callPL = spot > sc.strike ? -(Math.min(spot - sc.strike, bc.strike - sc.strike)) : 0
      pnl = s.netPremium + putPL + callPL
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
    case 'Covered Call':
      return {
        why: `This Covered Call was selected because ${asset} is showing elevated Implied Volatility, making the short call premium rich relative to historical norms. By selling the ${fmtPrice(s.legs[0].strike)} call ${dte} days out, you collect ${fmtPrice(s.netPremium)} in immediate income while you hold the underlying — a ${((s.netPremium / price) * 100).toFixed(2)}% return on the position in ${dte} days if ${asset} stays below the strike.`,
        edge: [
          `Premium of ${fmtPrice(s.netPremium)} collected upfront — this is yours to keep regardless of outcome`,
          `${pop}% probability the call expires worthless and you keep the full premium`,
          `Breakeven is ${fmtPrice(beArr[0])} — you profit as long as ${asset} stays above this price`,
          `Theta (time decay) works in your favour every day the position is open`,
        ],
        risks: [
          `Upside is capped at ${fmtPrice(s.maxProfit)} — if ${asset} rallies hard past the strike, you miss gains`,
          `You still hold the underlying, so a sharp decline in ${asset} is the real risk`,
          `If IV drops sharply, you could buy the call back cheaper and roll, but premium shrinks`,
        ],
        ideal: `Ideal when you are neutral-to-moderately bullish on ${asset} and want to generate income. Best entered when IVR > 50 to ensure you're selling rich premium. Roll the call higher or out in time if ${asset} approaches the strike before expiry.`,
      }

    case 'Cash-Secured Put':
      return {
        why: `A Cash-Secured Put on ${asset} at the ${fmtPrice(s.legs[0].strike)} strike was surfaced because the put premium is inflated by elevated IV, and the strike sits ${((1 - s.legs[0].strike / price) * 100).toFixed(1)}% below current price — offering a built-in margin of safety. You're effectively getting paid ${fmtPrice(s.netPremium)} to agree to buy ${asset} at a discount.`,
        edge: [
          `Collect ${fmtPrice(s.netPremium)} immediately — your effective buy price if assigned is ${fmtPrice(s.breakeven as number)}`,
          `${pop}% chance the put expires worthless and you keep the full premium`,
          `Strike is ${((1 - s.legs[0].strike / price) * 100).toFixed(1)}% OTM — ${asset} must fall significantly before you take a loss`,
          `Defined max profit from day one`,
        ],
        risks: [
          `If ${asset} falls below ${fmtPrice(s.legs[0].strike)}, you are assigned and must buy at that price`,
          `Maximum loss is ${fmtPrice(s.maxLoss)} (strike minus premium) if ${asset} goes to zero`,
          `Capital must be held in reserve to cover potential assignment`,
        ],
        ideal: `Best used when you actually want to own ${asset} at a lower price and would be comfortable holding it. Enter when IVR is elevated (>50) for maximum premium. Have the collateral ready — treat it as a limit buy order that pays you while you wait.`,
      }

    case 'Bull Call Spread':
      return {
        why: `This Bull Call Spread targets a controlled upside move in ${asset} with strictly defined risk. The spread costs ${fmtPrice(s.netDebit)} (your max loss) and delivers up to ${fmtPrice(s.maxProfit)} profit — a ${rr.toFixed(2)}x return on risk — if ${asset} closes above ${fmtPrice(s.legs[1].strike)} at expiry in ${dte} days. It was selected because the current price is close to the long strike, giving a realistic path to full profit.`,
        edge: [
          `Max loss is strictly limited to the ${fmtPrice(s.netDebit)} debit paid — no surprises`,
          `${rr.toFixed(2)}x R/R: risk ${fmtPrice(s.netDebit)} to make ${fmtPrice(s.maxProfit)}`,
          `Less capital at risk than buying a naked call`,
          `The short call at ${fmtPrice(s.legs[1].strike)} partially offsets the cost of the long call`,
        ],
        risks: [
          `Full debit of ${fmtPrice(s.netDebit)} is lost if ${asset} closes at or below ${fmtPrice(s.legs[0].strike)} at expiry`,
          `Profit is capped at ${fmtPrice(s.maxProfit)} — a strong rally above ${fmtPrice(s.legs[1].strike)} won't help further`,
          `Time decay hurts the position if ${asset} doesn't move quickly enough`,
        ],
        ideal: `Enter when you expect ${asset} to move moderately higher over the next ${dte} days. You don't need a massive rally — just a move above ${fmtPrice(beArr[0])} to start profiting. Consider closing at 50–75% of max profit rather than holding to expiry.`,
      }

    case 'Bear Put Spread':
      return {
        why: `This Bear Put Spread profits if ${asset} declines moderately from its current ${fmtPrice(price)} level. Costing ${fmtPrice(s.netDebit)}, it pays up to ${fmtPrice(s.maxProfit)} if ${asset} falls below ${fmtPrice(s.legs[1].strike)} in ${dte} days — a ${rr.toFixed(2)}x return on risk. The spread structure caps both profit and loss, making it far more capital-efficient than a naked put for a directional bearish view.`,
        edge: [
          `Defined risk of ${fmtPrice(s.netDebit)} — worst case is clearly bounded`,
          `${rr.toFixed(2)}x R/R ratio on a moderately bearish outlook`,
          `The short put at ${fmtPrice(s.legs[1].strike)} lowers your cost basis vs buying a put outright`,
          `Breakeven at ${beStr} — only needs a modest decline to begin profiting`,
        ],
        risks: [
          `Full debit is lost if ${asset} stays at or above ${fmtPrice(s.legs[0].strike)}`,
          `Upside is capped — a catastrophic crash pays no more than ${fmtPrice(s.maxProfit)}`,
          `Needs ${asset} to move down within ${dte} days, so timing matters`,
        ],
        ideal: `Use when you have a moderately bearish thesis — a news catalyst, technical resistance, or macro headwind — rather than expecting a crash. Target closing at 50–75% of max profit. IV expansion after entry works in your favour; IV crush works against you.`,
      }

    case 'Long Straddle':
      return {
        why: `This Long Straddle on ${asset} was selected because it profits from a large move in either direction — perfect when a major catalyst is imminent but direction is uncertain. By buying the ATM call and put at ${fmtPrice(s.legs[0].strike)}, you need ${asset} to move more than ${fmtPrice(beArr[1] - s.legs[0].strike)} (${(((beArr[1] - s.legs[0].strike) / price) * 100).toFixed(1)}%) in either direction within ${dte} days to break even.`,
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

    case 'Iron Condor':
      return {
        why: `This Iron Condor collects ${fmtPrice(s.netPremium)} in premium by defining a profit zone where ${asset} needs to stay between ${beStr} over the next ${dte} days — a range of ${(((beArr[1] - beArr[0]) / price) * 100).toFixed(1)}% in either direction. It was selected because elevated IV is making both the short call and put premium rich, and a range-bound period is likely following recent volatility.`,
        edge: [
          `Collects ${fmtPrice(s.netPremium)} upfront — max profit if ${asset} stays in the tent`,
          `${pop}% probability of profit — the highest-probability structure available`,
          `Profits from IV crush — if IV drops after entry, you can close early for a profit`,
          `Four legs means risk is strictly bounded on both sides`,
        ],
        risks: [
          `Max loss of ${fmtPrice(s.maxLoss)} if ${asset} breaches either wing strike`,
          `A large directional move or IV spike post-entry is the main risk`,
          `Management is required if ${asset} tests one of the short strikes`,
        ],
        ideal: `Enter when IVR > 60 and you expect low volatility. Target closing at 50% of max profit to reduce time in the trade. If ${asset} moves toward one of the short strikes, consider rolling that side further out-of-the-money or widening the untested side for a credit.`,
      }

    default:
      return {
        why: `This ${s.type} strategy on ${asset} offers a ${pop}% probability of profit with a ${rr === 999 ? 'unlimited' : rr.toFixed(2) + 'x'} risk/reward ratio over the next ${dte} days.`,
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
