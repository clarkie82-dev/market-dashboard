import type { DataPoint, RangeKey, SeriesPayload } from './types';
import { coingeckoDays, filterByRange } from './ranges';

type MarketChartResponse = { prices: [number, number][] };

function toPoints(prices: [number, number][]): DataPoint[] {
  return prices.map(([ts, value]) => ({
    time: ts,
    date: new Date(ts).toISOString().slice(0, 10),
    value,
  }));
}

export async function fetchCoinGecko(id: string, days: string): Promise<DataPoint[]> {
  const params = new URLSearchParams({ vs_currency: 'usd', days });
  if (days !== '1' && days !== 'max' && parseInt(days, 10) > 90) {
    params.set('interval', 'daily');
  }
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${id}: ${res.status}`);
  const json = (await res.json()) as MarketChartResponse;
  return toPoints(json.prices ?? []);
}

async function fetchCoinGeckoShort(id: string): Promise<DataPoint[]> {
  const attempts = [
    new URLSearchParams({ vs_currency: 'usd', days: '7', interval: 'hourly' }),
    new URLSearchParams({ vs_currency: 'usd', days: '7' }),
  ];
  for (const params of attempts) {
    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?${params}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const json = (await res.json()) as MarketChartResponse;
    const points = toPoints(json.prices ?? []);
    if (points.length) return points;
  }
  throw new Error(`CoinGecko ${id} short: all attempts failed`);
}

async function loadShortFallback(base: string, file7d: string): Promise<SeriesPayload> {
  const res = await fetch(`${base}data/${file7d}`);
  if (!res.ok) throw new Error(`CoinGecko 7d fallback missing: ${file7d}`);
  const json = (await res.json()) as { points: DataPoint[]; fetchedAt?: string };
  return { points: json.points, source: 'fallback', fetchedAt: json.fetchedAt };
}

export async function loadCoinGecko(
  id: string,
  fallbackFile: string,
  rangeKey: RangeKey,
  shortDays: string = '1',
  fallback7dFile?: string,
): Promise<{ short: SeriesPayload; long: SeriesPayload }> {
  const base = import.meta.env.BASE_URL;
  const file7d = fallback7dFile ?? fallbackFile.replace('.json', '-7d.json');
  let full: DataPoint[] = [];
  let source: 'live' | 'fallback' = 'live';
  let fetchedAt: string | undefined;

  try {
    full = await fetchCoinGecko(id, coingeckoDays(rangeKey));
  } catch {
    const res = await fetch(`${base}data/${fallbackFile}`);
    if (!res.ok) throw new Error(`CoinGecko fallback missing: ${fallbackFile}`);
    const json = (await res.json()) as { points: DataPoint[]; fetchedAt?: string };
    full = json.points;
    source = 'fallback';
    fetchedAt = json.fetchedAt;
  }

  let shortPayload: SeriesPayload;
  try {
    const points =
      shortDays === '7' ? await fetchCoinGeckoShort(id) : await fetchCoinGecko(id, shortDays);
    shortPayload = { points, source: 'live' };
  } catch {
    try {
      shortPayload = await loadShortFallback(base, file7d);
    } catch {
      const last = full.slice(-48);
      shortPayload = { points: last, source, fetchedAt };
    }
  }

  return {
    short: shortPayload,
    long: {
      points: filterByRange(full, rangeKey),
      source,
      fetchedAt,
    },
  };
}

export async function reloadCoinGeckoLong(
  id: string,
  fallbackFile: string,
  rangeKey: RangeKey,
): Promise<SeriesPayload> {
  try {
    const points = await fetchCoinGecko(id, coingeckoDays(rangeKey));
    return { points: filterByRange(points, rangeKey), source: 'live' };
  } catch {
    const base = import.meta.env.BASE_URL;
    const res = await fetch(`${base}data/${fallbackFile}`);
    if (!res.ok) throw new Error(`Fallback missing`);
    const json = (await res.json()) as { points: DataPoint[]; fetchedAt?: string };
    return {
      points: filterByRange(json.points, rangeKey),
      source: 'fallback',
      fetchedAt: json.fetchedAt,
    };
  }
}
