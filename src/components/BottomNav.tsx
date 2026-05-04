import { BarChart2, Layers, Search, Bell, Settings } from 'lucide-react'
import { motion } from 'framer-motion'

const TABS = [
  { id: 'dashboard', icon: BarChart2, label: 'Dashboard' },
  { id: 'screener', icon: Search, label: 'Screener' },
  { id: 'chains', icon: Layers, label: 'Chains' },
  { id: 'alerts', icon: Bell, label: 'Alerts' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

interface Props {
  active: string
  onChange: (id: string) => void
}

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#1e1e3f]"
      style={{ background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(20px)' }}
    >
      <div className="flex items-center justify-around py-2 pb-safe">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex flex-col items-center gap-0.5 px-4 py-1 relative"
          >
            {active === tab.id && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 rounded-2xl bg-indigo-600/20 border border-indigo-500/30"
              />
            )}
            <tab.icon className={`w-5 h-5 relative z-10 ${active === tab.id ? 'text-indigo-400' : 'text-slate-600'}`} />
            <span className={`text-[9px] font-medium relative z-10 ${active === tab.id ? 'text-indigo-400' : 'text-slate-600'}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
