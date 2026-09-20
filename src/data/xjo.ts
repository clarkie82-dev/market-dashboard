import type { DataPoint, RangeKey, SeriesPayload } from './types';
import { filterByRange } from './ranges';
import {
  fetchYahooDailyChart,
  fetchYahooDailyDense,
  fetchYahooHourly7d,
  isValidDailyRangeSlice,
  isValidDailySeries,
  pickDensest,
} from './metals';
import { isHourlyGranular, MIN_HOURLY_SHORT_POINTS, sortByTime } from './hourly';

const XJO_YAHOO = '^AXJO';
const DAILY_FALLBACK = 'xjo.json';
const HOURLY_FALLBACK = 'xjo-7d.json';

function sortByDate(points: DataPoint[]): DataPoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date));
}

async function loadXjoFallbackJson(): Promise<SeriesPayload> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/${DAILY_FALLBACK}`);
  if (!res.ok) throw new Error('ASX 200 data unavailable (run fetch-data or CI)');
  const json = (await res.json()) as { points: DataPoint[]; fetchedAt?: string };
  return {
    points: sortByDate(json.points),
    source: 'fallback',
    fetchedAt: json.fetchedAt,
  };
}

/** Full daily series for long-range slices (Yahoo dense or validated JSON). */
export async function loadXjoDailySeries(): Promise<SeriesPayload> {
  try {
    const points = await fetchYahooDailyDense(XJO_YAHOO);
    return { points, source: 'live' };
  } catch {
    /* fallback */
  }
  try {
    const fb = await loadXjoFallbackJson();
    if (isValidDailySeries(fb.points)) return fb;
    return fb;
  } catch {
    /* fallback */
  }
  throw new Error('ASX 200 daily series unavailable');
}

export async function loadXjoLongRange(
  rangeKey: RangeKey,
  dailySeries?: SeriesPayload,
): Promise<SeriesPayload> {
  const candidates: SeriesPayload[] = [];

  try {
    const points = await fetchYahooDailyChart(XJO_YAHOO, rangeKey);
    if (isValidDailyRangeSlice(points, rangeKey)) {
      candidates.push({ points, source: 'live' });
    }
  } catch {
    /* fallback */
  }

  const daily = dailySeries ?? (await loadXjoDailySeries());
  if (isValidDailySeries(daily.points)) {
    const fromDaily = filterByRange(daily.points, rangeKey);
    if (fromDaily.length > 0) {
      candidates.push({
        points: fromDaily,
        source: daily.source,
        fetchedAt: daily.fetchedAt,
      });
    }
  }

  try {
    const fb = await loadXjoFallbackJson();
    const slice = filterByRange(fb.points, rangeKey);
    if (slice.length > 0 && isValidDailyRangeSlice(slice, rangeKey)) {
      candidates.push({
        points: slice,
        source: 'fallback',
        fetchedAt: fb.fetchedAt,
      });
    }
  } catch {
    /* fallback */
  }

  const best = pickDensest(candidates);
  if (best) return best;

  return loadXjo(rangeKey);
}

/** Legacy JSON-only loader (sparse fallback). */
export async function loadXjo(rangeKey: RangeKey): Promise<SeriesPayload> {
  const fb = await loadXjoFallbackJson();
  return {
    points: filterByRange(fb.points, rangeKey),
    source: 'fallback',
    fetchedAt: fb.fetchedAt,
  };
}

async function loadHourlyFallback(base: string): Promise<SeriesPayload> {
  const res = await fetch(`${base}data/${HOURLY_FALLBACK}`);
  if (!res.ok) throw new Error(`Hourly fallback missing: ${HOURLY_FALLBACK}`);
  const json = (await res.json()) as { points: DataPoint[]; fetchedAt?: string };
  return { points: json.points, source: 'fallback', fetchedAt: json.fetchedAt };
}

export async function loadXjoPair(
  rangeKey: RangeKey = '6m',
): Promise<{ short: SeriesPayload; long: SeriesPayload; daily: SeriesPayload }> {
  const base = import.meta.env.BASE_URL;
  const daily = await loadXjoDailySeries();

  const [long, liveSettled, fbSettled] = await Promise.all([
    loadXjoLongRange(rangeKey, daily),
    Promise.allSettled([fetchYahooHourly7d(XJO_YAHOO)]).then((r) => r[0]!),
    Promise.allSettled([loadHourlyFallback(base)]).then((r) => r[0]!),
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
