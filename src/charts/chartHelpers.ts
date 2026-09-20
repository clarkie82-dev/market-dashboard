import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  TimeScale,
  Legend,
  Tooltip,
  Filler,
  type ChartConfiguration,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import type { DataPoint } from '../data/types';
import type { YieldCurvePoint } from '../data/yieldCurve';
import { formatPointTime } from '../data/hourly';
import { DEFAULT_LINE_COLOR } from './seriesColors';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  TimeScale,
  Legend,
  Tooltip,
  Filler,
);

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2'];

export function destroyChart(chart: Chart | null): null {
  chart?.destroy();
  return null;
}

export function pointToX(p: DataPoint): number {
  return p.time ?? new Date(`${p.date}T12:00:00Z`).getTime();
}

export function lineTimeChart(
  canvas: HTMLCanvasElement,
  points: DataPoint[],
  label: string,
  yLabel?: string,
  timeUnit: 'day' | 'hour' = 'day',
  lineColor?: string,
): Chart {
  const cfg: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      datasets: [
        {
          label,
          data: points.map((p) => ({
            x: pointToX(p),
            y: p.value,
          })),
          borderColor: lineColor ?? DEFAULT_LINE_COLOR,
          backgroundColor: 'transparent',
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: timeUnit,
            displayFormats:
              timeUnit === 'hour'
                ? { hour: 'MMM d HH:mm', day: 'MMM d' }
                : { day: 'MMM d' },
          },
          ticks: { maxTicksLimit: timeUnit === 'hour' ? 16 : undefined },
        },
        y: {
          title: yLabel ? { display: true, text: yLabel } : undefined,
        },
      },
      plugins: { legend: { display: !!label } },
    },
  };
  return new Chart(canvas, cfg);
}

export function lineSequentialHourlyChart(
  canvas: HTMLCanvasElement,
  points: DataPoint[],
  label: string,
  yLabel?: string,
  lineColor?: string,
): Chart {
  const cfg: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      datasets: [
        {
          label,
          data: points.map((p, i) => ({ x: i, y: p.value })),
          borderColor: lineColor ?? DEFAULT_LINE_COLOR,
          backgroundColor: 'transparent',
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          type: 'linear',
          ticks: {
            maxTicksLimit: 10,
            callback(tickValue) {
              const i = typeof tickValue === 'number' ? Math.round(tickValue) : 0;
              const p = points[i];
              return p ? formatPointTime(p.time) : '';
            },
          },
        },
        y: {
          title: yLabel ? { display: true, text: yLabel } : undefined,
        },
      },
      plugins: {
        legend: { display: !!label },
        tooltip: {
          callbacks: {
            title(items) {
              const i = items[0]?.parsed.x;
              if (i == null) return '';
              return formatPointTime(points[Math.round(i)]?.time);
            },
            label(item) {
              const y = item.parsed.y;
              return y != null ? `${label}: ${y.toLocaleString()}` : label;
            },
          },
        },
      },
    },
  };
  return new Chart(canvas, cfg);
}

export function lineTimeMultiChart(
  canvas: HTMLCanvasElement,
  series: { label: string; points: DataPoint[] }[],
  yLabel?: string,
): Chart {
  const cfg: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.points.map((p) => ({
          x: pointToX(p),
          y: p.value,
        })),
        borderColor: COLORS[i % COLORS.length],
        backgroundColor: 'transparent',
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: { type: 'time', time: { unit: 'day' } },
        y: {
          title: yLabel ? { display: true, text: yLabel } : undefined,
        },
      },
      plugins: { legend: { display: true } },
    },
  };
  return new Chart(canvas, cfg);
}

export function yieldCurveChart(
  canvas: HTMLCanvasElement,
  curves: { label: string; points: YieldCurvePoint[] }[],
): Chart {
  const labels = curves[0]?.points.map((p) => p.label) ?? ['3M', '5Y', '10Y', '20Y', '30Y'];
  const cfg: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels,
      datasets: curves.map((c, i) => ({
        label: c.label,
        data: c.points.map((p) => p.yield),
        borderColor: COLORS[i % COLORS.length],
        backgroundColor: 'transparent',
        tension: 0.2,
        pointRadius: 4,
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: { title: { display: true, text: 'Maturity' } },
        y: { title: { display: true, text: 'Yield (%)' } },
      },
      plugins: { legend: { display: curves.length > 1 } },
    },
  };
  return new Chart(canvas, cfg);
}

export function metaLine(source: 'live' | 'fallback', fetchedAt?: string): string {
  if (source === 'live') return 'Source: live fetch';
  return fetchedAt ? `Source: cached data (as of ${fetchedAt})` : 'Source: cached data';
}
