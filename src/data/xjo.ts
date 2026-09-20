import type { DataPoint, RangeKey, SeriesPayload } from './types';
import { filterByRange } from './ranges';
import { fetchYahooHourly7d } from './metals';
import { isHourlyGranular, MIN_HOURLY_SHORT_POINTS, sortByTime } from './hourly';

const XJO_YAHOO = '^AXJO';
const HOURLY_FALLBACK = 'xjo-7d.json';

export async function loadXjo(rangeKey: RangeKey): Promise<SeriesPayload> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/xjo.json`);
  if (!res.ok) throw new Error('ASX 200 data unavailable (run fetch-data or CI)');
  const json = (await res.json()) as { points: DataPoint[]; fetchedAt?: string };
  return {
    points: filterByRange(json.points, rangeKey),
    source: 'fallback',
    fetchedAt: json.fetchedAt,
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
): Promise<{ short: SeriesPayload; long: SeriesPayload }> {
  const base = import.meta.env.BASE_URL;
  const [long, liveSettled, fbSettled] = await Promise.all([
    loadXjo(rangeKey),
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
      points: long.points.slice(-48),
      source: long.source,
      fetchedAt: long.fetchedAt,
    };
  }

  return { short, long };
}
