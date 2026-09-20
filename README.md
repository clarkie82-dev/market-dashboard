# Market Dashboard

Basic finance dashboard: indices, crypto, metals, US Treasury yields (with yield curve), and ASX 200. Data loads once when you open the page (no auto-refresh).

Live site: https://clarkie82-dev.github.io/market-dashboard/

## Local development

```bash
npm install
npm run fetch-data   # optional but recommended (ASX 200 + fallbacks)
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). For ASX 200 and offline fallbacks, run `fetch-data` first so `public/data/*.json` exists.

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
4. A daily cron (06:00 UTC) refreshes cached JSON used for fallbacks and ASX 200.

No API keys are required. The workflow fetches from FRED CSV, CoinGecko, Alternative.me, and Stooq server-side.

## Data sources

| Metric | Primary | Fallback |
|--------|---------|----------|
| S&P 500, NASDAQ | FRED (`SP500`, `NASDAQCOM`) | `public/data/*.json` |
| BTC, ETH | CoinGecko | JSON from CI |
| Fear & Greed | [alternative.me](https://alternative.me/crypto/fear-and-greed-index/) | JSON from CI |
| Gold | Stooq `xauusd` (CI) / FRED if available in browser | JSON from CI |
| Silver | FRED `SLVPRUSD` or Stooq `xagususd` (CI) | JSON from CI |
| Gold/Silver ratio | Derived | — |
| Treasury yields & curve | FRED (`DGS3MO`, `DGS5`, `DGS10`, `DGS20`, `DGS30`) | JSON from CI |
| ASX 200 | Stooq via CI | `public/data/xjo.json` |

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
