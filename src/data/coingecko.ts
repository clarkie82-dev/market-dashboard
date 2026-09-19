import type { DataPoint, RangeKey, SeriesPayload } from './types';
import { coingeckoDays, filterByRange } from './ranges';

type MarketChartResponse = { prices: [number, number][] };

function toPoints(prices: [number, number][]): DataPoint[] {
  return prices.map(([ts, value]) => ({
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

export async function loadCoinGecko(
  id: string,
  fallbackFile: string,
  rangeKey: RangeKey,
  shortDays: string = '1',
): Promise<{ short: SeriesPayload; long: SeriesPayload }> {
  const base = import.meta.env.BASE_URL;
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

  let shortPoints: DataPoint[];
  try {
    shortPoints = await fetchCoinGecko(id, shortDays);
  } catch {
    const last = full.slice(-48);
    shortPoints = last;
  }

  return {
    short: { points: shortPoints, source, fetchedAt },
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
