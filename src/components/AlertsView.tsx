import { motion } from 'framer-motion'
import { Bell, TrendingUp, TrendingDown, Zap, Plus } from 'lucide-react'

const ALERTS = [
  { id: 1, symbol: 'BTC', type: 'IV Spike', message: 'IV jumped to 78.2%, up 15% from 24h low', time: '2m ago', severity: 'high', icon: Zap },
  { id: 2, symbol: 'ETH', type: 'High PoP Setup', message: 'Iron Condor with 82% PoP detected on Jun expiry', time: '8m ago', severity: 'medium', icon: TrendingUp },
  { id: 3, symbol: 'SOL', type: 'IV Rank Alert', message: 'IV Rank hit 85 — potential premium selling opportunity', time: '14m ago', severity: 'high', icon: Bell },
  { id: 4, symbol: 'BNB', type: 'Spread Opportunity', message: 'Bull call spread with 2.4x R/R detected', time: '22m ago', severity: 'low', icon: TrendingUp },
  { id: 5, symbol: 'XRP', type: 'IV Crush Risk', message: 'Earnings-like event may compress IV post-announcement', time: '1h ago', severity: 'medium', icon: TrendingDown },
]

const SEV_STYLE: Record<string, string> = {
  high: 'bg-red-950/50 border-red-800/40 text-red-300',
  medium: 'bg-amber-950/50 border-amber-800/40 text-amber-300',
  low: 'bg-emerald-950/50 border-emerald-800/40 text-emerald-300',
}

export function AlertsView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Smart Alerts</h2>
          <p className="text-xs text-slate-500">AI-detected opportunities & risk signals</p>
        </div>
        <button className="flex items-center gap-1.5 text-xs bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-xl">
          <Plus className="w-3 h-3" /> New Alert
        </button>
      </div>

      <div className="space-y-3">
        {ALERTS.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`rounded-2xl border p-4 ${SEV_STYLE[alert.severity]}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                alert.severity === 'high' ? 'bg-red-900/60' :
                alert.severity === 'medium' ? 'bg-amber-900/60' : 'bg-emerald-900/60'
              }`}>
                <alert.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{alert.symbol}</span>
                    <span className="text-[10px] font-medium opacity-80">{alert.type}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{alert.time}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
