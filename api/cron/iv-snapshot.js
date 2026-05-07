// Vercel Cron Job — runs daily at 00:00 UTC
// Fetches ATM IV for all option assets and upserts to Supabase iv_history

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const EAPI_BASE  = 'https://eapi.binance.com/eapi/v1'
const SPOT_BASE  = 'https://api.binance.com'
const ASSETS     = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT']

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

function normCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-(x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))))
  return x >= 0 ? 1 - p : p
}

function bsPrice(S, K, T, r, sigma, type) {
  if (T <= 0 || sigma <= 0) return Math.max(0, type === 'CALL' ? S - K : K - S)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  return type === 'CALL'
    ? S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2)
    : K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1)
}

function solveIV(price, S, K, T, type, r = 0.045) {
  if (T <= 0 || price <= 0 || S <= 0 || K <= 0) return 0
  let sigma = 0.5
  for (let i = 0; i < 100; i++) {
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T))
    const theoretical = bsPrice(S, K, T, r, sigma, type)
    const vega = S * Math.sqrt(T) * Math.exp(-(d1 * d1) / 2) / Math.sqrt(2 * Math.PI)
    if (vega < 1e-10) break
    const diff = theoretical - price
    sigma -= diff / vega
    if (sigma <= 0.001) sigma = 0.001
    if (sigma > 20) return 0
    if (Math.abs(diff) < 0.0001) break
  }
  return sigma > 0 && sigma < 20 ? +(sigma * 100).toFixed(2) : 0
}

async function eapiGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const url = `${EAPI_BASE}${path}${qs ? '?' + qs : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`eapi ${path} → ${res.status}`)
  return res.json()
}

async function spotGet(path) {
  const res = await fetch(`${SPOT_BASE}${path}`)
  if (!res.ok) throw new Error(`spot ${path} → ${res.status}`)
  return res.json()
}

async function computeATMiv(underlying, price, allContracts) {
  const own = allContracts.filter(c => c.underlying === underlying)
  const now  = Date.now()
  const pool = own
    .filter(c => {
      const dte = Math.round((c.expiryDate - now) / 86_400_000)
      return dte >= 3 && dte <= 21 && c.side === 'CALL'
    })
    .sort((a, b) => Math.abs(parseFloat(a.strikePrice) - price) - Math.abs(parseFloat(b.strikePrice) - price))
    .slice(0, 8)

  if (!pool.length) return 0

  // Fetch marks for ATM pool
  const marks = await eapiGet('/mark').catch(() => [])
  const markMap = new Map(marks.map(m => [m.symbol, m]))

  const ivs = pool.map(c => {
    const m = markMap.get(c.symbol)
    const raw = parseFloat(m?.markIV ?? '0')
    return raw > 0 ? raw * 100 : 0
  }).filter(v => v > 0)

  if (!ivs.length) return 0
  return +(ivs.reduce((s, v) => s + v, 0) / ivs.length).toFixed(1)
}

export default async function handler(req, res) {
  // Vercel cron sends GET with Authorization header — verify
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const results = []

    // Fetch all data in parallel
    const [info, spotTickers] = await Promise.all([
      eapiGet('/exchangeInfo'),
      spotGet(`/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(ASSETS))}`),
    ])

    const spotMap = new Map(spotTickers.map(t => [t.symbol, parseFloat(t.price)]))

    for (const sym of ASSETS) {
      const price = spotMap.get(sym) ?? 0
      if (!price) continue
      const iv30 = await computeATMiv(sym, price, info.optionSymbols ?? [])
      if (iv30 <= 0) continue

      const { error } = await supabase
        .from('iv_history')
        .upsert({ symbol: sym, iv30, date: today }, { onConflict: 'symbol,date' })

      results.push({ symbol: sym, iv30, error: error?.message ?? null })
    }

    return res.status(200).json({ date: today, results })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
