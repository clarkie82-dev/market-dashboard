# Market Dashboard

Basic finance dashboard: indices, crypto, metals, US Treasury yields (with yield curve), and ASX 200. Data loads once when you open the page (no auto-refresh).

Live site: https://clarkie82-dev.github.io/market-dashboard/

## Local development

```bash
npm install
npm run fetch-data   # optional but recommended (ASX 200 + fallbacks)
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Run `fetch-data` once if you need offline fallbacks or are testing without live API access.

## Build

```bash
npm run fetch-data
npm run build
npm run preview
```

On Windows, if the project lives under a path with an apostrophe (e.g. `Clark's`), Vite’s production build can fail. Use a path without special characters or build via GitHub Actions (recommended).

`vite.config.ts` sets `base: '/market-dashboard/'` for project Pages. If your repo name differs, change `base` to match.

## GitHub Pages

1. Push this repo to GitHub (public), default branch `main`.
2. **Settings → Pages → Build and deployment**: Source = **GitHub Actions**.
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow). The workflow runs `fetch-market-data`, builds, and deploys.
4. A daily cron (06:00 UTC) refreshes cached JSON under `public/data/`.

No API keys are required. The deploy workflow runs [`scripts/fetch-market-data.mjs`](scripts/fetch-market-data.mjs) (same as `npm run fetch-data`).

## Data sources

In the **browser**, each metric tries **live APIs first**, then same-origin JSON from `public/data/` (bundled on deploy). **CI** refreshes those JSON files using the provider chains below; failed fetches keep the previous file when it is still valid.

### Historical / daily series

| Metric | Live in browser (try order) | Fallback JSON |
|--------|-----------------------------|---------------|
| S&P 500 | FRED CSV `SP500` | `sp500.json` |
| NASDAQ | FRED CSV `NASDAQCOM` | `nasdaq.json` |
| Bitcoin (long) | CoinGecko market chart | `bitcoin.json` |
| Ethereum (long) | CoinGecko market chart | `ethereum.json` |
| Gold | Yahoo daily `GC=F` → FRED `GOLDAMGBD228NLBM` / `GOLDPMGBD228NLBM` | `gold.json` |
| Silver | Yahoo daily `SI=F` → FRED `SLVPRUSD` | `silver.json` |
| ASX 200 | Yahoo daily `^AXJO` | `xjo.json` |
| Gold / Silver ratio | Derived from gold + silver daily series | — |
| Treasury yields & curve | FRED `DGS3MO`, `DGS5`, `DGS10`, `DGS20`, `DGS30` | `treasury.json` |
| Fear & Greed | [alternative.me](https://alternative.me/crypto/fear-and-greed-index/) API | `fear-greed.json` |

### Short charts (7-day hourly where applicable)

| Metric | Live in browser (try order) | Fallback JSON |
|--------|-----------------------------|---------------|
| Bitcoin | CoinGecko ~7d (hourly when available) | `bitcoin-7d.json` |
| Ethereum | CoinGecko ~7d (hourly when available) | `ethereum-7d.json` |
| Gold / Silver / ASX 200 | Yahoo 1h / 7d on `GC=F`, `SI=F`, `^AXJO` | `gold-7d.json`, `silver-7d.json`, `xjo-7d.json` |

### CI fetch script (`fetch-market-data.mjs`)

Provider order when **writing** cache files (browser logic may differ slightly but uses the same symbols):

| Output file | Fetch order |
|-------------|-------------|
| `sp500.json`, `nasdaq.json` | FRED |
| `gold.json` | Yahoo `GC=F` → FRED `GOLDPMGBD228NLBM` → Stooq `xauusd` |
| `silver.json` | Yahoo `SI=F` → FRED `SLVPRUSD` → Stooq `xagususd` |
| `xjo.json` | Yahoo `^AXJO` (dense daily) → Stooq `xjo.au` → Stooq `^axjo` |
| `bitcoin.json`, `ethereum.json` | CoinGecko → Stooq `btcusd` / `ethusd` |
| `bitcoin-7d.json`, `ethereum-7d.json` | Binance hourly → CoinGecko 7d → Yahoo `BTC-USD` / `ETH-USD` |
| `gold-7d.json`, `silver-7d.json`, `xjo-7d.json` | Yahoo hourly 7d |
| `treasury.json` | FRED per maturity (partial refresh keeps prior series on failure) |
| `fear-greed.json` | alternative.me |

Fear & Greed: attribution to alternative.me is shown on the page per their API terms.

## Cached data (`public/data/`)

The JSON files under `public/data/` are **tracked in git** as shared fallbacks when live API calls fail in the browser. They are also the baseline for CI’s `writeJsonOrKeepCache` logic when a fetch step fails during deploy.

**Production freshness** comes from GitHub Actions: every push to `main` and the daily cron run `fetch-market-data` before build. You do not need to commit local fetch output for the live site to update.

**Local workflow**

1. Run `npm run fetch-data` when you want fresh fallbacks for offline dev or testing the fetch script.
2. Do **not** include `public/data/*.json` in feature commits unless you intentionally refresh the shared snapshot (e.g. new metric file or fetch-script change).
3. After local fetch, discard incidental diffs: `npm run restore-data-cache` (same as `git restore public/data/`).

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — TypeScript check + production build
- `npm run fetch-data` — Refresh `public/data/` from external APIs (local dev; not required for Pages deploy)
- `npm run restore-data-cache` — Reset `public/data/` to last committed versions
