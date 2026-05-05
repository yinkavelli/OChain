import { motion } from 'framer-motion'
import { Clock, AlertCircle, Loader2, X, ExternalLink, Lock } from 'lucide-react'
import { useSpotAccount, useAccount, usePositions, useOpenOrders, useCancelOrder } from '../hooks/usePortfolio'
import { hasCredentials } from '../lib/binanceAuth'

function fmtUsd(n: string | number) {
  const v = Number(n)
  if (isNaN(v) || v === 0) return '—'
  const abs = Math.abs(v)
  const str = abs > 1000
    ? `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${abs.toFixed(2)}`
  return v < 0 ? `-${str}` : str
}

function msToExpiry(ms: number) {
  const days = Math.round((ms - Date.now()) / 86_400_000)
  if (days <= 0) return 'Expired'
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
        Add your Binance API key in Settings to view your live balance and positions.
      </p>
    </motion.div>
  )
}

function OptionsPermissionCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-800/30 bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <p className="text-sm font-semibold text-white">Options positions require extra setup</p>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Binance's <span className="text-white">European Options Trading</span> API permission requires
        a static IP address — Vercel's servers don't have one. To see live option positions and P&L,
        view them directly in the Binance app.
      </p>
      <div className="space-y-2 text-xs text-slate-400">
        <p className="font-semibold text-slate-300">To unlock on this app:</p>
        <div className="flex items-start gap-2">
          <span className="text-indigo-400 flex-shrink-0">→</span>
          Self-host the proxy on a VPS (e.g. Hetzner €4/mo in Singapore) — gives a fixed IP to whitelist in Binance
        </div>
      </div>
      <a href="https://www.binance.com/en/my/options" target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-900/40 border border-amber-700/40 text-amber-300 text-sm font-medium hover:bg-amber-900/60 transition-colors">
        View positions in Binance app <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </motion.div>
  )
}

export function PortfolioView() {
  const hasCreds = hasCredentials()
  const { data: spotAccount, isLoading: loadingSpot, error: errSpot } = useSpotAccount()
  const { data: optAccount, isLoading: loadingOpt } = useAccount()
  const { data: positions, isLoading: loadingPos } = usePositions()
  const { data: orders } = useOpenOrders()
  const cancelOrder = useCancelOrder()

  if (!hasCreds) return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-bold text-white mb-0.5">Portfolio</h2>
        <p className="text-xs text-slate-500">Live balance & positions</p></div>
      <NoCredentials />
    </div>
  )

  // Spot balances with non-zero value
  const significantBalances = spotAccount?.balances
    ?.filter(b => parseFloat(b.free) + parseFloat(b.locked) > 0.001)
    ?.sort((a, b) => {
      const order = ['USDT', 'BTC', 'ETH', 'BNB', 'USDC']
      return (order.indexOf(a.asset) === -1 ? 99 : order.indexOf(a.asset))
           - (order.indexOf(b.asset) === -1 ? 99 : order.indexOf(b.asset))
    })
    ?.slice(0, 10) ?? []

  // Options account (may fail due to permissions)
  const usdtOpts = optAccount?.asset?.find(a => a.asset === 'USDT')
  const optionsAvailable = !!usdtOpts

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white mb-0.5">Portfolio</h2>
          <p className="text-xs text-slate-500">Binance account</p>
        </div>
        {(loadingSpot || loadingOpt) && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
      </div>

      {errSpot && (
        <div className="rounded-xl bg-red-950/40 border border-red-800/30 p-3 text-xs text-red-300">
          {(errSpot as Error).message}
        </div>
      )}

      {/* Options equity — if available */}
      {optionsAvailable && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Options Equity', value: fmtUsd(usdtOpts!.equity), color: 'indigo' },
            { label: 'Available', value: fmtUsd(usdtOpts!.availableBalance), color: 'emerald' },
            { label: 'Unrealised P&L', value: fmtUsd(usdtOpts!.unrealizedPNL),
              color: Number(usdtOpts!.unrealizedPNL) >= 0 ? 'emerald' : 'red' },
            { label: 'Margin Used', value: fmtUsd(usdtOpts!.marginBalance), color: 'violet' },
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

      {/* Spot balances — always shown when Read Info works */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Spot Balances</h3>
        {loadingSpot ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-[#0d0d20] border border-[#1e1e3f] animate-pulse" />)}
          </div>
        ) : significantBalances.length === 0 ? (
          <div className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] p-6 text-center text-sm text-slate-500">
            No spot balances found
          </div>
        ) : (
          <div className="space-y-2">
            {significantBalances.map((b, i) => {
              const total = parseFloat(b.free) + parseFloat(b.locked)
              return (
                <motion.div key={b.asset}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                      <span className="text-xs font-bold text-indigo-300">{b.asset.slice(0, 3)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{b.asset}</p>
                      {parseFloat(b.locked) > 0 && (
                        <p className="text-[10px] text-slate-500">{parseFloat(b.locked).toFixed(4)} locked</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-mono font-semibold text-slate-200">
                    {total > 0.0001 ? total.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '< 0.0001'}
                  </p>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Options positions — if permission available */}
      {optionsAvailable && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">
            Option Positions{positions?.length ? ` (${positions.length})` : ''}
          </h3>
          {loadingPos ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-20 rounded-2xl bg-[#0d0d20] border border-[#1e1e3f] animate-pulse" />)}
            </div>
          ) : !positions?.length ? (
            <div className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] p-5 text-center text-sm text-slate-500">No open positions</div>
          ) : (
            <div className="space-y-2">
              {positions.map((p, i) => {
                const pnl = Number(p.unrealizedPNL)
                return (
                  <motion.div key={p.symbol}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-2xl border p-4 ${pnl >= 0 ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-red-950/20 border-red-800/30'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono font-bold text-white">{p.symbol}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${p.optionSide === 'CALL' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'}`}>{p.optionSide}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.side === 'LONG' ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'}`}>{p.side}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <Clock className="w-2.5 h-2.5" />
                          {msToExpiry(p.expiryDate)} · Strike ${Number(p.strikePrice).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}{fmtUsd(pnl)}
                        </span>
                        <div className={`text-[10px] font-mono mt-0.5 ${Number(p.ror) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {(Number(p.ror) * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div><span className="text-slate-600">Qty</span><div className="text-slate-300 font-mono">{p.quantity}</div></div>
                      <div><span className="text-slate-600">Entry</span><div className="text-slate-300 font-mono">${Number(p.entryPrice).toFixed(4)}</div></div>
                      <div><span className="text-slate-600">Mark</span><div className="text-slate-300 font-mono">${Number(p.markPrice).toFixed(4)}</div></div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Open orders */}
      {optionsAvailable && (orders?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Open Orders ({orders!.length})</h3>
          <div className="space-y-2">
            {orders!.map((o, i) => (
              <motion.div key={o.orderId}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl border border-[#1e1e3f] bg-[#0d0d20] p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono text-white">{o.symbol}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${o.side === 'BUY' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'}`}>{o.side}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{o.quantity} × ${Number(o.price).toFixed(4)} · {o.type}</div>
                </div>
                <button onClick={() => cancelOrder.mutate({ symbol: o.symbol, orderId: o.orderId })}
                  className="w-7 h-7 rounded-xl bg-red-900/40 border border-red-800/30 flex items-center justify-center text-red-400 hover:bg-red-900/60 transition-colors">
                  {cancelOrder.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Show options permissions card if options account failed */}
      {!loadingOpt && !optionsAvailable && <OptionsPermissionCard />}
    </div>
  )
}
