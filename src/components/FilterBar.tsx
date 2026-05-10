import { motion } from 'framer-motion'
import type { StrategyType } from '../data/mockData'

const STRATEGIES: Array<StrategyType | 'All'> = [
  'All', 'Long Call', 'Long Put', 'Long Straddle', 'Long Strangle',
]

const SENTIMENTS = ['All', 'Bullish', 'Bearish', 'Neutral']

interface Props {
  strategy: StrategyType | 'All'
  sentiment: string
  onStrategy: (s: StrategyType | 'All') => void
  onSentiment: (s: string) => void
}

export function FilterBar({ strategy, sentiment, onStrategy, onSentiment }: Props) {
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {STRATEGIES.map(s => (
          <motion.button
            key={s}
            whileTap={{ scale: 0.95 }}
            onClick={() => onStrategy(s as StrategyType | 'All')}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-150 ${
              strategy === s
                ? 'tab-active text-white'
                : 'bg-[#1a1a3a] text-slate-400 border border-[#1e1e3f] hover:text-white'
            }`}
          >
            {s}
          </motion.button>
        ))}
      </div>
      <div className="flex gap-2">
        {SENTIMENTS.map(s => (
          <motion.button
            key={s}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSentiment(s)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-150 ${
              sentiment === s
                ? s === 'Bullish' ? 'bg-emerald-600 text-white' :
                  s === 'Bearish' ? 'bg-red-700 text-white' :
                  s === 'Neutral' ? 'bg-indigo-600 text-white' :
                  'tab-active text-white'
                : 'bg-[#1a1a3a] text-slate-400 border border-[#1e1e3f]'
            }`}
          >
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
