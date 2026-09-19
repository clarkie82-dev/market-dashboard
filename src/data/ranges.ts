import type { DataPoint, RangeKey } from './types';

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function rangeStartDate(key: RangeKey, end: string = todayIso()): string {
  const d = new Date(end + 'T12:00:00Z');
  if (key === 'max') return '1950-01-01';
  const offsets: Record<Exclude<RangeKey, 'max'>, { months?: number; years?: number }> = {
    '1m': { months: 1 },
    '3m': { months: 3 },
    '6m': { months: 6 },
    '1y': { years: 1 },
    '3y': { years: 3 },
    '5y': { years: 5 },
    '10y': { years: 10 },
    '15y': { years: 15 },
    '20y': { years: 20 },
  };
  const o = offsets[key as Exclude<RangeKey, 'max'>];
  if (o.months) d.setUTCMonth(d.getUTCMonth() - o.months);
  if (o.years) d.setUTCFullYear(d.getUTCFullYear() - o.years);
  return d.toISOString().slice(0, 10);
}

export function filterByRange(points: DataPoint[], key: RangeKey): DataPoint[] {
  if (key === 'max') return [...points];
  const start = rangeStartDate(key);
  return points.filter((p) => p.date >= start);
}

export function filterLastHours(points: DataPoint[], hours: number): DataPoint[] {
  if (points.length === 0) return [];
  const hasTime = points.some((p) => p.time != null);
  if (!hasTime) return lastNDays(points, Math.ceil(hours / 24));
  const latest = Math.max(...points.map((p) => p.time ?? 0));
  const cutoff = latest - hours * 60 * 60 * 1000;
  return points.filter((p) => (p.time ?? 0) >= cutoff);
}

export function lastNDays(points: DataPoint[], days: number): DataPoint[] {
  if (points.length === 0) return [];
  const end = points[points.length - 1]!.date;
  const start = rangeStartDate('1m', end);
  const cutoff =
    days <= 30
      ? (() => {
          const d = new Date(end + 'T12:00:00Z');
          d.setUTCDate(d.getUTCDate() - days);
          return d.toISOString().slice(0, 10);
        })()
      : start;
  return points.filter((p) => p.date >= cutoff);
}

export function coingeckoDays(key: RangeKey): string {
  if (key === 'max') return 'max';
  const map: Record<Exclude<RangeKey, 'max'>, string> = {
    '1m': '30',
    '3m': '90',
    '6m': '180',
    '1y': '365',
    '3y': '1095',
    '5y': '1825',
    '10y': '3650',
    '15y': '5475',
    '20y': '7300',
  };
  return map[key as Exclude<RangeKey, 'max'>];
}
