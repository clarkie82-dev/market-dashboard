import type { DataPoint } from './types';
import { filterLastHours } from './ranges';

export const MIN_HOURLY_SHORT_POINTS = 48;
export const MIN_DAILY_SERIES_POINTS = 100;

function sortByDate(points: DataPoint[]): DataPoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date));
}

function dateGapDays(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime();
  return ms / (24 * 60 * 60 * 1000);
}

/** Detect ~daily spacing (not ~1 point/month). */
export function isDailyGranular(points: DataPoint[], sampleSize = 90): boolean {
  if (points.length < 20) return false;
  const sorted = sortByDate(points);
  const sample = sorted.slice(-Math.min(sampleSize, sorted.length));
  if (sample.length < 20) return false;
  const gaps: number[] = [];
  let inBand = 0;
  for (let i = 1; i < sample.length; i++) {
    const gap = dateGapDays(sample[i - 1]!.date, sample[i]!.date);
    if (gap <= 0) continue;
    gaps.push(gap);
    if (gap >= 1 && gap <= 5) inBand++;
  }
  if (gaps.length < 15 || inBand < 30) return false;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]!;
  return median <= 4;
}

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
