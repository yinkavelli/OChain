export type OptionType = 'CALL' | 'PUT'

export interface OptionContract {
  symbol: string
  strike: number
  expiry: string
  daysToExpiry: number
  type: OptionType
  bid: number
  ask: number
  last: number
  volume: number
  openInterest: number
  iv: number
  delta: number
  gamma: number
  theta: number
  vega: number
  underlyingPrice: number
}

export type StrategyType =
  | 'Long Call'
  | 'Long Put'
  | 'Long Straddle'
  | 'Long Strangle'

export interface Strategy {
  id: string
  symbol: string
  type: StrategyType
  legs: OptionContract[]
  maxProfit: number
  maxLoss: number
  breakeven: number | number[]
  riskRewardRatio: number
  probabilityOfProfit: number
  netPremium: number
  netDebit: number
  score: number
  sentiment: 'Bullish' | 'Bearish' | 'Neutral'
  expiry: string
  daysToExpiry: number
  underlyingPrice: number
  tags: string[]
}

export interface Asset {
  symbol: string
  name: string
  price: number
  change24h: number
  changePct: number
  volume24h: number
  iv30: number
  hv30: number
  ivRank: number
  ivRankSource?: 'live' | 'bootstrapped' | 'insufficient'
  ivHvRatio?: number
}

const EXPIRIES = ['2026-05-09', '2026-05-16', '2026-05-23', '2026-05-30', '2026-06-27']

function daysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function makeContract(
  symbol: string,
  strike: number,
  type: OptionType,
  expiry: string,
  basePrice: number,
  iv: number
): OptionContract {
  const mid = Math.max(0.01, basePrice * (type === 'CALL' ? 0.04 : 0.035) * (1 + Math.random() * 0.5))
  const spread = mid * 0.05
  return {
    symbol,
    strike,
    expiry,
    daysToExpiry: daysUntil(expiry),
    type,
    bid: +(mid - spread).toFixed(2),
    ask: +(mid + spread).toFixed(2),
    last: +mid.toFixed(2),
    volume: Math.floor(Math.random() * 5000 + 100),
    openInterest: Math.floor(Math.random() * 20000 + 500),
    iv: +(iv + (Math.random() - 0.5) * 10).toFixed(1),
    delta: type === 'CALL' ? +(Math.random() * 0.5 + 0.1).toFixed(3) : -(Math.random() * 0.5 + 0.1).toFixed(3),
    gamma: +(Math.random() * 0.002).toFixed(4),
    theta: -(Math.random() * 30 + 5).toFixed(2) as unknown as number,
    vega: +(Math.random() * 50 + 10).toFixed(2),
    underlyingPrice: basePrice,
  }
}

export const ASSETS: Asset[] = [
  { symbol: 'BTCUSDT',  name: 'Bitcoin',  price: 80000,  change24h: 0,    changePct: 0,    volume24h: 4.2e9, iv30: 62.4, hv30: 54.8, ivRank: 72 },
  { symbol: 'ETHUSDT',  name: 'Ethereum', price: 1800,   change24h: 0,    changePct: 0,    volume24h: 2.1e9, iv30: 74.2, hv30: 68.1, ivRank: 58 },
  { symbol: 'BNBUSDT',  name: 'BNB',      price: 600,    change24h: 0,    changePct: 0,    volume24h: 380e6, iv30: 68.9, hv30: 60.2, ivRank: 65 },
  { symbol: 'SOLUSDT',  name: 'Solana',   price: 140,    change24h: 0,    changePct: 0,    volume24h: 890e6, iv30: 88.3, hv30: 80.1, ivRank: 81 },
  { symbol: 'XRPUSDT',  name: 'XRP',      price: 0.50,   change24h: 0,    changePct: 0,    volume24h: 560e6, iv30: 91.2, hv30: 85.6, ivRank: 88 },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0.11,   change24h: 0,    changePct: 0,    volume24h: 400e6, iv30: 95.0, hv30: 88.0, ivRank: 90 },
]

function generateStrategies(): Strategy[] {
  const strategies: Strategy[] = []
  let id = 0

  ASSETS.forEach(asset => {
    const price = asset.price
    const iv = asset.iv30

    // Long Call (ATM)
    const lc = makeContract(asset.symbol, Math.round(price), 'CALL', EXPIRIES[2], price, iv)
    const lcDebit = +lc.ask.toFixed(2)
    strategies.push({
      id: `s${id++}`,
      symbol: asset.symbol,
      type: 'Long Call',
      legs: [lc],
      maxProfit: Infinity,
      maxLoss: lcDebit,
      breakeven: +(lc.strike + lcDebit).toFixed(2),
      riskRewardRatio: 999,
      probabilityOfProfit: +(Math.random() * 10 + 45).toFixed(1),
      netPremium: 0,
      netDebit: lcDebit,
      score: Math.floor(Math.random() * 15 + 68),
      sentiment: 'Bullish',
      expiry: EXPIRIES[2],
      daysToExpiry: daysUntil(EXPIRIES[2]),
      underlyingPrice: price,
      tags: ['Unlimited Upside', 'Bullish'],
    })

    // Long Put (ATM)
    const lp = makeContract(asset.symbol, Math.round(price), 'PUT', EXPIRIES[2], price, iv)
    const lpDebit = +lp.ask.toFixed(2)
    const lpMaxProfit = +(lp.strike - lpDebit).toFixed(2)
    strategies.push({
      id: `s${id++}`,
      symbol: asset.symbol,
      type: 'Long Put',
      legs: [lp],
      maxProfit: lpMaxProfit,
      maxLoss: lpDebit,
      breakeven: +(lp.strike - lpDebit).toFixed(2),
      riskRewardRatio: +(lpMaxProfit / lpDebit).toFixed(2),
      probabilityOfProfit: +(Math.random() * 10 + 42).toFixed(1),
      netPremium: 0,
      netDebit: lpDebit,
      score: Math.floor(Math.random() * 15 + 65),
      sentiment: 'Bearish',
      expiry: EXPIRIES[2],
      daysToExpiry: daysUntil(EXPIRIES[2]),
      underlyingPrice: price,
      tags: ['Bearish', 'Defined Risk'],
    })

    // Long Straddle
    const strCall = makeContract(asset.symbol, Math.round(price), 'CALL', EXPIRIES[2], price, iv)
    const strPut = makeContract(asset.symbol, Math.round(price), 'PUT', EXPIRIES[2], price, iv)
    const strDebit = +(strCall.ask + strPut.ask).toFixed(2)
    strategies.push({
      id: `s${id++}`,
      symbol: asset.symbol,
      type: 'Long Straddle',
      legs: [strCall, strPut],
      maxProfit: Infinity,
      maxLoss: strDebit,
      breakeven: [+(Math.round(price) - strDebit).toFixed(2), +(Math.round(price) + strDebit).toFixed(2)],
      riskRewardRatio: 999,
      probabilityOfProfit: +(Math.random() * 15 + 35).toFixed(1),
      netPremium: 0,
      netDebit: strDebit,
      score: Math.floor(Math.random() * 15 + 62),
      sentiment: 'Neutral',
      expiry: EXPIRIES[2],
      daysToExpiry: daysUntil(EXPIRIES[2]),
      underlyingPrice: price,
      tags: ['Volatility Play', 'Unlimited Upside'],
    })

    // Long Strangle (OTM ~5%)
    const strgCall = makeContract(asset.symbol, Math.round(price * 1.05), 'CALL', EXPIRIES[3], price, iv)
    const strgPut  = makeContract(asset.symbol, Math.round(price * 0.95), 'PUT',  EXPIRIES[3], price, iv)
    const strgDebit = +(strgCall.ask + strgPut.ask).toFixed(2)
    strategies.push({
      id: `s${id++}`,
      symbol: asset.symbol,
      type: 'Long Strangle',
      legs: [strgCall, strgPut],
      maxProfit: Infinity,
      maxLoss: strgDebit,
      breakeven: [+(strgPut.strike - strgDebit).toFixed(2), +(strgCall.strike + strgDebit).toFixed(2)],
      riskRewardRatio: 999,
      probabilityOfProfit: +(Math.random() * 15 + 28).toFixed(1),
      netPremium: 0,
      netDebit: strgDebit,
      score: Math.floor(Math.random() * 15 + 58),
      sentiment: 'Neutral',
      expiry: EXPIRIES[3],
      daysToExpiry: daysUntil(EXPIRIES[3]),
      underlyingPrice: price,
      tags: ['Volatility Play', 'Cheaper than Straddle'],
    })
  })

  return strategies.sort((a, b) => b.score - a.score)
}

export const STRATEGIES = generateStrategies()

export const TICKER_DATA = [
  { symbol: 'BTC', price: 97420, change: 1.93 },
  { symbol: 'ETH', price: 3184, change: -1.30 },
  { symbol: 'BNB', price: 612, change: 1.41 },
  { symbol: 'SOL', price: 178.4, change: -1.76 },
  { symbol: 'XRP', price: 0.547, change: 2.24 },
  { symbol: 'ADA', price: 0.412, change: 3.18 },
  { symbol: 'DOGE', price: 0.138, change: -0.82 },
  { symbol: 'AVAX', price: 34.2, change: 2.91 },
  { symbol: 'LINK', price: 14.7, change: -0.54 },
  { symbol: 'DOT', price: 6.84, change: 1.22 },
]
