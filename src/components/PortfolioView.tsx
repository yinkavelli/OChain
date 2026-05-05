import { motion } from 'framer-motion'
import { Clock, AlertCircle, Loader2, X } from 'lucide-react'
import { useAccount, usePositions, useOpenOrders, useCancelOrder } from '../hooks/usePortfolio'
import { hasCredentials } from '../lib/binanceAuth'

function fmtUsd(n: string | number) {
  const v = Number(n)
  if (isNaN(v)) return '—'
  const abs = Math.abs(v)
  const str = abs > 1000
    ? `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${abs.toFixed(2)}`
  return v < 0 ? `-${str}` : str
}

function fmtPct(n: string | number) {
  const v = Number(n) * 100
  if (isNaN(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function PnlBadge({ value }: { value: string }) {
  const v = Number(value)
  const pos = v >= 0
  return (
    <span className={`text-sm font-bold font-mono ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
      {pos ? '+' : ''}{fmtUsd(value)}
    </span>
  )
}

function msToExpiry(ms: number) {
  const days = Math.round((ms - Date.now()) / 86_400_000)
  if (days <= 0) return 'Expired'
  if (days === 1) return '1d'
  return `${days}d`
}

function NoCredentials() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-indigo-800/40 bg-indigo-950/20 p-6 text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto">
        <AlertCircle className="w-6 h-6 text-indigo-400" />
      </div>
      <p className="text-base font-bold text-white">Connect your Binance account</p>
      <p className="text-xs text-slate-400 leading-relaxed">
        Add your Binance API key in Settings to view live positions, P&L,
        and execute trades directly from strategy setups.
      </p>
      <div className="rounded-xl bg-amber-950/40 border border-amber-800/30 p-3 text-left">
        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Permissions needed</p>
        <ul className="text-xs text-slate-300 space-y-1">
          <li>• <span className="text-white">Read Info</span> — for positions & balance</li>
          <li>• <span className="text-white">Enable Options</span> — for trade execution</li>
          <li>• <span className="text-slate-500">IP restriction recommended for security</span></li>
        </ul>
      </div>
    </motion.div>
  )
}

export function PortfolioView() {
  const hasCreds = hasCredentials()
  const { data: account,   isLoading: loadingAcc,  error: errAcc  } = useAccount()
  const { data: positions, isLoading: loadingPos,  error: errPos  } = usePositions()
  const { data: orders,    isLoading: loadingOrd               } = useOpenOrders()
  const cancelOrder = useCancelOrder()

  if (!hasCreds) return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-0.5">Portfolio</h2>
        <p className="text-xs text-slate-500">Live positions & P&L</p>
      </div>
      <NoCredentials />
    </div>
  )

  const isLoading = loadingAcc || loadingPos || loadingOrd

  // Derive account summary
  const usdtAsset    = account?.asset?.find(a => a.asset === 'USDT')
  const equity       = Number(usdtAsset?.equity ?? 0)
  const available    = Number(usdtAsset?.availableBalance ?? 0)
  const unrealisedPnl = Number(usdtAsset?.unrealizedPNL ?? 0)

  const totalPositionCost = (positions ?? []).reduce((s, p) => s + Number(p.positionCost), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white mb-0.5">Portfolio</h2>
          <p className="text-xs text-slate-500">Binance Options account</p>
        </div>
        {isLoading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
      </div>

      {(errAcc || errPos) && (
        <div className="rounded-xl bg-red-950/40 border border-red-800/30 p-3 text-xs text-red-300">
          {(errAcc as Error)?.message ?? (errPos as Error)?.message}
        </div>
      )}

      {/* Account summary cards */}
      {usdtAsset && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Equity', value: fmtUsd(equity), color: 'indigo' },
            { label: 'Available', value: fmtUsd(available), color: 'emerald' },
            { label: 'Unrealised P&L', value: fmtUsd(unrealisedPnl),
              color: unrealisedPnl >= 0 ? 'emerald' : 'red',
              bold: true, signed: true, raw: unrealisedPnl },
            { label: 'In Positions', value: fmtUsd(totalPositionCost), color: 'violet' },
          ].map((c, i) => (
            <motion.div key={c.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-2xl p-4 border ${
                c.color === 'emerald' ? 'bg-emerald-950/30 border-emerald-800/30' :
                c.color === 'red'     ? 'bg-red-950/30 border-red-800/30' :
                c.color === 'violet'  ? 'bg-violet-950/30 border-violet-800/30' :
                'bg-indigo-950/30 border-indigo-800/30'
              }`}>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{c.label}</p>
              <p className={`text-lg font-bold font-mono ${
                c.color === 'emerald' ? 'text-emerald-400' :
                c.color === 'red'     ? 'text-red-400' :
                c.color === 'violet'  ? 'text-violet-300' : 'text-indigo-300'
              }`}>{c.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Positions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">
            Open Positions{positions?.length ? ` (${positions.length})` : ''}
          </h3>
        </div>

        {loadingPos ? (
          <div className="space-y-2">
            {[1,2].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-[#0d0d20] border border-[#1e1e3f] animate-pulse" />
            ))}
          </div>
        ) : !positions?.length ? (
          <div className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] p-6 text-center text-sm text-slate-500">
            No open positions
          </div>
        ) : (
          <div className="space-y-2">
            {positions.map((p, i) => {
              const pnl    = Number(p.unrealizedPNL)
              const ror    = Number(p.ror) * 100
              const isLong = p.side === 'LONG'
              return (
                <motion.div key={p.symbol}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-2xl border p-4 ${
                    pnl >= 0
                      ? 'bg-emerald-950/20 border-emerald-800/30'
                      : 'bg-red-950/20 border-red-800/30'
                  }`}>
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono font-bold text-white">{p.symbol}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          p.optionSide === 'CALL'
                            ? 'bg-emerald-900/60 text-emerald-400'
                            : 'bg-red-900/60 text-red-400'
                        }`}>{p.optionSide}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isLong ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'
                        }`}>{p.side}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <Clock className="w-2.5 h-2.5" />
                        {msToExpiry(p.expiryDate)} · Strike ${Number(p.strikePrice).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <PnlBadge value={p.unrealizedPNL} />
                      <div className={`text-[10px] font-mono mt-0.5 ${ror >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {fmtPct(p.ror)}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-600">Qty</span>
                      <div className="text-slate-300 font-mono">{p.quantity}</div>
                    </div>
                    <div>
                      <span className="text-slate-600">Entry</span>
                      <div className="text-slate-300 font-mono">${Number(p.entryPrice).toFixed(4)}</div>
                    </div>
                    <div>
                      <span className="text-slate-600">Mark</span>
                      <div className="text-slate-300 font-mono">${Number(p.markPrice).toFixed(4)}</div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Open Orders */}
      {(orders?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">
            Open Orders ({orders!.length})
          </h3>
          <div className="space-y-2">
            {orders!.map((o, i) => (
              <motion.div key={o.orderId}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono text-white">{o.symbol}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      o.side === 'BUY' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'
                    }`}>{o.side}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {o.quantity} × ${Number(o.price).toFixed(4)} · {o.type}
                  </div>
                </div>
                <button
                  onClick={() => cancelOrder.mutate({ symbol: o.symbol, orderId: o.orderId })}
                  disabled={cancelOrder.isPending}
                  className="w-7 h-7 rounded-xl bg-red-900/40 border border-red-800/30 flex items-center justify-center text-red-400 hover:bg-red-900/60 transition-colors"
                >
                  {cancelOrder.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
