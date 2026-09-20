import type { DataPoint } from './types';

export function goldSilverRatio(gold: DataPoint[], silver: DataPoint[]): DataPoint[] {
  const silverByDate = new Map(silver.map((p) => [p.date, p.value]));
  const out: DataPoint[] = [];
  for (const g of gold) {
    const s = silverByDate.get(g.date);
    if (s && s > 0) out.push({ date: g.date, value: g.value / s });
  }
  return out;
}

export function meanValue(points: DataPoint[]): number | undefined {
  let sum = 0;
  let n = 0;
  for (const p of points) {
    if (!Number.isFinite(p.value)) continue;
    sum += p.value;
    n++;
  }
  if (n === 0) return undefined;
  return sum / n;
}
