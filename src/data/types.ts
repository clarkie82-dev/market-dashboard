export type DataPoint = { date: string; value: number };

export type SeriesPayload = {
  points: DataPoint[];
  source: 'live' | 'fallback';
  fetchedAt?: string;
};

export type RangeKey =
  | '1m'
  | '3m'
  | '6m'
  | '1y'
  | '3y'
  | '5y'
  | '10y'
  | '15y'
  | '20y'
  | 'max';

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '1m', label: '1 month' },
  { key: '3m', label: '3 months' },
  { key: '6m', label: '6 months' },
  { key: '1y', label: '1 year' },
  { key: '3y', label: '3 years' },
  { key: '5y', label: '5 years' },
  { key: '10y', label: '10 years' },
  { key: '15y', label: '15 years' },
  { key: '20y', label: '20 years' },
  { key: 'max', label: 'Max' },
];

export type MultiSeriesPayload = {
  series: Record<string, DataPoint[]>;
  source: 'live' | 'fallback';
  fetchedAt?: string;
};
