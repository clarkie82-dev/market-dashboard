import type { DataPoint, RangeKey, SeriesPayload } from './types';
import { filterByRange } from './ranges';
import { loadFredWithFallback } from './fred';
import { isHourlyGranular, MIN_HOURLY_SHORT_POINTS, sortByTime } from './hourly';

export async function fetchYahooHourly7d(symbol: string): Promise<DataPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1h&range=7d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Yahoo hourly ${symbol}: ${res.status}`);
  const json = (await res.json()) as {
    chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
  };
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const points: DataPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    const time = timestamps[i]! * 1000;
    points.push({
      time,
      date: new Date(time).toISOString().slice(0, 10),
      value: c,
    });
  }
  if (points.length < 24) throw new Error(`Yahoo hourly ${symbol}: too few rows`);
  return points;
}

async function loadHourlyFallback(base: string, file: string): Promise<SeriesPayload> {
  const res = await fetch(`${base}data/${file}`);
  if (!res.ok) throw new Error(`Hourly fallback missing: ${file}`);
  const json = (await res.json()) as { points: DataPoint[]; fetchedAt?: string };
  return { points: json.points, source: 'fallback', fetchedAt: json.fetchedAt };
}

export async function loadMetalPair(
  fredSeriesId: string,
  dailyFallbackFile: string,
  hourlyFallbackFile: string,
  yahooSymbol: string,
  fredAlternates: string[] = [],
  rangeKey: RangeKey = '6m',
): Promise<{ short: SeriesPayload; long: SeriesPayload; daily: SeriesPayload }> {
  const base = import.meta.env.BASE_URL;
  const daily = await loadFredWithFallback(
    fredSeriesId,
    dailyFallbackFile,
    undefined,
    fredAlternates,
  );

  const [liveSettled, fbSettled] = await Promise.allSettled([
    fetchYahooHourly7d(yahooSymbol),
    loadHourlyFallback(base, hourlyFallbackFile),
  ]);
  const live = liveSettled.status === 'fulfilled' ? sortByTime(liveSettled.value) : [];
  const fb =
    fbSettled.status === 'fulfilled'
      ? { ...fbSettled.value, points: sortByTime(fbSettled.value.points) }
      : null;

  let short: SeriesPayload;
  if (isHourlyGranular(live)) {
    short = { points: live, source: 'live' };
  } else if (fb && fb.points.length >= MIN_HOURLY_SHORT_POINTS) {
    short = fb;
  } else if (live.length) {
    short = { points: live, source: 'live' };
  } else if (fb) {
    short = fb;
  } else {
    short = {
      points: daily.points.slice(-48),
      source: daily.source,
      fetchedAt: daily.fetchedAt,
    };
  }

  return {
    short,
    long: {
      points: filterByRange(daily.points, rangeKey),
      source: daily.source,
      fetchedAt: daily.fetchedAt,
    },
    daily,
  };
}
