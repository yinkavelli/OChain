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

const CARD_W  = 308
const CARD_MAX_H = 420   // triggers internal scroll beyond this

export function InfoTooltip({ title, body, how, signal }: Props) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const calcPos = useCallback(() => {
    if (!btnRef.current) return
    const r  = btnRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Horizontal: right-align to button, clamp inside viewport
    let left = r.right - CARD_W
    if (left < 8)       left = 8
    if (left + CARD_W > vw - 8) left = vw - CARD_W - 8

    // Vertical: prefer above button; if not enough room, go below; always clamp
    const spaceAbove = r.top - 12
    const spaceBelow = vh - r.bottom - 12
    let top: number

    if (spaceAbove >= Math.min(CARD_MAX_H, 280)) {
      // enough room above — anchor bottom of card to button top
      top = r.top - Math.min(CARD_MAX_H, spaceAbove)
    } else if (spaceBelow >= 220) {
      // below
      top = r.bottom + 8
    } else {
      // center vertically in viewport
      top = Math.max(8, (vh - CARD_MAX_H) / 2)
    }

    // Final clamp: never go below viewport
    if (top + CARD_MAX_H > vh - 8) top = Math.max(8, vh - CARD_MAX_H - 8)

    setPos({ top, left })
  }, [])

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open) calcPos()
    setOpen(v => !v)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize',  close)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize',  close)
    }
  }, [open])

  const card = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="info-card"
          initial={{ opacity: 0, scale: 0.93, y: -6 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{    opacity: 0, scale: 0.93, y: -6  }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top:      pos.top,
            left:     pos.left,
            width:    CARD_W,
            maxHeight: CARD_MAX_H,
            zIndex:   9999,
          }}
          className="rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
        >
          {/* Gradient border shell */}
          <div className="rounded-2xl p-[1.5px] h-full"
            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed, #4f46e5)' }}>
            <div className="rounded-2xl flex flex-col overflow-hidden h-full"
              style={{ background: 'linear-gradient(160deg, #1c1c42 0%, #0d0d28 100%)' }}>

              {/* Sticky header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-indigo-900/60 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-sm font-bold text-white leading-tight">{title}</span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setOpen(false) }}
                  className="w-6 h-6 rounded-full bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto overscroll-contain px-4 py-3 space-y-3 flex-1"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#4f46e5 transparent' }}>

                <p className="text-xs text-slate-300 leading-relaxed">{body}</p>

                <div className="rounded-xl bg-indigo-950/70 border border-indigo-800/50 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">How to use</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{how}</p>
                </div>

                {signal && (
                  <div className="rounded-xl bg-emerald-950/50 border border-emerald-800/40 p-3">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">Signal</div>
                    <p className="text-[11px] text-emerald-300 leading-relaxed font-mono">{signal}</p>
                  </div>
                )}

                {/* scroll affordance padding */}
                <div className="h-1" />
              </div>

              {/* Scroll hint — only shows when content overflows */}
              <div className="flex-shrink-0 border-t border-indigo-900/40 px-4 py-1.5 flex justify-center">
                <span className="text-[9px] text-slate-600 tracking-wide">scroll for more ↕</span>
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
