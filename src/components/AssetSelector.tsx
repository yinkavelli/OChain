import { motion } from 'framer-motion'
import type { Asset } from '../data/mockData'

interface Props {
  assets: Asset[]
  selected: string
  onSelect: (symbol: string) => void
}

function fmtPrice(n: number) {
  if (n > 10000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n > 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

export function AssetSelector({ assets, selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {assets.map(a => (
        <motion.button
          key={a.symbol}
          onClick={() => onSelect(a.symbol)}
          whileTap={{ scale: 0.96 }}
          className={`flex-shrink-0 rounded-2xl px-3 py-2.5 text-left transition-all duration-200 ${
            selected === a.symbol
              ? 'bg-gradient-to-br from-indigo-600 to-violet-700 shadow-glow border border-indigo-500/50'
              : 'bg-[#0f0f1f] border border-[#1e1e3f] hover:border-indigo-800/60'
          }`}
        >
          <div className="text-xs font-bold text-white mb-0.5">{a.symbol.replace('USDT', '')}</div>
          <div className="text-[11px] font-mono text-slate-300">{fmtPrice(a.price)}</div>
          <div className={`text-[10px] font-medium mt-0.5 ${a.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {a.changePct >= 0 ? '+' : ''}{a.changePct.toFixed(2)}%
          </div>
        </motion.button>
      ))}
    </div>
  )
}
