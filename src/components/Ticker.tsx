import { useQuery } from '@tanstack/react-query'
import { TICKER_DATA } from '../data/mockData'
import type { LiveAsset } from '../lib/binanceApi'

function fmt(price: number) {
  if (price > 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (price > 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (price > 1) return price.toFixed(3)
  return price.toFixed(4)
}

export function Ticker() {
  const { data: liveAssets } = useQuery<LiveAsset[]>({
    queryKey: ['binance-options'],
    enabled: false,
  })

  const liveMap = new Map(liveAssets?.map(a => [a.symbol.replace('USDT', ''), a]) ?? [])

  const base = TICKER_DATA.map(t => {
    const live = liveMap.get(t.symbol)
    if (live?.price) return { ...t, price: live.price, change: live.changePct }
    return t
  })

  const items = [...base, ...base]

  return (
    <div className="ticker-bg border-b border-[#1e1e3f] py-2 overflow-hidden">
      <div className="flex animate-ticker whitespace-nowrap">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 mx-5 text-xs font-mono">
            <span className="text-indigo-400 font-semibold">{item.symbol}</span>
            <span className="text-slate-200">${fmt(item.price)}</span>
            <span className={item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
