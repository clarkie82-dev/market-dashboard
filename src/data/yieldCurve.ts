import type { DataPoint } from './types';
import type { RangeKey } from './types';
import { rangeStartDate } from './ranges';

export const YIELD_MATURITIES = [
  { id: 'DGS3MO', label: '3M' },
  { id: 'DGS5', label: '5Y' },
  { id: 'DGS10', label: '10Y' },
  { id: 'DGS20', label: '20Y' },
  { id: 'DGS30', label: '30Y' },
] as const;

export type YieldCurvePoint = { label: string; yield: number };

function valueOnDate(series: DataPoint[], date: string): number | null {
  const exact = series.find((p) => p.date === date);
  if (exact) return exact.value;
  const before = series.filter((p) => p.date <= date).sort((a, b) => b.date.localeCompare(a.date));
  return before[0]?.value ?? null;
}

function latestCommonDate(seriesMap: Record<string, DataPoint[]>): string | null {
  const ids = YIELD_MATURITIES.map((m) => m.id);
  let candidate: string | null = null;
  for (const id of ids) {
    const s = seriesMap[id];
    if (!s?.length) return null;
    const last = s[s.length - 1]!.date;
    if (candidate === null || last < candidate) candidate = last;
  }
  if (!candidate) return null;
  for (const id of ids) {
    if (valueOnDate(seriesMap[id] ?? [], candidate) === null) {
      const allDates = new Set<string>();
      for (const sid of ids) {
        for (const p of seriesMap[sid] ?? []) allDates.add(p.date);
      }
      const sorted = [...allDates].sort();
      for (let i = sorted.length - 1; i >= 0; i--) {
        const d = sorted[i]!;
        if (ids.every((sid) => valueOnDate(seriesMap[sid] ?? [], d) !== null)) return d;
      }
      return null;
    }
  }
  return candidate;
}

export function buildYieldCurve(
  seriesMap: Record<string, DataPoint[]>,
  date: string,
): YieldCurvePoint[] {
  const out: YieldCurvePoint[] = [];
  for (const m of YIELD_MATURITIES) {
    const v = valueOnDate(seriesMap[m.id] ?? [], date);
    if (v !== null) out.push({ label: m.label, yield: v });
  }
  return out;
}

export function currentYieldCurve(seriesMap: Record<string, DataPoint[]>): {
  points: YieldCurvePoint[];
  date: string | null;
} {
  const date = latestCommonDate(seriesMap);
  if (!date) return { points: [], date: null };
  return { points: buildYieldCurve(seriesMap, date), date };
}

export function firstDateOnOrAfter(seriesMap: Record<string, DataPoint[]>, start: string): string | null {
  const dates = new Set<string>();
  for (const m of YIELD_MATURITIES) {
    for (const p of seriesMap[m.id] ?? []) {
      if (p.date >= start) dates.add(p.date);
    }
  }
  const sorted = [...dates].sort();
  for (const d of sorted) {
    if (YIELD_MATURITIES.every((m) => valueOnDate(seriesMap[m.id] ?? [], d) !== null)) return d;
  }
  return sorted[0] ?? null;
}

export function comparisonYieldCurves(
  seriesMap: Record<string, DataPoint[]>,
  rangeKey: RangeKey,
): {
  latest: YieldCurvePoint[];
  start: YieldCurvePoint[];
  latestDate: string | null;
  startDate: string | null;
} {
  const { points: latest, date: latestDate } = currentYieldCurve(seriesMap);
  const rangeStart = rangeStartDate(rangeKey);
  const startDate = firstDateOnOrAfter(seriesMap, rangeStart);
  const start = startDate ? buildYieldCurve(seriesMap, startDate) : [];
  return { latest, start, latestDate, startDate };
}
