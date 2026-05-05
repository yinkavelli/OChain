import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchOptionAccount, fetchPositions, fetchOpenOrders,
  placeOrder, cancelOrder,
} from '../lib/binancePrivate'
import type { PlaceOrderParams } from '../lib/binancePrivate'
import { hasCredentials } from '../lib/binanceAuth'

export function useAccount() {
  return useQuery({
    queryKey: ['bn-account'],
    queryFn:  fetchOptionAccount,
    enabled:  hasCredentials(),
    refetchInterval: 15_000,
    retry: 1,
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
