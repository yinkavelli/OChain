import { useQuery } from '@tanstack/react-query'
import { fetchLiveData } from '../lib/binanceApi'
import { buildStrategies } from '../lib/strategyEngine'
import type { Strategy, Asset } from '../data/mockData'
import type { LiveAsset } from '../lib/binanceApi'
import { ASSETS as MOCK_ASSETS } from '../data/mockData'

export function useLiveData() {
  return useQuery({
    queryKey: ['binance-options'],
    queryFn: fetchLiveData,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
    retryDelay: 2000,
  })
}

export function useMergedAssets(liveAssets: LiveAsset[] | undefined): Asset[] {
  if (!liveAssets?.length) return MOCK_ASSETS

  const liveMap = new Map(liveAssets.map(a => [a.symbol, a]))

  return MOCK_ASSETS.map(mock => {
    const live = liveMap.get(mock.symbol)
    if (!live || !live.price) return mock
    return {
      ...mock,
      price:     live.price,
      change24h: live.change24h,
      changePct: live.changePct,
      volume24h: live.volume24h,
      iv30:      live.iv30  || mock.iv30,
      ivRank:    live.ivRank || mock.ivRank,
    }
  })
}

export function useLiveStrategies(liveAssets: LiveAsset[] | undefined): Strategy[] {
  if (!liveAssets?.length) return []
  // Only build live strategies for assets that actually have options contracts
  const withOptions = liveAssets.filter(a => a.hasOptions && a.contracts.length > 0)
  if (!withOptions.length) return []
  return buildStrategies(withOptions)
}
