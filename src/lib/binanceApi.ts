// Binance data layer
// Spot prices: https://api.binance.com (CORS *)
// Options:     dev  → Vite proxy /eapi/v1/... → eapi.binance.com
//              prod → /api/proxy?p=v1/... (Vercel function signs with env vars)

const SPOT_BASE = 'https://api.binance.com'
const IS_PROD   = import.meta.env.PROD

// Build a URL for an options endpoint — handles dev vs prod routing
function optionsUrl(apiPath: string, params: Record<string, string> = {}): string {
  if (IS_PROD) {
    const qs = new URLSearchParams({ p: `v1${apiPath}`, ...params }).toString()
    return `/api/proxy?${qs}`
  }
  const qs = new URLSearchParams(params).toString()
  return `/eapi/v1${apiPath}${qs ? `?${qs}` : ''}`
}

// Assets we show in the UI
export const SPOT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT']
export const OPTIONS_UNDERLYINGS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT']

const ASSET_META: Record<string, { name: string }> = {
  BTCUSDT:  { name: 'Bitcoin'  },
  ETHUSDT:  { name: 'Ethereum' },
  BNBUSDT:  { name: 'BNB'      },
  SOLUSDT:  { name: 'Solana'   },
  XRPUSDT:  { name: 'XRP'      },
  DOGEUSDT: { name: 'Dogecoin' },
}

async function spotGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SPOT_BASE}${path}`)
  if (!res.ok) throw new Error(`Spot API ${res.status}`)
  return res.json()
}

async function optionsGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(optionsUrl(path, params))
  if (!res.ok) throw new Error(`Options API ${res.status}`)
  return res.json()
}

// ── Spot ticker ───────────────────────────────────────────────────────

interface SpotTicker {
  symbol: string
  lastPrice: string
  priceChange: string
  priceChangePercent: string
  volume: string
  quoteVolume: string
}

export async function fetchSpotTickers(): Promise<SpotTicker[]> {
  const symbols = JSON.stringify(SPOT_SYMBOLS)
  return spotGet<SpotTicker[]>(`/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`)
}

// ── Options endpoints ─────────────────────────────────────────────────

export interface BnExchangeInfo {
  optionSymbols: Array<{
    symbol: string
    underlying: string
    strikePrice: string
    expiryDate: number
    side: 'CALL' | 'PUT'
  }>
}

export interface BnTicker {
  symbol: string
  lastPrice: string
  bidPrice: string
  askPrice: string
  volume: string
  strikePrice: string
}

export interface BnMark {
  symbol: string
  markPrice: string
  bidIV: string
  askIV: string
  markIV: string
  delta: string
  theta: string
  gamma: string
  vega: string
}

// ── Normalised output types ───────────────────────────────────────────

export interface LiveContract {
  symbol: string
  underlying: string
  asset: string
  strike: number
  expiry: string
  daysToExpiry: number
  type: 'CALL' | 'PUT'
  bid: number
  ask: number
  last: number
  markPrice: number
  iv: number
  bidIV: number
  askIV: number
  delta: number
  gamma: number
  theta: number
  vega: number
  volume: number
  openInterest: number
  underlyingPrice: number
}

export interface LiveAsset {
  symbol: string
  name: string
  price: number
  change24h: number
  changePct: number
  volume24h: number
  iv30: number
  ivRank: number
  hv30: number
  hasOptions: boolean       // only BTC + ETH
  contracts: LiveContract[]
  expiryDates: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────

function msToDateStr(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}

function daysUntil(dateStr: string) {
  return Math.max(0, Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000))
}

function avgATMiv(contracts: LiveContract[], underlying: string, price: number): number {
  const pool = contracts
    .filter(c => c.underlying === underlying && c.daysToExpiry >= 3 && c.daysToExpiry <= 21 && c.iv > 0)
    .sort((a, b) => Math.abs(a.strike - price) - Math.abs(b.strike - price))
    .slice(0, 8)
  if (!pool.length) return 0
  return +(pool.reduce((s, c) => s + c.iv, 0) / pool.length).toFixed(1)
}

// ── Master fetch ──────────────────────────────────────────────────────

export async function fetchLiveData(): Promise<LiveAsset[]> {
  // Fetch spot + options in parallel; options failure is non-fatal
  const [spotTickers, optionsResult] = await Promise.allSettled([
    fetchSpotTickers(),
    fetchOptionsData(),
  ])

  const spotMap = new Map<string, SpotTicker>()
  if (spotTickers.status === 'fulfilled') {
    for (const t of spotTickers.value) spotMap.set(t.symbol, t)
  }

  const { contracts } = optionsResult.status === 'fulfilled'
    ? optionsResult.value
    : { contracts: [] as LiveContract[] }

  return SPOT_SYMBOLS.map(sym => {
    const spot    = spotMap.get(sym)
    const price   = parseFloat(spot?.lastPrice ?? '0') || 0
    const own     = contracts.filter(c => c.underlying === sym).map(c => ({ ...c, underlyingPrice: price }))
    const expDates = [...new Set(own.map(c => c.expiry))].sort()
    const iv30    = avgATMiv(own, sym, price)

    return {
      symbol: sym,
      name: ASSET_META[sym]?.name ?? sym,
      price,
      change24h: parseFloat(spot?.priceChange ?? '0') || 0,
      changePct: parseFloat(spot?.priceChangePercent ?? '0') || 0,
      volume24h: parseFloat(spot?.quoteVolume ?? '0') || 0,
      iv30,
      ivRank: iv30 > 0 ? Math.min(99, Math.round(iv30 * 0.88)) : 0,
      hv30: 0,
      hasOptions: OPTIONS_UNDERLYINGS.includes(sym),
      contracts: own,
      expiryDates: expDates,
    }
  })
}

interface BnOpenInterest {
  symbol: string
  sumOpenInterest: string
  sumOpenInterestUsd: string
}

async function fetchOptionsData(): Promise<{ contracts: LiveContract[] }> {
  const [info, tickers, marks] = await Promise.all([
    optionsGet<BnExchangeInfo>('/exchangeInfo'),
    optionsGet<BnTicker[]>('/ticker'),
    optionsGet<BnMark[]>('/mark'),
  ])

  // Fetch OI for each underlying+expiry combo in parallel (non-fatal)
  const oiMap = new Map<string, number>()
  try {
    const expiries = [...new Set(
      info.optionSymbols
        .filter(s => OPTIONS_UNDERLYINGS.includes(s.underlying))
        .map(s => ({ underlying: s.underlying.replace('USDT', ''), expiry: msToDateStr(s.expiryDate).replace(/-/g, '').slice(2) }))
    )]
    const uniquePairs = [...new Map(expiries.map(e => [`${e.underlying}-${e.expiry}`, e])).values()]
    const oiResults = await Promise.allSettled(
      uniquePairs.map(({ underlying, expiry }) =>
        optionsGet<BnOpenInterest[]>('/openInterest', { underlyingAsset: underlying, expiration: expiry })
      )
    )
    for (const r of oiResults) {
      if (r.status === 'fulfilled') {
        for (const oi of r.value) {
          // Use USD notional OI to match what Binance app displays
          oiMap.set(oi.symbol, parseFloat(oi.sumOpenInterestUsd) || parseFloat(oi.sumOpenInterest) || 0)
        }
      }
    }
  } catch { /* OI is non-fatal */ }

  const tickerMap = new Map(tickers.map(t => [t.symbol, t]))
  const markMap   = new Map(marks.map(m => [m.symbol, m]))

  const contracts: LiveContract[] = info.optionSymbols
    .filter(s => OPTIONS_UNDERLYINGS.includes(s.underlying))
    .map(s => {
      const t      = tickerMap.get(s.symbol)
      const m      = markMap.get(s.symbol)
      const expiry = msToDateStr(s.expiryDate)
      const dte    = daysUntil(expiry)
      if (dte < 0 || dte > 90) return null

      const bid       = parseFloat(t?.bidPrice ?? '0') || 0
      const ask       = parseFloat(t?.askPrice ?? '0') || 0
      const markIvRaw = parseFloat(m?.markIV ?? '0')

      return {
        symbol: s.symbol,
        underlying: s.underlying,
        asset: s.underlying.replace('USDT', ''),
        strike: parseFloat(s.strikePrice),
        expiry,
        daysToExpiry: dte,
        type: s.side,
        bid,
        ask,
        last:      parseFloat(t?.lastPrice  ?? '0') || 0,
        markPrice: parseFloat(m?.markPrice  ?? '0') || 0,
        iv:    markIvRaw > 0 ? +(markIvRaw * 100).toFixed(2) : 0,
        bidIV: +(parseFloat(m?.bidIV ?? '0') * 100).toFixed(2),
        askIV: +(parseFloat(m?.askIV ?? '0') * 100).toFixed(2),
        delta: parseFloat(m?.delta ?? '0') || 0,
        gamma: parseFloat(m?.gamma ?? '0') || 0,
        theta: parseFloat(m?.theta ?? '0') || 0,
        vega:  parseFloat(m?.vega  ?? '0') || 0,
        volume:       parseFloat(t?.volume ?? '0') || 0,
        openInterest: oiMap.get(s.symbol) ?? 0,
        underlyingPrice: 0,
      } satisfies LiveContract
    })
    .filter((c): c is LiveContract => c !== null && (c.bid > 0 || c.markPrice > 0))

  return { contracts }
}
