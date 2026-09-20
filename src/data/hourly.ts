import type { DataPoint } from './types';
import { filterLastHours } from './ranges';

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

export function uniqueCalendarDays(points: DataPoint[]): number {
  return new Set(points.map((p) => p.date)).size;
}

export function shortHourlyTitle(points: DataPoint[], targetDays = 7): string {
  const days = uniqueCalendarDays(points);
  if (days >= targetDays) return `Last ${targetDays} days (hourly)`;
  if (days <= 0) return 'Recent hourly';
  return `Last ~${days} days (hourly)`;
}

export function selectShortHourlyWindow(points: DataPoint[], hours = 168): DataPoint[] {
  const sorted = sortByTime(points);
  if (sorted.length === 0) return sorted;
  const filtered = filterLastHours(sorted, hours);
  if (filtered.length >= MIN_HOURLY_SHORT_POINTS && isHourlyGranular(filtered)) {
    return filtered;
  }
  return sorted;
}

export function formatPointTime(timeMs: number | undefined): string {
  if (timeMs == null) return '';
  return new Date(timeMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
