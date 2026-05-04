import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Info } from 'lucide-react'

interface Props {
  title: string
  body: string
  how: string
  signal?: string
}

export function InfoTooltip({ title, body, how, signal }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="w-4 h-4 rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-400 transition-colors"
        aria-label={`Info about ${title}`}
      >
        <Info className="w-3 h-3" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-72 z-50 rounded-2xl border border-indigo-800/60 shadow-[0_8px_40px_rgba(0,0,0,0.7)]"
            style={{ background: 'linear-gradient(160deg,#1a1a3e 0%,#0f0f28 100%)' }}
          >
            {/* Arrow */}
            <div className="absolute bottom-[-6px] right-3 w-3 h-3 rotate-45 border-r border-b border-indigo-800/60"
              style={{ background: '#0f0f28' }} />

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                <span className="text-sm font-semibold text-white">{title}</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{body}</p>

              <div className="border-t border-indigo-900/60 pt-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">How to use</p>
                <p className="text-xs text-slate-300 leading-relaxed">{how}</p>
              </div>

              {signal && (
                <div className="bg-indigo-950/60 border border-indigo-800/40 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">Signal</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{signal}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
