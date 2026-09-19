import type { DataPoint } from './types';

export const MIN_HOURLY_SHORT_POINTS = 48;

export function sortByTime(points: DataPoint[]): DataPoint[] {
  return [...points].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

/** Detect ~hourly spacing (not ~1 point/day). */
export function isHourlyGranular(points: DataPoint[]): boolean {
  if (points.length < MIN_HOURLY_SHORT_POINTS) return false;
  const withTime = points.filter((p) => p.time != null);
  if (withTime.length < MIN_HOURLY_SHORT_POINTS) return false;
  const sorted = sortByTime(withTime);
  let smallGaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i]!.time! - sorted[i - 1]!.time!) / (60 * 60 * 1000);
    if (gap > 0 && gap <= 2) smallGaps++;
  }
  return smallGaps >= 24;
}
