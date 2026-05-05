import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, TrendingUp, CheckCircle, Zap } from 'lucide-react'

export interface InfoDef {
  title: string
  body: string
  how: string
  signal?: string
}

interface Props extends InfoDef {
  open: boolean
  onClose: () => void
}

export function InfoCard({ open, onClose, title, body, how, signal }: Props) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="info-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={onClose}
          />

          {/* Card — slides up from bottom, sits sticky above nav */}
          <motion.div
            key="info-card"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0,      opacity: 1 }}
            exit={{    y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] max-h-[78svh] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Gradient border shell */}
            <div className="mx-2 mb-2 rounded-3xl p-[1.5px] flex flex-col overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#6366f1 0%,#7c3aed 60%,#4f46e5 100%)',
                       boxShadow: '0 -8px 60px rgba(99,102,241,0.25), 0 24px 80px rgba(0,0,0,0.8)' }}>
              <div className="rounded-[22px] flex flex-col overflow-hidden"
                style={{ background: 'linear-gradient(170deg,#1c1c44 0%,#0d0d26 100%)' }}>

                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                  <div className="w-10 h-1 rounded-full bg-slate-600" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-indigo-900/50 flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-base font-bold text-white">{title}</span>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto overscroll-contain px-5 py-4 space-y-4 flex-1"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: '#4f46e5 transparent' }}>

                  {/* What is it */}
                  <p className="text-sm text-slate-300 leading-relaxed">{body}</p>

                  {/* How to use */}
                  <div className="rounded-2xl bg-indigo-950/60 border border-indigo-800/40 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">How to use</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{how}</p>
                  </div>

                  {/* Signal */}
                  {signal && (
                    <div className="rounded-2xl bg-emerald-950/40 border border-emerald-800/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Signal</span>
                      </div>
                      <p className="text-sm text-emerald-300 leading-relaxed font-mono">{signal}</p>
                    </div>
                  )}

                  {/* Bottom padding so last item isn't right against close button */}
                  <div className="h-2" />
                </div>

                {/* Sticky close button */}
                <div className="flex-shrink-0 px-5 py-3 border-t border-indigo-900/40">
                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-2xl bg-indigo-600/20 border border-indigo-600/30 text-indigo-300 text-sm font-semibold hover:bg-indigo-600/30 transition-colors active:scale-95"
                  >
                    Close
                  </button>
                </div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
