import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchOptionAccount, fetchPositions, fetchOpenOrders,
  fetchSpotAccount, placeOrder, cancelOrder,
} from '../lib/binancePrivate'
import type { PlaceOrderParams } from '../lib/binancePrivate'
import { hasCredentials } from '../lib/binanceAuth'

// Spot account — only needs Read Info, no IP restriction
export function useSpotAccount() {
  return useQuery({
    queryKey: ['bn-spot-account'],
    queryFn:  fetchSpotAccount,
    enabled:  hasCredentials(),
    refetchInterval: 30_000,
    retry: 1,
  })
}

// Options account — needs European Options Trading permission + static IP
export function useAccount() {
  return useQuery({
    queryKey: ['bn-account'],
    queryFn:  fetchOptionAccount,
    enabled:  hasCredentials(),
    refetchInterval: 15_000,
    retry: 0,  // don't retry — if it fails it's a permissions issue
  })
}

export function usePositions() {
  return useQuery({
    queryKey: ['bn-positions'],
    queryFn:  fetchPositions,
    enabled:  hasCredentials(),
    refetchInterval: 10_000,
    retry: 1,
  })
}

export function useOpenOrders() {
  return useQuery({
    queryKey: ['bn-open-orders'],
    queryFn:  () => fetchOpenOrders(),
    enabled:  hasCredentials(),
    refetchInterval: 10_000,
    retry: 1,
  })
}

export function usePlaceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: PlaceOrderParams) => placeOrder(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bn-positions'] })
      qc.invalidateQueries({ queryKey: ['bn-open-orders'] })
      qc.invalidateQueries({ queryKey: ['bn-account'] })
    },
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ symbol, orderId }: { symbol: string; orderId: number }) =>
      cancelOrder(symbol, orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bn-open-orders'] })
    },
  })
}
