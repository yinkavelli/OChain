import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Target, Shield, Zap } from 'lucide-react'
import type { Strategy } from '../data/mockData'

const BADGE_CLASS: Record<string, string> = {
  'Covered Call': 'strategy-badge-covered-call',
  'Bull Call Spread': 'strategy-badge-bull-spread',
  'Bear Put Spread': 'strategy-badge-bear-spread',
  'Long Straddle': 'strategy-badge-straddle',
  'Iron Condor': 'strategy-badge-iron-condor',
  'Cash-Secured Put': 'strategy-badge-covered-call',
  'Protective Put': 'strategy-badge-bear-spread',
}

const SENTIMENT_ICON = {
  Bullish: <TrendingUp className="w-3 h-3" />,
  Bearish: <TrendingDown className="w-3 h-3" />,
  Neutral: <Minus className="w-3 h-3" />,
}

const SENTIMENT_COLOR = {
  Bullish: 'text-emerald-400',
  Bearish: 'text-red-400',
  Neutral: 'text-indigo-400',
}

function formatPrice(n: number, symbol: string) {
  if (symbol.includes('BTC')) return n > 1000 ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `$${n.toFixed(2)}`
  if (n > 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n > 100) return `$${n.toFixed(1)}`
  if (n > 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

function ScoreRing({ score }: { score: number }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 75 ? '#10b981' : score >= 60 ? '#6366f1' : '#f59e0b'

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="48" height="48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#1e1e3f" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-xs font-bold text-white">{score}</span>
    </div>
  )
}

interface Props {
  strategy: Strategy
  index: number
  onClick: () => void
}

export function StrategyCard({ strategy: s, index, onClick }: Props) {
  const isDebit = s.netDebit > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      whileHover={{ scale: 1.01, boxShadow: '0 0 24px rgba(99,102,241,0.2)' }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="gradient-card rounded-2xl p-4 cursor-pointer shadow-card relative overflow-hidden"
    >
      <div className="absolute inset-0 shimmer pointer-events-none" />
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-500/20 rounded-xl px-2 py-1">
              <span className="text-indigo-300 font-bold text-sm font-mono">
                {s.symbol.replace('USDT', '')}
              </span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BADGE_CLASS[s.type]}`}>
              {s.type}
            </span>
          </div>
          <ScoreRing score={s.score} />
        </div>

        {/* Sentiment & Expiry */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`flex items-center gap-1 text-xs font-medium ${SENTIMENT_COLOR[s.sentiment]}`}>
            {SENTIMENT_ICON[s.sentiment]}
            {s.sentiment}
          </div>
          <div className="text-xs text-slate-500">
            {s.daysToExpiry}d · {s.expiry}
          </div>
        </div>

        {/* P&L Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-xl p-2.5">
            <div className="text-[10px] text-emerald-600 font-medium mb-1 flex items-center gap-1">
              <Target className="w-2.5 h-2.5" /> Max Profit
            </div>
            <div className="text-emerald-400 font-bold text-sm">
              {s.maxProfit === Infinity ? '∞' : formatPrice(s.maxProfit, s.symbol)}
            </div>
          </div>
          <div className="bg-red-950/40 border border-red-800/30 rounded-xl p-2.5">
            <div className="text-[10px] text-red-600 font-medium mb-1 flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" /> Max Loss
            </div>
            <div className="text-red-400 font-bold text-sm">
              {s.maxLoss === Infinity ? '∞' : formatPrice(s.maxLoss, s.symbol)}
            </div>
          </div>
          <div className="bg-indigo-950/40 border border-indigo-800/30 rounded-xl p-2.5">
            <div className="text-[10px] text-indigo-500 font-medium mb-1 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> PoP
            </div>
            <div className="text-indigo-300 font-bold text-sm">{s.probabilityOfProfit}%</div>
          </div>
        </div>

        {/* Details Row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-500">
              {isDebit ? 'Debit' : 'Credit'}{' '}
              <span className={isDebit ? 'text-amber-400 font-mono' : 'text-emerald-400 font-mono'}>
                {isDebit ? formatPrice(s.netDebit, s.symbol) : formatPrice(s.netPremium, s.symbol)}
              </span>
            </span>
            <span className="text-slate-500">
              R/R{' '}
              <span className="text-slate-300 font-mono">
                {s.riskRewardRatio === 999 ? '∞' : s.riskRewardRatio.toFixed(2)}x
              </span>
            </span>
          </div>
          <div className="flex gap-1">
            {s.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] bg-slate-800/60 text-slate-400 px-1.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
