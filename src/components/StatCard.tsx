import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { InfoCard } from './InfoCard'
import type { InfoDef } from './InfoCard'

interface Props {
  label: string
  value: string | number
  sub?: string
  icon: ReactNode
  color?: string
  delay?: number
  trend?: 'up' | 'down' | 'neutral'
  tooltip?: InfoDef
}

export function StatCard({ label, value, sub, icon, color = 'indigo', delay = 0, trend, tooltip }: Props) {
  const [open, setOpen] = useState(false)

  const colorMap: Record<string, string> = {
    indigo:  'from-indigo-900/40 to-indigo-950/20 border-indigo-800/50',
    emerald: 'from-emerald-900/40 to-emerald-950/20 border-emerald-800/50',
    violet:  'from-violet-900/40 to-violet-950/20 border-violet-800/50',
    amber:   'from-amber-900/40 to-amber-950/20 border-amber-800/50',
    red:     'from-red-900/40 to-red-950/20 border-red-800/50',
  }
  const iconBg: Record<string, string> = {
    indigo:  'bg-indigo-500/20 text-indigo-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    violet:  'bg-violet-500/20 text-violet-400',
    amber:   'bg-amber-500/20 text-amber-400',
    red:     'bg-red-500/20 text-red-400',
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay }}
        whileTap={tooltip ? { scale: 0.97 } : {}}
        onClick={tooltip ? () => setOpen(true) : undefined}
        className={`rounded-2xl border bg-gradient-to-br p-4 shadow-card ${colorMap[color]} relative overflow-hidden ${
          tooltip ? 'cursor-pointer' : ''
        }`}
      >
        <div className="shimmer absolute inset-0 pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</span>
              {tooltip && (
                <span className="text-[9px] text-indigo-500/70 font-medium">tap</span>
              )}
            </div>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${iconBg[color]}`}>
              {icon}
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{value}</div>
          {sub && (
            <div className={`text-xs font-medium ${
              trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'
            }`}>
              {sub}
            </div>
          )}
        </div>
      </motion.div>

      {tooltip && (
        <InfoCard
          open={open}
          onClose={() => setOpen(false)}
          {...tooltip}
        />
      )}
    </>
  )
}
