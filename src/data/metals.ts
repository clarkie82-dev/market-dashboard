import type { DataPoint, RangeKey, SeriesPayload } from './types';
import {
  filterByRange,
  minDailyForRange,
  yahooChartRange,
  yahooRangeNeedsClientFilter,
} from './ranges';
import { loadFredRange, loadFredWithFallback } from './fred';
import { isHourlyGranular, MIN_HOURLY_SHORT_POINTS, sortByTime } from './hourly';

export type MetalLongRangeOpts = {
  yahooSymbol: string;
  fallbackFile: string;
  fredSeriesId: string;
  fredAlternates?: string[];
  /** Preloaded full daily series (avoids repeated JSON fetch). */
  dailySeries?: SeriesPayload;
};

function sortByDate(points: DataPoint[]): DataPoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchYahooDailyChart(
  symbol: string,
  rangeKey: RangeKey,
): Promise<DataPoint[]> {
  const range = yahooChartRange(rangeKey);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; market-dashboard/1.0)' },
  });
  if (!res.ok) throw new Error(`Yahoo daily ${symbol}: ${res.status}`);
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
  if (!points.length) throw new Error(`Yahoo daily ${symbol}: no rows`);
  const sorted = sortByDate(points);
  return yahooRangeNeedsClientFilter(rangeKey)
    ? filterByRange(sorted, rangeKey)
    : sorted;
}

async function loadDailyFallbackJson(file: string): Promise<SeriesPayload> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/${file}`);
  if (!res.ok) throw new Error(`Daily fallback missing: ${file}`);
  const json = (await res.json()) as { points: DataPoint[]; fetchedAt?: string };
  return {
    points: sortByDate(json.points),
    source: 'fallback',
    fetchedAt: json.fetchedAt,
  };
}

export async function loadMetalDailySeries(
  yahooSymbol: string,
  fallbackFile: string,
  fredSeriesId: string,
  fredAlternates: string[] = [],
): Promise<SeriesPayload> {
  try {
    const points = await fetchYahooDailyChart(yahooSymbol, 'max');
    if (points.length >= minDailyForRange('max')) {
      return { points, source: 'live' };
    }
  } catch {
    /* fallback */
  }
  try {
    const fb = await loadDailyFallbackJson(fallbackFile);
    if (fb.points.length >= minDailyForRange('max')) return fb;
  } catch {
    /* fallback */
  }
  const payload = await loadFredWithFallback(
    fredSeriesId,
    fallbackFile,
    undefined,
    fredAlternates,
  );
  return { ...payload, points: sortByDate(payload.points) };
}

export async function loadMetalLongRange(
  opts: MetalLongRangeOpts,
  rangeKey: RangeKey,
): Promise<SeriesPayload> {
  const min = minDailyForRange(rangeKey);

  try {
    const points = await fetchYahooDailyChart(opts.yahooSymbol, rangeKey);
    if (points.length >= min) {
      return { points, source: 'live' };
    }
  } catch {
    /* fallback */
  }

  const daily =
    opts.dailySeries ??
    (await loadMetalDailySeries(
      opts.yahooSymbol,
      opts.fallbackFile,
      opts.fredSeriesId,
      opts.fredAlternates ?? [],
    ));
  const fromCache = filterByRange(daily.points, rangeKey);
  if (fromCache.length >= min) {
    return {
      points: fromCache,
      source: daily.source,
      fetchedAt: daily.fetchedAt,
    };
  }

  return loadFredRange(opts.fredSeriesId, opts.fallbackFile, rangeKey);
}

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
  const daily = await loadMetalDailySeries(
    yahooSymbol,
    dailyFallbackFile,
    fredSeriesId,
    fredAlternates,
  );

  const longOpts: MetalLongRangeOpts = {
    yahooSymbol,
    fallbackFile: dailyFallbackFile,
    fredSeriesId,
    fredAlternates,
    dailySeries: daily,
  };

  const [liveSettled, fbSettled, long] = await Promise.all([
    Promise.allSettled([fetchYahooHourly7d(yahooSymbol)]).then((r) => r[0]!),
    Promise.allSettled([loadHourlyFallback(base, hourlyFallbackFile)]).then((r) => r[0]!),
    loadMetalLongRange(longOpts, rangeKey),
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

  return { short, long, daily };
}
