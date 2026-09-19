import './styles.css';
import { FRED_SERIES, loadFredRange, loadFredWithFallback } from './data/fred';
import { loadCoinGecko, reloadCoinGeckoLong } from './data/coingecko';
import { loadFearGreed } from './data/fearGreed';
import { goldSilverRatio } from './data/ratio';
import { loadXjo } from './data/xjo';
import { lastNDays, filterByRange } from './data/ranges';
import { createMetricPanel } from './components/metricPanel';
import { createFearGreedPanel } from './components/fearGreedDial';
import { createTreasuryBlock } from './components/treasuryBlock';

const app = document.querySelector<HTMLElement>('#app')!;

async function init() {
  const loading = document.createElement('p');
  loading.textContent = 'Loading market data…';
  app.appendChild(loading);

  try {
    const [fng, sp, ndq, btc, eth, gold, silver, xjo] = await Promise.all([
      loadFearGreed(),
      loadFredWithFallback(FRED_SERIES.sp500, 'sp500.json'),
      loadFredWithFallback(FRED_SERIES.nasdaq, 'nasdaq.json'),
      loadCoinGecko('bitcoin', 'bitcoin.json', '6m', '7'),
      loadCoinGecko('ethereum', 'ethereum.json', '6m', '7'),
      loadFredWithFallback(FRED_SERIES.gold, 'gold.json', undefined, [
        'GOLDAMGBD228NLBM',
      ]),
      loadFredWithFallback(FRED_SERIES.silver, 'silver.json', undefined, []),
      loadXjo('6m'),
    ]);

    loading.remove();

    createMetricPanel(app, lastNDays(sp.points, 30), { ...sp, points: filterByRange(sp.points, '6m') }, {
      title: 'S&P 500 (SPX) — USD',
      yLabel: 'Index',
      onRangeChange: (k) => loadFredRange(FRED_SERIES.sp500, 'sp500.json', k),
    });

    createMetricPanel(app, lastNDays(ndq.points, 30), { ...ndq, points: filterByRange(ndq.points, '6m') }, {
      title: 'NASDAQ — USD',
      yLabel: 'Index',
      onRangeChange: (k) => loadFredRange(FRED_SERIES.nasdaq, 'nasdaq.json', k),
    });

    createMetricPanel(
      app,
      btc.short.points,
      btc.long,
      {
        title: 'Bitcoin — USD',
        yLabel: 'USD',
        shortLabel: 'Last 7 days (hourly)',
        shortFilterHours: 168,
        shortTimeUnit: 'hour',
        onRangeChange: (k) => reloadCoinGeckoLong('bitcoin', 'bitcoin.json', k),
      },
      btc.short,
    );

    createMetricPanel(
      app,
      eth.short.points,
      eth.long,
      {
        title: 'Ethereum — USD',
        yLabel: 'USD',
        shortLabel: 'Last 7 days (hourly)',
        shortFilterHours: 168,
        shortTimeUnit: 'hour',
        onRangeChange: (k) => reloadCoinGeckoLong('ethereum', 'ethereum.json', k),
      },
      eth.short,
    );

    createFearGreedPanel(app, fng);

    createMetricPanel(app, lastNDays(gold.points, 30), { ...gold, points: filterByRange(gold.points, '6m') }, {
      title: 'Gold — USD',
      yLabel: 'USD / oz',
      onRangeChange: (k) => loadFredRange(FRED_SERIES.gold, 'gold.json', k),
    });

    createMetricPanel(app, lastNDays(silver.points, 30), { ...silver, points: filterByRange(silver.points, '6m') }, {
      title: 'Silver — USD',
      yLabel: 'USD / oz',
      onRangeChange: (k) => loadFredRange(FRED_SERIES.silver, 'silver.json', k),
    });

    const ratioFull = goldSilverRatio(gold.points, silver.points);
    createMetricPanel(
      app,
      lastNDays(ratioFull, 30),
      { points: filterByRange(ratioFull, '6m'), source: gold.source, fetchedAt: gold.fetchedAt },
      {
        title: 'Gold / Silver ratio',
        onRangeChange: async (k) => {
          const [g, s] = await Promise.all([
            loadFredRange(FRED_SERIES.gold, 'gold.json', k),
            loadFredRange(FRED_SERIES.silver, 'silver.json', k),
          ]);
          return {
            points: goldSilverRatio(g.points, s.points),
            source: g.source,
            fetchedAt: g.fetchedAt,
          };
        },
      },
    );

    await createTreasuryBlock(app);

    createMetricPanel(app, lastNDays(xjo.points, 30), xjo, {
      title: 'ASX 200 (XJO) — AUD',
      yLabel: 'Index',
      onRangeChange: (k) => loadXjo(k),
    });
  } catch (e) {
    loading.textContent = e instanceof Error ? e.message : 'Failed to load dashboard';
    loading.classList.add('error');
  }
}

init();
