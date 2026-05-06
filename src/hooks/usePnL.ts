import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type PnlSnapshot, type Trade } from '../lib/supabase'

// Fetch pnl snapshots for the equity curve
export function usePnlHistory(userId?: string) {
  return useQuery({
    queryKey: ['pnl-history', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pnl_snapshots')
        .select('total_pnl, snapshot_at')
        .order('snapshot_at', { ascending: true })
        .limit(500)
      if (error) throw error
      return data as Pick<PnlSnapshot, 'total_pnl' | 'snapshot_at'>[]
    },
    enabled: !!userId,
  })
}

// Every 30s: compute mark-to-market P&L and write a snapshot
export function usePnlSnapshotter(
  userId: string | undefined,
  openTrades: Trade[],
  markPrices: Record<string, number>,
) {
  const qc = useQueryClient()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId || openTrades.length === 0) return

    const snap = async () => {
      const total = openTrades.reduce((sum, t) => {
        const mark = markPrices[t.symbol]
        if (!mark) return sum
        const multiplier = t.asset === 'BTC' ? 0.1 : 1
        const pnl = (mark - t.entry_price) * t.quantity * multiplier * (t.side === 'BUY' ? 1 : -1)
        return sum + pnl
      }, 0)

      await supabase.from('pnl_snapshots').insert({ user_id: userId, total_pnl: total })
      qc.invalidateQueries({ queryKey: ['pnl-history', userId] })
    }

    snap()
    timerRef.current = setInterval(snap, 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [userId, openTrades, markPrices, qc])
}

// Compute current unrealised P&L per trade
export function calcUnrealisedPnl(trade: Trade, markPrice: number | undefined): number {
  if (!markPrice) return 0
  const multiplier = trade.asset === 'BTC' ? 0.1 : 1
  return (markPrice - trade.entry_price) * trade.quantity * multiplier * (trade.side === 'BUY' ? 1 : -1)
}
