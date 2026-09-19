import type { DataPoint, RangeKey, SeriesPayload } from './types';
import { filterByRange, rangeStartDate, todayIso } from './ranges';

const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

function parseFredCsv(text: string): DataPoint[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const points: DataPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',');
    const date = cols[0]?.trim();
    const raw = cols[cols.length - 1]?.trim();
    if (!date || !raw || raw === '.') continue;
    const value = parseFloat(raw);
    if (Number.isFinite(value)) points.push({ date, value });
  }
  return points;
}

export async function fetchFredSeries(
  seriesId: string,
  cosd?: string,
  coed: string = todayIso(),
): Promise<DataPoint[]> {
  const start = cosd ?? '1950-01-01';
  const url = `${FRED_CSV}?id=${encodeURIComponent(seriesId)}&cosd=${start}&coed=${coed}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status}`);
  const text = await res.text();
  return parseFredCsv(text);
}

export async function loadFredWithFallback(
  seriesId: string,
  fallbackPath: string,
  cosd?: string,
  extraSeriesIds: string[] = [],
): Promise<SeriesPayload> {
  for (const id of [seriesId, ...extraSeriesIds]) {
    try {
      const points = await fetchFredSeries(id, cosd);
      if (points.length > 0) return { points, source: 'live' };
    } catch {
      /* try next */
    }
  }
  const fb = await loadFallbackJson(fallbackPath);
  return { points: fb.points, source: 'fallback', fetchedAt: fb.fetchedAt };
}

async function loadFallbackJson(path: string): Promise<{ points: DataPoint[]; fetchedAt?: string }> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/${path}`);
  if (!res.ok) throw new Error(`Fallback missing: ${path}`);
  const json = (await res.json()) as { points: DataPoint[]; fetchedAt?: string };
  return json;
}

export async function loadFredRange(
  seriesId: string,
  fallbackFile: string,
  rangeKey: RangeKey,
): Promise<SeriesPayload> {
  const coed = todayIso();
  const cosd = rangeKey === 'max' ? '1950-01-01' : rangeStartDate(rangeKey, coed);
  try {
    const points = await fetchFredSeries(seriesId, cosd, coed);
    if (points.length > 0) return { points, source: 'live' };
  } catch {
    /* fallback */
  }
  const fb = await loadFallbackJson(fallbackFile);
  return {
    points: filterByRange(fb.points, rangeKey),
    source: 'fallback',
    fetchedAt: fb.fetchedAt,
  };
}

export const FRED_SERIES = {
  sp500: 'SP500',
  nasdaq: 'NASDAQCOM',
  gold: 'GOLDPMGBD228NLBM',
  silver: 'SLVPRUSD',
  dgs3mo: 'DGS3MO',
  dgs5: 'DGS5',
  dgs10: 'DGS10',
  dgs20: 'DGS20',
  dgs30: 'DGS30',
} as const;

export async function loadFredMultiForRange(
  ids: string[],
  fallbackFile: string,
  rangeKey: RangeKey,
): Promise<import('./types').MultiSeriesPayload> {
  const coed = todayIso();
  const cosd = rangeKey === 'max' ? '1950-01-01' : rangeStartDate(rangeKey, coed);
  const series: Record<string, DataPoint[]> = {};
  let liveOk = false;
  for (const id of ids) {
    try {
      const points = await fetchFredSeries(id, cosd, coed);
      series[id] = points;
      if (points.length) liveOk = true;
    } catch {
      series[id] = [];
    }
  }
  if (liveOk) return { series, source: 'live' };
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/${fallbackFile}`);
  if (!res.ok) throw new Error(`Fallback missing: ${fallbackFile}`);
  const json = (await res.json()) as {
    series: Record<string, DataPoint[]>;
    fetchedAt?: string;
  };
  const filtered: Record<string, DataPoint[]> = {};
  for (const id of ids) {
    filtered[id] = filterByRange(json.series[id] ?? [], rangeKey);
  }
  return { series: filtered, source: 'fallback', fetchedAt: json.fetchedAt };
}
