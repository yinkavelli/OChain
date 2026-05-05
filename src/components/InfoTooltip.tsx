import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Info, X, CheckCircle, TrendingUp } from 'lucide-react'

interface Props {
  title: string
  body: string
  how: string
  signal?: string
}

interface Pos { top: number; left: number; above: boolean }

export function InfoTooltip({ title, body, how, signal }: Props) {
  const [open, setOpen]   = useState(false)
  const [pos, setPos]     = useState<Pos>({ top: 0, left: 0, above: false })
  const btnRef            = useRef<HTMLButtonElement>(null)

  const calcPos = useCallback(() => {
    if (!btnRef.current) return
    const r   = btnRef.current.getBoundingClientRect()
    const vw  = window.innerWidth
    const w   = Math.min(300, vw - 24)      // card width, max 300px with 12px margin each side
    const h   = 360                          // approx card height

    // horizontal: prefer right-align to button, clamp to viewport
    let left = r.right - w
    if (left < 12) left = 12
    if (left + w > vw - 12) left = vw - w - 12

    // vertical: above or below
    const above = r.top > h + 16
    const top   = above ? r.top - h - 8 : r.bottom + 8

    setPos({ top, left, above })
  }, [])

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open) calcPos()
    setOpen(v => !v)
  }

  // close on outside click or scroll
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const card = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="tooltip-card"
          initial={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: Math.min(300, window.innerWidth - 24),
            zIndex: 9999,
          }}
          className="rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.8)]"
        >
          {/* Gradient border via wrapper */}
          <div className="rounded-2xl p-[1px]"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 50%, #4f46e5 100%)' }}>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(160deg, #1a1a3e 0%, #0d0d28 100%)' }}>

              {/* Header bar */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-indigo-900/50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-sm font-bold text-white">{title}</span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setOpen(false) }}
                  className="w-6 h-6 rounded-full bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* Body */}
                <p className="text-xs text-slate-300 leading-relaxed">{body}</p>

                {/* How to use */}
                <div className="rounded-xl bg-indigo-950/60 border border-indigo-800/40 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">How to use</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{how}</p>
                </div>

                {/* Signal pill */}
                {signal && (
                  <div className="rounded-xl bg-emerald-950/40 border border-emerald-800/30 p-3">
                    <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Signal</div>
                    <p className="text-xs text-emerald-300 leading-relaxed font-mono">{signal}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
          open ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'
        }`}
        aria-label={`Info: ${title}`}
      >
        <Info className="w-3 h-3" />
      </button>

      {createPortal(card, document.body)}
    </>
  )
}
