import type { LiveContract, LiveAsset } from './binanceApi'
import type { Strategy } from '../data/mockData'

function mid(c: LiveContract) {
  if (c.bid > 0 && c.ask > 0) return (c.bid + c.ask) / 2
  return c.markPrice || c.last || 0
}

function score(rr: number, pop: number, dte: number): number {
  const dteMod = dte >= 14 && dte <= 45 ? 1 : dte >= 7 ? 0.85 : 0.7
  const rrMod  = Math.min(rr / 3, 1)
  const popMod = pop / 100
  return Math.min(99, Math.round((popMod * 0.5 + rrMod * 0.3 + dteMod * 0.2) * 100))
}

function nearATM(
  contracts: LiveContract[],
  underlying: string,
  type: 'CALL' | 'PUT',
  expiry: string,
  price: number,
  deltaTgt?: number,
): LiveContract | undefined {
  const pool = contracts.filter(
    c => c.underlying === underlying && c.type === type && c.expiry === expiry && mid(c) > 0
  )
  if (!pool.length) return undefined
  if (deltaTgt !== undefined) {
    return pool.reduce((best, c) =>
      Math.abs(Math.abs(c.delta) - deltaTgt) < Math.abs(Math.abs(best.delta) - deltaTgt) ? c : best
    )
  }
  return pool.reduce((best, c) =>
    Math.abs(c.strike - price) < Math.abs(best.strike - price) ? c : best
  )
}

function otmContract(
  contracts: LiveContract[],
  underlying: string,
  type: 'CALL' | 'PUT',
  expiry: string,
  price: number,
  pctFromPrice: number,
): LiveContract | undefined {
  const target = type === 'CALL' ? price * (1 + pctFromPrice) : price * (1 - pctFromPrice)
  const pool = contracts.filter(
    c => c.underlying === underlying && c.type === type && c.expiry === expiry && mid(c) > 0
  )
  if (!pool.length) return undefined
  return pool.reduce((best, c) =>
    Math.abs(c.strike - target) < Math.abs(best.strike - target) ? c : best
  )
}

export function buildStrategies(assets: LiveAsset[]): Strategy[] {
  const all: Strategy[] = []

  for (const asset of assets) {
    const { contracts, expiryDates, price } = asset
    if (!price || !expiryDates.length) continue

    const expiry2 = expiryDates[1] ?? expiryDates[0]
    const expiry3 = expiryDates[2] ?? expiry2

    // ── 1. Long Call (ATM) ─────────────────────────────────────────────
    const lcAtm = nearATM(contracts, asset.symbol, 'CALL', expiry2, price, 0.50)
    if (lcAtm && mid(lcAtm) > 0) {
      const debit = +mid(lcAtm).toFixed(4)
      const be    = +(lcAtm.strike + debit).toFixed(4)
      const pop   = +(Math.abs(lcAtm.delta) * 100).toFixed(1)
      all.push({
        id: `${asset.symbol}-long-call-atm-${expiry2}`,
        symbol: asset.symbol, type: 'Long Call',
        legs: [lcAtm as any],
        maxProfit: Infinity, maxLoss: debit,
        breakeven: be,
        riskRewardRatio: 999, probabilityOfProfit: +pop,
        netPremium: 0, netDebit: debit,
        score: score(999, +pop, lcAtm.daysToExpiry),
        sentiment: 'Bullish', expiry: expiry2,
        daysToExpiry: lcAtm.daysToExpiry,
        underlyingPrice: price,
        tags: ['Unlimited Upside', 'Bullish'],
      })
    }

    // ── 2. Long Call (OTM ~5%) ─────────────────────────────────────────
    const lcOtm = otmContract(contracts, asset.symbol, 'CALL', expiry2, price, 0.05)
    if (lcOtm && mid(lcOtm) > 0 && lcOtm.strike !== lcAtm?.strike) {
      const debit = +mid(lcOtm).toFixed(4)
      const be    = +(lcOtm.strike + debit).toFixed(4)
      const pop   = +(Math.abs(lcOtm.delta) * 100).toFixed(1)
      all.push({
        id: `${asset.symbol}-long-call-otm-${expiry2}`,
        symbol: asset.symbol, type: 'Long Call',
        legs: [lcOtm as any],
        maxProfit: Infinity, maxLoss: debit,
        breakeven: be,
        riskRewardRatio: 999, probabilityOfProfit: +pop,
        netPremium: 0, netDebit: debit,
        score: score(999, +pop, lcOtm.daysToExpiry),
        sentiment: 'Bullish', expiry: expiry2,
        daysToExpiry: lcOtm.daysToExpiry,
        underlyingPrice: price,
        tags: ['High Leverage', 'Bullish'],
      })
    }

    // ── 3. Long Put (ATM) ──────────────────────────────────────────────
    const lpAtm = nearATM(contracts, asset.symbol, 'PUT', expiry2, price, 0.50)
    if (lpAtm && mid(lpAtm) > 0) {
      const debit     = +mid(lpAtm).toFixed(4)
      const be        = +(lpAtm.strike - debit).toFixed(4)
      const pop       = +(Math.abs(lpAtm.delta) * 100).toFixed(1)
      const maxProfit = +(lpAtm.strike - debit).toFixed(4)
      const rr        = +(maxProfit / debit).toFixed(2)
      all.push({
        id: `${asset.symbol}-long-put-atm-${expiry2}`,
        symbol: asset.symbol, type: 'Long Put',
        legs: [lpAtm as any],
        maxProfit, maxLoss: debit,
        breakeven: be,
        riskRewardRatio: rr, probabilityOfProfit: +pop,
        netPremium: 0, netDebit: debit,
        score: score(rr, +pop, lpAtm.daysToExpiry),
        sentiment: 'Bearish', expiry: expiry2,
        daysToExpiry: lpAtm.daysToExpiry,
        underlyingPrice: price,
        tags: ['Bearish', 'Defined Risk'],
      })
    }

    // ── 4. Long Put (OTM ~5%) ──────────────────────────────────────────
    const lpOtm = otmContract(contracts, asset.symbol, 'PUT', expiry2, price, 0.05)
    if (lpOtm && mid(lpOtm) > 0 && lpOtm.strike !== lpAtm?.strike) {
      const debit     = +mid(lpOtm).toFixed(4)
      const be        = +(lpOtm.strike - debit).toFixed(4)
      const pop       = +(Math.abs(lpOtm.delta) * 100).toFixed(1)
      const maxProfit = +(lpOtm.strike - debit).toFixed(4)
      const rr        = +(maxProfit / debit).toFixed(2)
      all.push({
        id: `${asset.symbol}-long-put-otm-${expiry2}`,
        symbol: asset.symbol, type: 'Long Put',
        legs: [lpOtm as any],
        maxProfit, maxLoss: debit,
        breakeven: be,
        riskRewardRatio: rr, probabilityOfProfit: +pop,
        netPremium: 0, netDebit: debit,
        score: score(rr, +pop, lpOtm.daysToExpiry),
        sentiment: 'Bearish', expiry: expiry2,
        daysToExpiry: lpOtm.daysToExpiry,
        underlyingPrice: price,
        tags: ['High Leverage', 'Bearish'],
      })
    }

    // ── 5. Long Straddle ──────────────────────────────────────────────
    const strCall = nearATM(contracts, asset.symbol, 'CALL', expiry2, price)
    const strPut  = nearATM(contracts, asset.symbol, 'PUT',  expiry2, price)
    if (strCall && strPut) {
      const debit  = +(mid(strCall) + mid(strPut)).toFixed(4)
      const beUp   = +(strCall.strike + debit).toFixed(4)
      const beDown = +(strPut.strike - debit).toFixed(4)
      const pop    = +(Math.abs(strCall.delta - strPut.delta) * 30 + 30).toFixed(1)
      if (debit > 0) {
        all.push({
          id: `${asset.symbol}-long-straddle-${expiry2}`,
          symbol: asset.symbol, type: 'Long Straddle',
          legs: [strCall as any, strPut as any],
          maxProfit: Infinity, maxLoss: debit,
          breakeven: [beDown, beUp],
          riskRewardRatio: 999, probabilityOfProfit: +pop,
          netPremium: 0, netDebit: debit,
          score: score(999, +pop, strCall.daysToExpiry),
          sentiment: 'Neutral', expiry: expiry2,
          daysToExpiry: strCall.daysToExpiry,
          underlyingPrice: price,
          tags: ['Volatility Play', 'Unlimited Upside'],
        })
      }
    }

    // ── 6. Long Strangle (OTM ~5%) ────────────────────────────────────
    const strgCall = otmContract(contracts, asset.symbol, 'CALL', expiry3, price, 0.05)
    const strgPut  = otmContract(contracts, asset.symbol, 'PUT',  expiry3, price, 0.05)
    if (strgCall && strgPut && mid(strgCall) > 0 && mid(strgPut) > 0) {
      const debit  = +(mid(strgCall) + mid(strgPut)).toFixed(4)
      const beUp   = +(strgCall.strike + debit).toFixed(4)
      const beDown = +(strgPut.strike - debit).toFixed(4)
      const pop    = +(Math.abs(strgCall.delta - strgPut.delta) * 25 + 25).toFixed(1)
      if (debit > 0) {
        all.push({
          id: `${asset.symbol}-long-strangle-${expiry3}`,
          symbol: asset.symbol, type: 'Long Strangle',
          legs: [strgCall as any, strgPut as any],
          maxProfit: Infinity, maxLoss: debit,
          breakeven: [beDown, beUp],
          riskRewardRatio: 999, probabilityOfProfit: +pop,
          netPremium: 0, netDebit: debit,
          score: score(999, +pop, strgCall.daysToExpiry),
          sentiment: 'Neutral', expiry: expiry3,
          daysToExpiry: strgCall.daysToExpiry,
          underlyingPrice: price,
          tags: ['Volatility Play', 'Cheaper than Straddle'],
        })
      }
    }
  }

  return all.sort((a, b) => b.score - a.score)
}
