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
  | 'Covered Call'
  | 'Bull Call Spread'
  | 'Bear Put Spread'
  | 'Long Straddle'
  | 'Iron Condor'
  | 'Cash-Secured Put'
  | 'Protective Put'

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

    // Covered Call
    const cc = makeContract(asset.symbol, Math.round(price * 1.05), 'CALL', EXPIRIES[1], price, iv)
    strategies.push({
      id: `s${id++}`,
      symbol: asset.symbol,
      type: 'Covered Call',
      legs: [cc],
      maxProfit: +(cc.bid * 1 + (cc.strike - price)).toFixed(2),
      maxLoss: +(price - cc.bid).toFixed(2),
      breakeven: +(price - cc.bid).toFixed(2),
      riskRewardRatio: +(cc.bid / price * 20).toFixed(2),
      probabilityOfProfit: +(Math.random() * 20 + 65).toFixed(1),
      netPremium: cc.bid,
      netDebit: 0,
      score: Math.floor(Math.random() * 25 + 70),
      sentiment: 'Bullish',
      expiry: EXPIRIES[1],
      daysToExpiry: daysUntil(EXPIRIES[1]),
      underlyingPrice: price,
      tags: ['Income', 'Low Risk'],
    })

    // Bull Call Spread
    const bcLong = makeContract(asset.symbol, Math.round(price * 0.99), 'CALL', EXPIRIES[2], price, iv)
    const bcShort = makeContract(asset.symbol, Math.round(price * 1.06), 'CALL', EXPIRIES[2], price, iv)
    const bcDebit = +(bcLong.ask - bcShort.bid).toFixed(2)
    const bcWidth = bcShort.strike - bcLong.strike
    strategies.push({
      id: `s${id++}`,
      symbol: asset.symbol,
      type: 'Bull Call Spread',
      legs: [bcLong, bcShort],
      maxProfit: +(bcWidth - bcDebit).toFixed(2),
      maxLoss: bcDebit,
      breakeven: +(bcLong.strike + bcDebit).toFixed(2),
      riskRewardRatio: +((bcWidth - bcDebit) / bcDebit).toFixed(2),
      probabilityOfProfit: +(Math.random() * 15 + 50).toFixed(1),
      netPremium: 0,
      netDebit: bcDebit,
      score: Math.floor(Math.random() * 20 + 65),
      sentiment: 'Bullish',
      expiry: EXPIRIES[2],
      daysToExpiry: daysUntil(EXPIRIES[2]),
      underlyingPrice: price,
      tags: ['Defined Risk', 'Bullish'],
    })

    // Bear Put Spread
    const bpLong = makeContract(asset.symbol, Math.round(price * 1.01), 'PUT', EXPIRIES[1], price, iv)
    const bpShort = makeContract(asset.symbol, Math.round(price * 0.94), 'PUT', EXPIRIES[1], price, iv)
    const bpDebit = +(bpLong.ask - bpShort.bid).toFixed(2)
    const bpWidth = bpLong.strike - bpShort.strike
    strategies.push({
      id: `s${id++}`,
      symbol: asset.symbol,
      type: 'Bear Put Spread',
      legs: [bpLong, bpShort],
      maxProfit: +(bpWidth - bpDebit).toFixed(2),
      maxLoss: bpDebit,
      breakeven: +(bpLong.strike - bpDebit).toFixed(2),
      riskRewardRatio: +((bpWidth - bpDebit) / bpDebit).toFixed(2),
      probabilityOfProfit: +(Math.random() * 15 + 45).toFixed(1),
      netPremium: 0,
      netDebit: bpDebit,
      score: Math.floor(Math.random() * 20 + 55),
      sentiment: 'Bearish',
      expiry: EXPIRIES[1],
      daysToExpiry: daysUntil(EXPIRIES[1]),
      underlyingPrice: price,
      tags: ['Defined Risk', 'Bearish'],
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
      probabilityOfProfit: +(Math.random() * 20 + 35).toFixed(1),
      netPremium: 0,
      netDebit: strDebit,
      score: Math.floor(Math.random() * 20 + 60),
      sentiment: 'Neutral',
      expiry: EXPIRIES[2],
      daysToExpiry: daysUntil(EXPIRIES[2]),
      underlyingPrice: price,
      tags: ['Volatility Play', 'Unlimited Upside'],
    })

    // Iron Condor
    const icBuyPut = makeContract(asset.symbol, Math.round(price * 0.88), 'PUT', EXPIRIES[3], price, iv)
    const icSellPut = makeContract(asset.symbol, Math.round(price * 0.93), 'PUT', EXPIRIES[3], price, iv)
    const icSellCall = makeContract(asset.symbol, Math.round(price * 1.07), 'CALL', EXPIRIES[3], price, iv)
    const icBuyCall = makeContract(asset.symbol, Math.round(price * 1.12), 'CALL', EXPIRIES[3], price, iv)
    const icPremium = +((icSellPut.bid - icBuyPut.ask) + (icSellCall.bid - icBuyCall.ask)).toFixed(2)
    const icWidth = icSellPut.strike - icBuyPut.strike
    strategies.push({
      id: `s${id++}`,
      symbol: asset.symbol,
      type: 'Iron Condor',
      legs: [icBuyPut, icSellPut, icSellCall, icBuyCall],
      maxProfit: icPremium,
      maxLoss: +(icWidth - icPremium).toFixed(2),
      breakeven: [
        +(icSellPut.strike - icPremium).toFixed(2),
        +(icSellCall.strike + icPremium).toFixed(2),
      ],
      riskRewardRatio: +(icPremium / (icWidth - icPremium)).toFixed(2),
      probabilityOfProfit: +(Math.random() * 10 + 68).toFixed(1),
      netPremium: icPremium,
      netDebit: 0,
      score: Math.floor(Math.random() * 15 + 72),
      sentiment: 'Neutral',
      expiry: EXPIRIES[3],
      daysToExpiry: daysUntil(EXPIRIES[3]),
      underlyingPrice: price,
      tags: ['Range Bound', 'High Probability'],
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
