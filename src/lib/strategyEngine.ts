import type { LiveContract, LiveAsset } from './binanceApi'
import type { Strategy } from '../data/mockData'

let idCounter = 0
function uid() { return `live-${idCounter++}` }

function mid(c: LiveContract) {
  if (c.bid > 0 && c.ask > 0) return (c.bid + c.ask) / 2
  return c.markPrice || c.last || 0
}


function score(rr: number, pop: number, dte: number): number {
  // Higher PoP + better R/R + optimal DTE (21-45 days)
  const dteMod = dte >= 14 && dte <= 45 ? 1 : dte >= 7 ? 0.85 : 0.7
  const rrMod  = Math.min(rr / 3, 1)
  const popMod = pop / 100
  return Math.min(99, Math.round((popMod * 0.5 + rrMod * 0.3 + dteMod * 0.2) * 100))
}

// Find ATM or nearest-to-ATM contract for a given underlying/type/expiry
function nearATM(
  contracts: LiveContract[],
  underlying: string,
  type: 'CALL' | 'PUT',
  expiry: string,
  price: number,
  deltaTgt?: number,  // e.g. 0.3 for 30-delta
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
  pctFromPrice: number,   // e.g. 0.05 = 5% OTM
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

    // Use the 2nd-nearest expiry for most strategies (better theta decay range)
    const expiry1 = expiryDates[0]
    const expiry2 = expiryDates[1] ?? expiryDates[0]
    const expiry3 = expiryDates[2] ?? expiry2

    // ── 1. Covered Call (short 30-delta call) ──────────────────────────
    const ccShort = otmContract(contracts, asset.symbol, 'CALL', expiry2, price, 0.05)
    if (ccShort && mid(ccShort) > 0) {
      const premium = mid(ccShort)
      const maxProfit = +(ccShort.strike - price + premium).toFixed(4)
      const maxLoss   = +(price - premium).toFixed(4)
      const be        = +(price - premium).toFixed(4)
      const rr        = +(maxProfit / maxLoss).toFixed(2)
      const p         = +(100 - Math.abs(ccShort.delta) * 100).toFixed(1)
      all.push({
        id: uid(), symbol: asset.symbol, type: 'Covered Call',
        legs: [ccShort as any],
        maxProfit, maxLoss, breakeven: be,
        riskRewardRatio: rr, probabilityOfProfit: p,
        netPremium: +premium.toFixed(4), netDebit: 0,
        score: score(rr, p, ccShort.daysToExpiry),
        sentiment: 'Bullish', expiry: expiry2,
        daysToExpiry: ccShort.daysToExpiry,
        underlyingPrice: price,
        tags: ['Income', 'Low Risk'],
      })
    }

    // ── 2. Cash-Secured Put ────────────────────────────────────────────
    const cspShort = otmContract(contracts, asset.symbol, 'PUT', expiry2, price, 0.05)
    if (cspShort && mid(cspShort) > 0) {
      const premium = mid(cspShort)
      const maxProfit = +premium.toFixed(4)
      const maxLoss   = +(cspShort.strike - premium).toFixed(4)
      const be        = +(cspShort.strike - premium).toFixed(4)
      const rr        = +(maxProfit / maxLoss).toFixed(4)
      const p         = +((1 - Math.abs(cspShort.delta)) * 100).toFixed(1)
      all.push({
        id: uid(), symbol: asset.symbol, type: 'Cash-Secured Put',
        legs: [cspShort as any],
        maxProfit, maxLoss, breakeven: be,
        riskRewardRatio: rr, probabilityOfProfit: p,
        netPremium: +premium.toFixed(4), netDebit: 0,
        score: score(rr, p, cspShort.daysToExpiry),
        sentiment: 'Bullish', expiry: expiry2,
        daysToExpiry: cspShort.daysToExpiry,
        underlyingPrice: price,
        tags: ['Income', 'Defined Risk'],
      })
    }

    // ── 3. Bull Call Spread ────────────────────────────────────────────
    const bcLong  = nearATM(contracts, asset.symbol, 'CALL', expiry2, price, 0.50)
    const bcShort = otmContract(contracts, asset.symbol, 'CALL', expiry2, price, 0.06)
    if (bcLong && bcShort && bcShort.strike > bcLong.strike) {
      const debit     = +(mid(bcLong) - mid(bcShort)).toFixed(4)
      const width     = bcShort.strike - bcLong.strike
      const maxProfit = +(width - debit).toFixed(4)
      const maxLoss   = debit
      const be        = +(bcLong.strike + debit).toFixed(4)
      const rr        = +(maxProfit / maxLoss).toFixed(2)
      const p         = +(bcLong.delta * 100).toFixed(1)
      if (debit > 0 && maxProfit > 0) {
        all.push({
          id: uid(), symbol: asset.symbol, type: 'Bull Call Spread',
          legs: [bcLong as any, bcShort as any],
          maxProfit, maxLoss, breakeven: be,
          riskRewardRatio: rr, probabilityOfProfit: p,
          netPremium: 0, netDebit: debit,
          score: score(rr, p, bcLong.daysToExpiry),
          sentiment: 'Bullish', expiry: expiry2,
          daysToExpiry: bcLong.daysToExpiry,
          underlyingPrice: price,
          tags: ['Defined Risk', 'Bullish'],
        })
      }
    }

    // ── 4. Bear Put Spread ─────────────────────────────────────────────
    const bpLong  = nearATM(contracts, asset.symbol, 'PUT', expiry1, price, 0.50)
    const bpShort = otmContract(contracts, asset.symbol, 'PUT', expiry1, price, 0.06)
    if (bpLong && bpShort && bpShort.strike < bpLong.strike) {
      const debit     = +(mid(bpLong) - mid(bpShort)).toFixed(4)
      const width     = bpLong.strike - bpShort.strike
      const maxProfit = +(width - debit).toFixed(4)
      const maxLoss   = debit
      const be        = +(bpLong.strike - debit).toFixed(4)
      const rr        = +(maxProfit / maxLoss).toFixed(2)
      const p         = +(Math.abs(bpLong.delta) * 100).toFixed(1)
      if (debit > 0 && maxProfit > 0) {
        all.push({
          id: uid(), symbol: asset.symbol, type: 'Bear Put Spread',
          legs: [bpLong as any, bpShort as any],
          maxProfit, maxLoss, breakeven: be,
          riskRewardRatio: rr, probabilityOfProfit: p,
          netPremium: 0, netDebit: debit,
          score: score(rr, p, bpLong.daysToExpiry),
          sentiment: 'Bearish', expiry: expiry1,
          daysToExpiry: bpLong.daysToExpiry,
          underlyingPrice: price,
          tags: ['Defined Risk', 'Bearish'],
        })
      }
    }

    // ── 5. Long Straddle ──────────────────────────────────────────────
    const strCall = nearATM(contracts, asset.symbol, 'CALL', expiry2, price)
    const strPut  = nearATM(contracts, asset.symbol, 'PUT',  expiry2, price)
    if (strCall && strPut) {
      const debit    = +(mid(strCall) + mid(strPut)).toFixed(4)
      const maxLoss  = debit
      const beUp     = +(strCall.strike + debit).toFixed(4)
      const beDown   = +(strPut.strike - debit).toFixed(4)
      const p        = +(Math.abs(strCall.delta - strPut.delta) * 30 + 30).toFixed(1) // rough
      if (debit > 0) {
        all.push({
          id: uid(), symbol: asset.symbol, type: 'Long Straddle',
          legs: [strCall as any, strPut as any],
          maxProfit: Infinity, maxLoss,
          breakeven: [beDown, beUp],
          riskRewardRatio: 999, probabilityOfProfit: p,
          netPremium: 0, netDebit: debit,
          score: score(3, p, strCall.daysToExpiry),
          sentiment: 'Neutral', expiry: expiry2,
          daysToExpiry: strCall.daysToExpiry,
          underlyingPrice: price,
          tags: ['Volatility Play', 'Unlimited Upside'],
        })
      }
    }

    // ── 6. Iron Condor ─────────────────────────────────────────────────
    const icBuyPut  = otmContract(contracts, asset.symbol, 'PUT',  expiry3, price, 0.12)
    const icSellPut = otmContract(contracts, asset.symbol, 'PUT',  expiry3, price, 0.07)
    const icSellCall= otmContract(contracts, asset.symbol, 'CALL', expiry3, price, 0.07)
    const icBuyCall = otmContract(contracts, asset.symbol, 'CALL', expiry3, price, 0.12)

    if (icBuyPut && icSellPut && icSellCall && icBuyCall
      && icSellPut.strike > icBuyPut.strike
      && icBuyCall.strike > icSellCall.strike) {
      const premium  = +((mid(icSellPut) - mid(icBuyPut)) + (mid(icSellCall) - mid(icBuyCall))).toFixed(4)
      const width    = icSellPut.strike - icBuyPut.strike
      const maxLoss  = +(width - premium).toFixed(4)
      const rr       = premium > 0 && maxLoss > 0 ? +(premium / maxLoss).toFixed(3) : 0
      const p        = +((1 - Math.abs(icSellPut.delta) - Math.abs(icSellCall.delta)) * 100).toFixed(1)
      if (premium > 0 && maxLoss > 0) {
        all.push({
          id: uid(), symbol: asset.symbol, type: 'Iron Condor',
          legs: [icBuyPut as any, icSellPut as any, icSellCall as any, icBuyCall as any],
          maxProfit: premium, maxLoss,
          breakeven: [
            +(icSellPut.strike - premium).toFixed(4),
            +(icSellCall.strike + premium).toFixed(4),
          ],
          riskRewardRatio: rr, probabilityOfProfit: Math.max(50, p),
          netPremium: premium, netDebit: 0,
          score: score(rr, Math.max(50, p), icSellPut.daysToExpiry),
          sentiment: 'Neutral', expiry: expiry3,
          daysToExpiry: icSellPut.daysToExpiry,
          underlyingPrice: price,
          tags: ['Range Bound', 'High Probability'],
        })
      }
    }
  }

  return all.sort((a, b) => b.score - a.score)
}
