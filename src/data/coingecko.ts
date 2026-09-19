import type { DataPoint, RangeKey, SeriesPayload } from './types';
import { coingeckoDays, filterByRange } from './ranges';

type MarketChartResponse = { prices: [number, number][] };

const MIN_HOURLY_SHORT_POINTS = 48;

function toPoints(prices: [number, number][]): DataPoint[] {
  return prices.map(([ts, value]) => ({
    time: ts,
    date: new Date(ts).toISOString().slice(0, 10),
    value,
  }));
}

function sortByTime(points: DataPoint[]): DataPoint[] {
  return [...points].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

/** CoinGecko free tier often returns ~1 point/day for days=7 despite a 200 OK. */
function isHourlyGranular(points: DataPoint[]): boolean {
  if (points.length < MIN_HOURLY_SHORT_POINTS) return false;
  const withTime = points.filter((p) => p.time != null);
  if (withTime.length < MIN_HOURLY_SHORT_POINTS) return false;
  const sorted = sortByTime(withTime);
  let smallGaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i]!.time! - sorted[i - 1]!.time!) / (60 * 60 * 1000);
    if (gap > 0 && gap <= 2) smallGaps++;
  }
  return smallGaps >= 24;
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
  if (shortDays === '7') {
    const [liveSettled, fbSettled] = await Promise.allSettled([
      fetchCoinGeckoShort(id),
      loadShortFallback(base, file7d),
    ]);
    const live = liveSettled.status === 'fulfilled' ? sortByTime(liveSettled.value) : [];
    const fb =
      fbSettled.status === 'fulfilled'
        ? { ...fbSettled.value, points: sortByTime(fbSettled.value.points) }
        : null;

    if (isHourlyGranular(live)) {
      shortPayload = { points: live, source: 'live' };
    } else if (fb && fb.points.length >= MIN_HOURLY_SHORT_POINTS) {
      shortPayload = fb;
    } else if (live.length) {
      shortPayload = { points: live, source: 'live' };
    } else if (fb) {
      shortPayload = fb;
    } else {
      shortPayload = { points: full.slice(-48), source, fetchedAt };
    }
  } else {
    try {
      const points = sortByTime(await fetchCoinGecko(id, shortDays));
      shortPayload = { points, source: 'live' };
    } catch {
      try {
        shortPayload = await loadShortFallback(base, file7d);
      } catch {
        shortPayload = { points: full.slice(-48), source, fetchedAt };
      }
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
