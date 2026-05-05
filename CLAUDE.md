# OChain — Developer Checkpoint

Mobile-first Binance Options Intelligence app. React + TypeScript + Vite, deployed on Vercel.

**Live URL:** https://ochain-two.vercel.app  
**GitHub:** https://github.com/yinkavelli/OChain  
**Stack:** React 19, TypeScript, Vite, Tailwind CSS v3, Framer Motion, Recharts, TanStack Query

---

## Architecture

```
src/
  App.tsx                  # Root — tab routing, live data wiring
  components/
    AssetSelector          # Asset pills with live/mock dot indicators
    BottomNav              # 5-tab nav (Dashboard/Screener/Chains/Portfolio/Settings)
    InfoCard               # Bottom sheet info panel (portal, spring animation)
    IVChart                # IV vs HV bar chart (Recharts)
    OptionChainView        # Calls/Puts tabs, scrollable greeks table
    PortfolioView          # Spot balances + options positions (with permissions fallback)
    StatCard               # Tappable metric card → opens InfoCard
    StrategyCard           # Strategy list item with score ring
    StrategyDrawer         # Bottom sheet: payoff diagram + rationale + trade button
    TradeModal             # Multi-leg order builder + confirm flow
    Ticker                 # Scrolling price ticker
    FilterBar / ApiKeySettings / AlertsView / TradeModal
  data/
    mockData.ts            # Fallback data for BNB/SOL/XRP/DOGE + mock strategies
  hooks/
    useLiveData.ts         # React Query wrapper: fetchLiveData → merged assets + strategies
    usePortfolio.ts        # Authenticated hooks: spot account, options positions, orders
  lib/
    binanceApi.ts          # Public data: spot tickers + options chain (exchangeInfo/ticker/mark)
    binanceAuth.ts         # Auth layer: prod → /api/proxy (server signs); dev → client signs
    binancePrivate.ts      # Private endpoints: account, positions, orders, trades
    strategyEngine.ts      # Builds 6 strategy types from live contracts

api/
  proxy.js                 # Vercel serverless function (Singapore sin1)
                           # Signs requests with BINANCE_API_KEY/SECRET env vars
                           # Routes: spot/* → api.binance.com, rest → eapi.binance.com
  eapi/[...path].js        # DEAD — delete this, was never reachable
```

---

## Data Flow

### Public options data (no auth)
```
Browser → /eapi/v1/* (Vite proxy in dev)
        → /api/proxy?p=v1/* (Vercel routes in prod)
        → eapi.binance.com
```

### Spot prices (no auth, CORS ok)
```
Browser → https://api.binance.com/api/v3/ticker/24hr (direct, no proxy)
```

### Authenticated calls (portfolio)
```
Browser → /api/proxy?p=v1/account (prod, no key in browser)
        → Vercel function reads BINANCE_API_KEY + BINANCE_API_SECRET from env
        → Signs with HMAC-SHA256 server-side
        → eapi.binance.com or api.binance.com
```

---

## Environment Variables (Vercel)

| Variable | Purpose |
|---|---|
| `BINANCE_API_KEY` | Binance API key (Read Info permission minimum) |
| `BINANCE_API_SECRET` | Binance API secret |

**Do not set IP restriction** on the Binance key — Vercel's IPs are not static.  
**Do not enable European Options Trading** permission unless you have a VPS with a static IP to whitelist — Binance blocks the `/eapi` authenticated endpoints (account/positions) from non-whitelisted IPs.

**Permissions currently working:** Read Info → spot balances via `/api/v3/account`  
**Permissions blocked by IP requirement:** European Options Trading → `/eapi/v1/account`, `/eapi/v1/position`

---

## Known Issues (from review)

1. **`hasCredentials()` always `true` in prod** — if env vars aren't set, queries fire and return 500s instead of showing the "connect" screen. Fix: add `/api/health` endpoint that checks env vars.

2. **`idCounter` in strategyEngine is mutable module state** — IDs increment on every 30s refresh causing React to re-render all strategy cards. Fix: use stable ID `${asset}-${type}-${expiry}`.

3. **`api/eapi/[...path].js` is dead code** — the catch-all function was never reachable via Vercel routing. Should be deleted.

4. **Upstream URL leaks in 403 responses** — `proxy.js` includes the upstream URL in error JSON. Remove from production responses.

5. **Mock prices flash on first load** — `ASSETS` has hardcoded prices that show briefly before live data arrives.

---

## Proxy Routing (vercel.json)

```json
{
  "functions": { "api/proxy.js": { "regions": ["sin1"] } },
  "routes": [{ "src": "/eapi/v1/(.*)", "dest": "/api/proxy?p=v1/$1" }]
}
```

- `regions: ["sin1"]` — Singapore required, Binance blocks US IPs (451)
- Vite dev proxy (`/eapi → eapi.binance.com`) handles local development
- `redirect: 'manual'` in proxy prevents Binance redirect-to-error-page from returning HTML to client

---

## Strategy Engine

Builds 6 strategy types from live BTC/ETH contracts:
- **Covered Call** — short 5% OTM call, income play
- **Cash-Secured Put** — short 5% OTM put, income play  
- **Bull Call Spread** — ATM long / 6% OTM short
- **Bear Put Spread** — ATM long / 6% OTM short
- **Long Straddle** — ATM call + put, volatility play
- **Iron Condor** — 7% OTM short strangle + 12% OTM long wings

Score formula: `(PoP × 0.5) + (R/R capped at 3× × 0.3) + (DTE in 14–45 range × 0.2) × 100`

---

## Options Data Availability

| Asset | Spot Price | Option Chain | Strategies |
|---|---|---|---|
| BTC | ✅ Live | ✅ Live (Binance eapi) | ✅ Live |
| ETH | ✅ Live | ✅ Live (Binance eapi) | ✅ Live |
| BNB | ✅ Live | ❌ No Binance options | Mock |
| SOL | ✅ Live | ❌ No Binance options | Mock |
| XRP | ✅ Live | ❌ No Binance options | Mock |
| DOGE | ✅ Live | ❌ No Binance options | Mock |

Binance European Options only lists BTC and ETH contracts.

---

## Next Steps (prioritised)

1. Fix strategy ID stability (breaks list reconciliation on refresh)
2. Delete `api/eapi/[...path].js`
3. Add `/api/health` + fix `hasCredentials()` in prod
4. VPS self-hosted proxy → unlocks options positions/P&L in portfolio
5. Real-time WebSocket price updates (currently 30s REST polling)
6. Black-Scholes IV calculator for non-eapi assets
