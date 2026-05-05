import { signedGet, signedPost, signedDelete } from './binanceAuth'

// ── Account ───────────────────────────────────────────────────────────

export interface BnOptionAccount {
  asset: Array<{
    asset: string          // e.g. "USDT"
    marginBalance: string
    equity: string
    availableBalance: string
    unrealizedPNL: string
  }>
}

export async function fetchOptionAccount(): Promise<BnOptionAccount> {
  return signedGet<BnOptionAccount>('/account')
}

// ── Positions ─────────────────────────────────────────────────────────

export interface BnPosition {
  entryPrice: string
  symbol: string           // e.g. "BTC-250509-80000-C"
  side: 'LONG' | 'SHORT'
  quantity: string
  reducibleQty: string
  markValue: string
  ror: string              // rate of return
  unrealizedPNL: string
  markPrice: string
  strikePrice: string
  positionCost: string
  expiryDate: number
  priceScale: number
  quantityScale: number
  optionSide: 'CALL' | 'PUT'
  quoteAsset: string
  time: number
}

export async function fetchPositions(): Promise<BnPosition[]> {
  return signedGet<BnPosition[]>('/position')
}

// ── Open orders ───────────────────────────────────────────────────────

export interface BnOrder {
  orderId: number
  clientOrderId: string
  symbol: string
  price: string
  quantity: string
  executedQty: string
  fee: string
  side: 'BUY' | 'SELL'
  type: 'LIMIT' | 'MARKET'
  timeInForce: string
  reduceOnly: boolean
  postOnly: boolean
  createTime: number
  updateTime: number
  status: string
  avgPrice: string
  source: string
  optionSide: 'CALL' | 'PUT'
  quoteAsset: string
  mmp: boolean
}

export async function fetchOpenOrders(symbol?: string): Promise<BnOrder[]> {
  return signedGet<BnOrder[]>('/openOrders', symbol ? { symbol } : {})
}

export async function fetchOrderHistory(symbol: string): Promise<BnOrder[]> {
  return signedGet<BnOrder[]>('/historyOrders', { symbol })
}

// ── Trade history ─────────────────────────────────────────────────────

export interface BnTrade {
  id: number
  tradeId: number
  orderId: number
  symbol: string
  price: string
  quantity: string
  fee: string
  realizedProfit: string
  side: 'BUY' | 'SELL'
  type: string
  volatility: string
  liquidity: string
  quoteAsset: string
  time: number
  priceScale: number
  quantityScale: number
  optionSide: 'CALL' | 'PUT'
}

export async function fetchUserTrades(symbol: string): Promise<BnTrade[]> {
  return signedGet<BnTrade[]>('/userTrades', { symbol })
}

// ── Place order ───────────────────────────────────────────────────────

export interface PlaceOrderParams {
  symbol: string          // e.g. "BTC-250509-80000-C"
  side: 'BUY' | 'SELL'
  type: 'LIMIT' | 'MARKET'
  quantity: number        // number of contracts (1 BTC contract = 0.1 BTC)
  price?: number          // required for LIMIT
  timeInForce?: 'GTC' | 'IOC' | 'FOK'
  reduceOnly?: boolean
  postOnly?: boolean
  clientOrderId?: string
  isMmp?: boolean
}

export interface PlaceOrderResult {
  orderId: number
  clientOrderId: string
  symbol: string
  price: string
  quantity: string
  side: string
  type: string
  createTime: number
  status: string
}

export async function placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
  const p: Record<string, string | number> = {
    symbol:      params.symbol,
    side:        params.side,
    type:        params.type,
    quantity:    params.quantity,
    timeInForce: params.timeInForce ?? 'GTC',
  }
  if (params.price)       p.price       = params.price
  if (params.reduceOnly)  p.reduceOnly  = 'true'
  if (params.postOnly)    p.postOnly    = 'true'
  if (params.clientOrderId) p.clientOrderId = params.clientOrderId
  return signedPost<PlaceOrderResult>('/order', p)
}

export async function cancelOrder(symbol: string, orderId: number): Promise<void> {
  await signedDelete('/order', { symbol, orderId })
}

// ── Turbos (Knock-out Warrants) ───────────────────────────────────────
// Binance Turbo products are served through the same eapi but with
// underlying set to the turbo instrument. We probe exchangeInfo for
// any symbols that aren't standard vanilla options.

export interface BnTurbo {
  symbol: string
  underlying: string
  strikePrice: string
  expiryDate: number
  side: 'CALL' | 'PUT'
  unit: string
  minQty: string
  maxQty: string
  initialMargin: string
  markPrice?: string
  bidPrice?: string
  askPrice?: string
  iv?: string
}

export async function fetchTurbos(): Promise<BnTurbo[]> {
  // Probe the public exchangeInfo for Turbo-specific symbols.
  // Binance Turbo symbols typically have shorter expiries (daily/weekly)
  // and unit sizes different from standard 0.1 BTC.
  try {
    const res = await fetch('/eapi/v1/exchangeInfo')
    if (!res.ok) return []
    const data = await res.json()
    // Turbos have a 'unit' field != 0.1 or are labelled with 'KO' (knock-out)
    // In practice, eapi only lists vanilla options publicly.
    // Return empty if nothing found — the UI handles this gracefully.
    const symbols = data?.optionSymbols ?? []
    return symbols
      .filter((s: any) => s.unit && parseFloat(s.unit) !== 0.1)
      .slice(0, 50)
  } catch {
    return []
  }
}
