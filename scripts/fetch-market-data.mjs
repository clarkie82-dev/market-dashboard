import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'data');

const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
const today = new Date().toISOString().slice(0, 10);
const fetchedAt = new Date().toISOString();

function parseFredCsv(text, seriesId) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const dateIdx = header.findIndex((h) => h.toLowerCase().includes('observation') || h === 'DATE');
  const valIdx = Math.max(header.indexOf(seriesId), header.length - 1);
  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const date = cols[dateIdx >= 0 ? dateIdx : 0]?.trim();
    const raw = cols[valIdx >= 0 ? valIdx : 1]?.trim();
    if (!date || !raw || raw === '.') continue;
    const value = parseFloat(raw);
    if (Number.isFinite(value)) points.push({ date, value });
  }
  return points;
}

async function fetchFred(seriesId, cosd = '1950-01-01', coed = today) {
  const url = `${FRED_CSV}?id=${encodeURIComponent(seriesId)}&cosd=${cosd}&coed=${coed}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status}`);
  return parseFredCsv(await res.text(), seriesId);
}

async function fetchStooq(symbol) {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'market-dashboard-fetch/1.0' } });
  if (!res.ok) throw new Error(`Stooq ${symbol}: ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, , , , close] = lines[i].split(',');
    if (!date || !close) continue;
    const value = parseFloat(close);
    if (Number.isFinite(value)) points.push({ date, value });
  }
  const sorted = points.sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length) return sorted;
  throw new Error(`Stooq ${symbol}: no rows`);
}

async function fetchYahooChart(symbol, range = 'max') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; market-dashboard/1.0)' },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const points = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    points.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      value: c,
    });
  }
  if (!points.length) throw new Error(`Yahoo ${symbol}: no rows`);
  return points;
}

async function fetchSeriesWithFallback(providers) {
  let lastErr;
  for (const fn of providers) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('All providers failed');
}

async function fetchCoinGecko(id) {
  const attempts = [
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=365&interval=daily`,
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=30`,
  ];
  for (const url of attempts) {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const points = (json.prices ?? []).map(([ts, value]) => ({
        date: new Date(ts).toISOString().slice(0, 10),
        value,
      }));
      if (points.length) return points;
    }
  }
  throw new Error(`CoinGecko ${id}: all attempts failed`);
}

async function fetchCrypto(id, stooqSymbol) {
  try {
    return await fetchCoinGecko(id);
  } catch (e) {
    console.warn(`CoinGecko ${id} failed, using Stooq ${stooqSymbol}:`, e.message);
    return fetchStooq(stooqSymbol);
  }
}

async function fetchFng() {
  const res = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
  if (!res.ok) throw new Error(`FNG: ${res.status}`);
  const json = await res.json();
  const row = json.data?.[0];
  return {
    value: parseInt(row.value, 10),
    classification: row.value_classification,
    fetchedAt,
  };
}

async function writeJson(name, data) {
  await writeFile(path.join(outDir, name), JSON.stringify(data, null, 0));
  console.log('wrote', name);
}

await mkdir(outDir, { recursive: true });

const fredSeries = {
  sp500: 'SP500',
  nasdaq: 'NASDAQCOM',
};

for (const [file, id] of Object.entries(fredSeries)) {
  await writeJson(`${file}.json`, { points: await fetchFred(id), fetchedAt });
}

await writeJson('gold.json', {
  points: await fetchSeriesWithFallback([
    () => fetchFred('GOLDPMGBD228NLBM'),
    () => fetchYahooChart('GC=F'),
    () => fetchStooq('xauusd'),
  ]),
  fetchedAt,
});
await writeJson('silver.json', {
  points: await fetchSeriesWithFallback([
    () => fetchFred('SLVPRUSD'),
    () => fetchYahooChart('SI=F'),
    () => fetchStooq('xagususd'),
  ]),
  fetchedAt,
});

const treasuryIds = ['DGS3MO', 'DGS5', 'DGS10', 'DGS20', 'DGS30'];
const treasurySeries = {};
for (const id of treasuryIds) {
  treasurySeries[id] = await fetchFred(id);
}
await writeJson('treasury.json', { series: treasurySeries, fetchedAt });

function marketChartToHourlyPoints(prices) {
  return (prices ?? []).map(([ts, value]) => ({
    time: ts,
    date: new Date(ts).toISOString().slice(0, 10),
    value,
  }));
}

async function fetchBinanceHourly(symbol, limit = 168) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=1h&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${symbol}: ${res.status}`);
  const rows = await res.json();
  return rows.map((row) => {
    const time = row[0];
    return {
      time,
      date: new Date(time).toISOString().slice(0, 10),
      value: parseFloat(row[4]),
    };
  });
}

async function fetchCoinGeckoHourly7d(coinId) {
  const attempts = [
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=hourly`,
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7`,
  ];
  for (const url of attempts) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const json = await res.json();
    const points = marketChartToHourlyPoints(json.prices);
    if (points.length >= 48) return points;
  }
  throw new Error(`CoinGecko hourly 7d ${coinId} failed`);
}

async function fetchYahooHourly7d(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1h&range=7d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; market-dashboard/1.0)' },
  });
  if (!res.ok) throw new Error(`Yahoo hourly ${symbol}: ${res.status}`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const points = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    const time = timestamps[i] * 1000;
    points.push({
      time,
      date: new Date(time).toISOString().slice(0, 10),
      value: c,
    });
  }
  if (points.length < 24) throw new Error(`Yahoo hourly ${symbol}: too few rows`);
  return points;
}

async function fetchHourly7d({ coinId, binanceSymbol, yahooSymbol }) {
  return fetchSeriesWithFallback([
    () => fetchBinanceHourly(binanceSymbol),
    () => fetchCoinGeckoHourly7d(coinId),
    () => fetchYahooHourly7d(yahooSymbol),
  ]);
}

await writeJson('bitcoin-7d.json', {
  points: await fetchHourly7d({
    coinId: 'bitcoin',
    binanceSymbol: 'BTCUSDT',
    yahooSymbol: 'BTC-USD',
  }),
  fetchedAt,
});
await writeJson('ethereum-7d.json', {
  points: await fetchHourly7d({
    coinId: 'ethereum',
    binanceSymbol: 'ETHUSDT',
    yahooSymbol: 'ETH-USD',
  }),
  fetchedAt,
});

async function writeMetalHourly7d(file, yahooSymbol) {
  try {
    await writeJson(file, {
      points: await fetchSeriesWithFallback([() => fetchYahooHourly7d(yahooSymbol)]),
      fetchedAt,
    });
  } catch (e) {
    console.warn(`${file} hourly fetch failed:`, e.message);
    await writeJson(file, { points: [], fetchedAt });
  }
}

await writeMetalHourly7d('gold-7d.json', 'GC=F');
await writeMetalHourly7d('silver-7d.json', 'SI=F');

await writeJson('bitcoin.json', { points: await fetchCrypto('bitcoin', 'btcusd'), fetchedAt });
await writeJson('ethereum.json', {
  points: await fetchCrypto('ethereum', 'ethusd'),
  fetchedAt,
});
await writeJson('fear-greed.json', await fetchFng());

await writeJson('xjo.json', {
  points: await fetchSeriesWithFallback([
    () => fetchYahooChart('^AXJO'),
    () => fetchStooq('xjo.au'),
    () => fetchStooq('^axjo'),
  ]),
  fetchedAt,
});

console.log('Done.', fetchedAt);
