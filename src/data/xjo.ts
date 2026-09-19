import type { DataPoint, RangeKey, SeriesPayload } from './types';
import { filterByRange } from './ranges';

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
