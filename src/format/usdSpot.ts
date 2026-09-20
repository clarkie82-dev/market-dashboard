import type { DataPoint } from '../data/types';

function pointTimeMs(p: DataPoint): number {
  return p.time ?? new Date(`${p.date}T12:00:00Z`).getTime();
}

/** Most recent observation across one or more series (e.g. short + long at page load). */
export function latestSpotPrice(...lists: DataPoint[][]): number | undefined {
  let best: DataPoint | undefined;
  let bestT = -Infinity;
  for (const points of lists) {
    for (const p of points) {
      if (!Number.isFinite(p.value)) continue;
      const t = pointTimeMs(p);
      if (t >= bestT) {
        bestT = t;
        best = p;
      }
    }
  }
  return best?.value;
}

export function formatUsdSpot(value: number): string {
  const fractionDigits = value >= 100 ? 0 : 2;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function cardTitleWithSpot(base: string, ...lists: DataPoint[][]): string {
  const value = latestSpotPrice(...lists);
  if (value == null) return base;
  return `${base} ${formatUsdSpot(value)}`;
}
