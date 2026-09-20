import type { Chart } from 'chart.js';
import type { DataPoint, RangeKey, SeriesPayload } from '../data/types';
import { RANGE_OPTIONS } from '../data/types';
import {
  destroyChart,
  lineSequentialHourlyChart,
  lineTimeChart,
  metaLine,
} from '../charts/chartHelpers';
import { filterLastHours, lastNDays } from '../data/ranges';
import { selectShortHourlyWindow, shortHourlyTitle } from '../data/hourly';

export type MetricPanelOptions = {
  title: string;
  /** Panel heading; defaults to `title` (chart legend keeps `title`). */
  cardTitle?: string;
  yLabel?: string;
  shortLabel?: string;
  longLabel?: string;
  shortDays?: number;
  shortFilterHours?: number;
  shortTimeUnit?: 'day' | 'hour';
  shortCondenseSequential?: boolean;
  onRangeChange: (key: RangeKey) => Promise<SeriesPayload>;
};

export function createMetricPanel(
  container: HTMLElement,
  initialShort: DataPoint[],
  initialLong: SeriesPayload,
  opts: MetricPanelOptions,
  initialShortMeta?: SeriesPayload,
): { setRange: (key: RangeKey) => Promise<void>; getRange: () => RangeKey } {
  const panel = document.createElement('section');
  panel.className = 'metric-panel';

  const h2 = document.createElement('h2');
  h2.textContent = opts.cardTitle ?? opts.title;
  panel.appendChild(h2);

  const meta = document.createElement('div');
  meta.className = 'panel-meta';
  panel.appendChild(meta);

  function updateMeta(long: SeriesPayload, short?: SeriesPayload) {
    const parts = [metaLine(long.source, long.fetchedAt)];
    if (short && (short.source !== long.source || short.fetchedAt !== long.fetchedAt)) {
      parts.push(`Short chart: ${metaLine(short.source, short.fetchedAt)}`);
    }
    meta.textContent = parts.join(' · ');
  }

  updateMeta(initialLong, initialShortMeta);

  const chartRow = document.createElement('div');
  chartRow.className = 'chart-row';

  const shortWrap = document.createElement('div');
  shortWrap.className = 'chart-wrap';
  const shortH = document.createElement('h3');
  shortH.textContent = opts.shortLabel ?? 'Recent daily';
  const shortCanvas = document.createElement('canvas');
  shortWrap.append(shortH, shortCanvas);

  const longWrap = document.createElement('div');
  longWrap.className = 'chart-wrap';
  const longH = document.createElement('h3');
  longH.textContent = opts.longLabel ?? 'Historical';
  const longCanvas = document.createElement('canvas');
  const rangeRow = document.createElement('div');
  rangeRow.className = 'range-row';
  const rangeLabel = document.createElement('label');
  rangeLabel.textContent = 'Historical range: ';
  const select = document.createElement('select');
  for (const o of RANGE_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = o.key;
    opt.textContent = o.label;
    if (o.key === '6m') opt.selected = true;
    select.appendChild(opt);
  }
  rangeRow.append(rangeLabel, select);

  longWrap.append(longH, longCanvas, rangeRow);

  chartRow.append(shortWrap, longWrap);
  panel.appendChild(chartRow);

  container.appendChild(panel);

  let shortChart: Chart | null = null;
  let longChart: Chart | null = null;
  let currentRange: RangeKey = '6m';

  const shortDays = opts.shortDays ?? 30;

  function renderShort(points: DataPoint[]) {
    shortChart = destroyChart(shortChart);
    if (opts.shortCondenseSequential) {
      const window = selectShortHourlyWindow(points, opts.shortFilterHours ?? 168);
      shortH.textContent = shortHourlyTitle(window);
      shortChart = lineSequentialHourlyChart(shortCanvas, window, opts.title, opts.yLabel);
      return;
    }
    const filtered =
      opts.shortFilterHours != null
        ? filterLastHours(points, opts.shortFilterHours)
        : lastNDays(points, shortDays);
    shortChart = lineTimeChart(
      shortCanvas,
      filtered,
      opts.title,
      opts.yLabel,
      opts.shortTimeUnit ?? 'day',
    );
  }

  function renderLong(payload: SeriesPayload) {
    longChart = destroyChart(longChart);
    longChart = lineTimeChart(longCanvas, payload.points, opts.title, opts.yLabel);
    updateMeta(payload, initialShortMeta);
  }

  renderShort(initialShort.length ? initialShort : initialLong.points);
  renderLong(initialLong);

  select.addEventListener('change', async () => {
    currentRange = select.value as RangeKey;
    select.disabled = true;
    try {
      const payload = await opts.onRangeChange(currentRange);
      renderLong(payload);
    } catch (e) {
      meta.textContent = e instanceof Error ? e.message : 'Load failed';
      meta.classList.add('error');
    } finally {
      select.disabled = false;
    }
  });

  return {
    setRange: async (key: RangeKey) => {
      select.value = key;
      currentRange = key;
      const payload = await opts.onRangeChange(key);
      renderLong(payload);
    },
    getRange: () => currentRange,
  };
}
