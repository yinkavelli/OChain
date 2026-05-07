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

// ── HV30 calculation ──────────────────────────────────────────────────
// Fetch 31 daily closes → 30 log returns → annualised std dev

async function fetchHV30(symbol: string): Promise<number> {
  try {
    // Each kline: [openTime, open, high, low, close, ...]
    const klines = await spotGet<[number, string, string, string, string, ...unknown[]][]>(
      `/api/v3/klines?symbol=${symbol}&interval=1d&limit=32`
    )
    if (klines.length < 2) return 0
    const closes = klines.map(k => parseFloat(k[4]))
    const logReturns: number[] = []
    for (let i = 1; i < closes.length; i++) {
      logReturns.push(Math.log(closes[i] / closes[i - 1]))
    }
    const n    = logReturns.length
    const mean = logReturns.reduce((s, r) => s + r, 0) / n
    const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1)
    return +(Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(1)
  } catch {
    return 0
  }
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
  ivRankSource: 'live' | 'bootstrapped' | 'insufficient'
  hv30: number
  ivHvRatio: number   // IV30 / HV30 — vol premium ratio
  hasOptions: boolean
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

// ── IV Rank: Supabase live history + bootstrapped fallback ────────────

import { supabase } from './supabase'
import { solveIV } from './blackScholes'

function calcIVRankFromSeries(current: number, series: number[]): number {
  const ivMin = Math.min(...series)
  const ivMax = Math.max(...series)
  if (ivMax === ivMin) return 50
  return Math.min(99, Math.round(((current - ivMin) / (ivMax - ivMin)) * 100))
}

// Round price to nearest standard strike for each asset
function nearestStrike(price: number, asset: string): number {
  const increments: Record<string, number> = {
    BTC: 1000, ETH: 100, BNB: 10, SOL: 5, XRP: 0.1, DOGE: 0.005
  }
  const inc = increments[asset] ?? 10
  return Math.round(price / inc) * inc
}

// Format timestamp to Binance expiry format YYMMDD
function tsToExpiry(ts: number): string {
  const d = new Date(ts)
  const yy = String(d.getUTCFullYear()).slice(2)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

// Build IV series from one option symbol's klines
async function ivSeriesFromSymbol(
  optSymbol: string,
  strike: number,
  expiryMs: number,
  spotKlines: [number, string, string, string, string, ...unknown[]][]
): Promise<number[]> {
  const klines = await optionsGet<[number, string, string, string, string, ...unknown[]][]>(
    '/klines', { symbol: optSymbol, interval: '1d', limit: '90' }
  )
  if (klines.length < 3) return []

  const spotMap = new Map(spotKlines.map(k => [k[0] as number, parseFloat(k[4] as string)]))
  const ivs: number[] = []

  for (const k of klines) {
    const openTime   = k[0] as number
    const closePrice = parseFloat(k[4] as string)
    if (!closePrice || closePrice <= 0) continue

    // Find nearest spot close (within ±1.5 days)
    let spotAtTime = spotMap.get(openTime)
    if (!spotAtTime) {
      for (const [ts, price] of spotMap) {
        if (Math.abs(ts - openTime) < 86_400_000 * 1.5) { spotAtTime = price; break }
      }
    }
    if (!spotAtTime || spotAtTime <= 0) continue

    const T = Math.max(0, (expiryMs - openTime) / (365 * 86_400_000))
    if (T <= 0 || T > 0.5) continue

    const iv = solveIV(closePrice, spotAtTime, strike, T, 'CALL')
    if (iv > 5 && iv < 500) ivs.push(iv)
  }
  return ivs
}

// Chain expired + active contracts to reconstruct 180-day IV history
async function bootstrapIVHistory(
  symbol: string,
  contracts: LiveContract[],
  currentPrice: number
): Promise<number[]> {
  if (currentPrice <= 0) return []
  const asset = symbol.replace('USDT', '')

  try {
    // Fetch spot klines once — shared across all contract lookups
    const spotKlines = await spotGet<[number, string, string, string, string, ...unknown[]][]>(
      `/api/v3/klines?symbol=${symbol}&interval=1d&limit=180`
    )
    if (spotKlines.length < 5) return []

    const allIVs: number[] = []

    // 1. Current active ATM contracts (up to 3 nearest expiries)
    const activeExpiries = [...new Set(
      contracts
        .filter(c => c.underlying === symbol && c.type === 'CALL' && c.daysToExpiry >= 3)
        .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
        .slice(0, 3)
        .map(c => c.expiry)
    )]

    for (const expiry of activeExpiries) {
      const atm = contracts
        .filter(c => c.underlying === symbol && c.type === 'CALL' && c.expiry === expiry)
        .sort((a, b) => Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice))[0]
      if (!atm) continue
      const ivs = await ivSeriesFromSymbol(atm.symbol, atm.strike, new Date(atm.expiry).getTime(), spotKlines)
      allIVs.push(...ivs)
    }

    // 2. Reconstruct past expired contracts — find past Fridays from spot klines
    //    Binance options expire every Friday at 08:00 UTC
    const pastFridays = spotKlines
      .filter(k => new Date(k[0] as number).getUTCDay() === 5) // Friday
      .map(k => ({ ts: k[0] as number, close: parseFloat(k[4] as string) }))
      .filter(f => f.ts < Date.now() - 7 * 86_400_000) // only expired ones
      .slice(-8) // last 8 expired Fridays (~2 months)

    const expiredResults = await Promise.allSettled(
      pastFridays.map(async ({ ts, close }) => {
        const strike  = nearestStrike(close, asset)
        const expCode = tsToExpiry(ts)
        const optSym  = `${asset}-${expCode}-${strike}-C`
        return ivSeriesFromSymbol(optSym, strike, ts, spotKlines)
      })
    )

    for (const r of expiredResults) {
      if (r.status === 'fulfilled') allIVs.push(...r.value)
    }

    return allIVs
  } catch {
    return []
  }
}

async function fetchIVRank(
  symbol: string,
  currentIV: number,
  contracts: LiveContract[],
  currentPrice: number
): Promise<{ rank: number; source: 'live' | 'bootstrapped' | 'insufficient' }> {
  if (currentIV <= 0) return { rank: 0, source: 'insufficient' }

  try {
    // Upsert one reading per symbol per day — on conflict update iv30 with latest
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('iv_history')
      .upsert({ symbol, iv30: currentIV, date: today }, { onConflict: 'symbol,date' })
      .then(() => {})

    // Try Supabase history first
    const { data } = await supabase
      .from('iv_history')
      .select('iv30')
      .eq('symbol', symbol)
      .order('date', { ascending: false })
      .limit(252)

    if (data && data.length >= 30) {
      const series = data.map(r => Number(r.iv30))
      return { rank: calcIVRankFromSeries(currentIV, series), source: 'live' }
    }

    // Fall back to bootstrapped history from option klines
    const bootstrapped = await bootstrapIVHistory(symbol, contracts, currentPrice)
    if (bootstrapped.length >= 10) {
      const combined = [...bootstrapped, ...(data?.map(r => Number(r.iv30)) ?? []), currentIV]
      return { rank: calcIVRankFromSeries(currentIV, combined), source: 'bootstrapped' }
    }

    return { rank: 0, source: 'insufficient' }
  } catch {
    return { rank: 0, source: 'insufficient' }
  }
}

// ── Master fetch ──────────────────────────────────────────────────────

export async function fetchLiveData(): Promise<LiveAsset[]> {
  const [spotTickers, optionsResult, ...hv30Results] = await Promise.allSettled([
    fetchSpotTickers(),
    fetchOptionsData(),
    ...SPOT_SYMBOLS.map(s => fetchHV30(s)),
  ])

  const spotMap = new Map<string, SpotTicker>()
  if (spotTickers.status === 'fulfilled') {
    for (const t of spotTickers.value) spotMap.set(t.symbol, t)
  }

  const { contracts } = optionsResult.status === 'fulfilled'
    ? optionsResult.value
    : { contracts: [] as LiveContract[] }

  const hv30Map = Object.fromEntries(
    SPOT_SYMBOLS.map((sym, i) => [sym, hv30Results[i].status === 'fulfilled' ? (hv30Results[i] as PromiseFulfilledResult<number>).value : 0])
  )

  const assets = await Promise.all(SPOT_SYMBOLS.map(async sym => {
    const spot    = spotMap.get(sym)
    const price   = parseFloat(spot?.lastPrice ?? '0') || 0
    const own     = contracts.filter(c => c.underlying === sym).map(c => ({ ...c, underlyingPrice: price }))
    const expDates = [...new Set(own.map(c => c.expiry))].sort()
    const iv30    = avgATMiv(own, sym, price)
    const hv30    = hv30Map[sym] ?? 0
    const { rank: ivRank, source: ivRankSource } = await fetchIVRank(sym, iv30, own, price)
    const ivHvRatio = hv30 > 0 ? +(iv30 / hv30).toFixed(2) : 0

    return {
      symbol: sym,
      name: ASSET_META[sym]?.name ?? sym,
      price,
      change24h: parseFloat(spot?.priceChange ?? '0') || 0,
      changePct: parseFloat(spot?.priceChangePercent ?? '0') || 0,
      volume24h: parseFloat(spot?.quoteVolume ?? '0') || 0,
      iv30,
      ivRank,
      ivRankSource,
      hv30,
      ivHvRatio,
      hasOptions: OPTIONS_UNDERLYINGS.includes(sym),
      contracts: own,
      expiryDates: own.length > 0 ? expDates : [],
    }
  }))

  return assets
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
