import './styles.css';
import { FRED_SERIES, loadFredRange, loadFredWithFallback } from './data/fred';
import { loadCoinGecko, reloadCoinGeckoLong } from './data/coingecko';
import { loadMetalLongRange, loadMetalPair, type MetalLongRangeOpts } from './data/metals';
import { loadFearGreed } from './data/fearGreed';
import { goldSilverRatio } from './data/ratio';
import { loadXjoLongRange, loadXjoPair } from './data/xjo';
import { lastNDays, filterByRange } from './data/ranges';
import { createMetricPanel } from './components/metricPanel';
import { createFearGreedPanel } from './components/fearGreedDial';
import { createTreasuryBlock } from './components/treasuryBlock';
import { cardTitleWithSpot } from './format/usdSpot';
import {
  BITCOIN_ORANGE,
  ETHEREUM_DARK_PURPLE,
  GOLD,
  NASDAQ_TEAL,
  SILVER,
  SP_GLOBAL_RED,
} from './charts/seriesColors';

const app = document.querySelector<HTMLElement>('#app')!;

const goldLongOpts: MetalLongRangeOpts = {
  yahooSymbol: 'GC=F',
  fallbackFile: 'gold.json',
  fredSeriesId: FRED_SERIES.gold,
  fredAlternates: ['GOLDAMGBD228NLBM'],
};

const silverLongOpts: MetalLongRangeOpts = {
  yahooSymbol: 'SI=F',
  fallbackFile: 'silver.json',
  fredSeriesId: FRED_SERIES.silver,
};

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
      loadMetalPair(FRED_SERIES.gold, 'gold.json', 'gold-7d.json', 'GC=F', [
        'GOLDAMGBD228NLBM',
      ]),
      loadMetalPair(FRED_SERIES.silver, 'silver.json', 'silver-7d.json', 'SI=F'),
      loadXjoPair('6m'),
    ]);

    loading.remove();

    createMetricPanel(app, lastNDays(sp.points, 30), { ...sp, points: filterByRange(sp.points, '6m') }, {
      title: 'S&P 500 (SPX)',
      lineColor: SP_GLOBAL_RED,
      yLabel: 'Index',
      onRangeChange: (k) => loadFredRange(FRED_SERIES.sp500, 'sp500.json', k),
    });

    createMetricPanel(app, lastNDays(ndq.points, 30), { ...ndq, points: filterByRange(ndq.points, '6m') }, {
      title: 'NASDAQ',
      lineColor: NASDAQ_TEAL,
      yLabel: 'Index',
      onRangeChange: (k) => loadFredRange(FRED_SERIES.nasdaq, 'nasdaq.json', k),
    });

    createMetricPanel(
      app,
      btc.short.points,
      btc.long,
      {
        title: 'Bitcoin — USD',
        cardTitle: cardTitleWithSpot('Bitcoin — USD', btc.short.points, btc.long.points),
        lineColor: BITCOIN_ORANGE,
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
        cardTitle: cardTitleWithSpot('Ethereum — USD', eth.short.points, eth.long.points),
        lineColor: ETHEREUM_DARK_PURPLE,
        yLabel: 'USD',
        shortLabel: 'Last 7 days (hourly)',
        shortFilterHours: 168,
        shortTimeUnit: 'hour',
        onRangeChange: (k) => reloadCoinGeckoLong('ethereum', 'ethereum.json', k),
      },
      eth.short,
    );

    createFearGreedPanel(app, fng);

    createMetricPanel(
      app,
      gold.short.points,
      gold.long,
      {
        title: 'Gold — USD',
        cardTitle: cardTitleWithSpot('Gold — USD', gold.short.points, gold.long.points),
        lineColor: GOLD,
        yLabel: 'USD / oz',
        shortFilterHours: 168,
        shortCondenseSequential: true,
        onRangeChange: (k) =>
          loadMetalLongRange({ ...goldLongOpts, dailySeries: gold.daily }, k),
      },
      gold.short,
    );

    createMetricPanel(
      app,
      silver.short.points,
      silver.long,
      {
        title: 'Silver — USD',
        cardTitle: cardTitleWithSpot('Silver — USD', silver.short.points, silver.long.points),
        lineColor: SILVER,
        yLabel: 'USD / oz',
        shortFilterHours: 168,
        shortCondenseSequential: true,
        onRangeChange: (k) =>
          loadMetalLongRange({ ...silverLongOpts, dailySeries: silver.daily }, k),
      },
      silver.short,
    );

    const ratioFull = goldSilverRatio(gold.daily.points, silver.daily.points);
    createMetricPanel(
      app,
      lastNDays(ratioFull, 30),
      {
        points: filterByRange(ratioFull, '6m'),
        source: gold.daily.source,
        fetchedAt: gold.daily.fetchedAt,
      },
      {
        title: 'Gold / Silver ratio',
        historicalRangeAverage: true,
        onRangeChange: async (k) => {
          const [g, s] = await Promise.all([
            loadMetalLongRange({ ...goldLongOpts, dailySeries: gold.daily }, k),
            loadMetalLongRange({ ...silverLongOpts, dailySeries: silver.daily }, k),
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

    createMetricPanel(
      app,
      xjo.short.points,
      xjo.long,
      {
        title: 'ASX 200 (XJO)',
        lineColor: SP_GLOBAL_RED,
        yLabel: 'Index',
        shortFilterHours: 168,
        shortCondenseSequential: true,
        onRangeChange: (k) => loadXjoLongRange(k, xjo.daily),
      },
      xjo.short,
    );
  } catch (e) {
    loading.textContent = e instanceof Error ? e.message : 'Failed to load dashboard';
    loading.classList.add('error');
  }
}

init();
