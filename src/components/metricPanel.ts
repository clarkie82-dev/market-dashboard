import type { Chart } from 'chart.js';
import type { DataPoint, RangeKey, SeriesPayload } from '../data/types';
import { RANGE_OPTIONS } from '../data/types';
import { destroyChart, lineTimeChart, metaLine } from '../charts/chartHelpers';
import { lastNDays } from '../data/ranges';

export type MetricPanelOptions = {
  title: string;
  yLabel?: string;
  shortLabel?: string;
  longLabel?: string;
  shortDays?: number;
  onRangeChange: (key: RangeKey) => Promise<SeriesPayload>;
};

export function createMetricPanel(
  container: HTMLElement,
  initialShort: DataPoint[],
  initialLong: SeriesPayload,
  opts: MetricPanelOptions,
): { setRange: (key: RangeKey) => Promise<void>; getRange: () => RangeKey } {
  const panel = document.createElement('section');
  panel.className = 'metric-panel';

  const h2 = document.createElement('h2');
  h2.textContent = opts.title;
  panel.appendChild(h2);

  const meta = document.createElement('div');
  meta.className = 'panel-meta';
  meta.textContent = metaLine(initialLong.source, initialLong.fetchedAt);
  panel.appendChild(meta);

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
  longWrap.append(longH, longCanvas);

  chartRow.append(shortWrap, longWrap);
  panel.appendChild(chartRow);

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
  panel.appendChild(rangeRow);

  container.appendChild(panel);

  let shortChart: Chart | null = null;
  let longChart: Chart | null = null;
  let currentRange: RangeKey = '6m';

  const shortDays = opts.shortDays ?? 30;

  function renderShort(points: DataPoint[]) {
    shortChart = destroyChart(shortChart);
    shortChart = lineTimeChart(
      shortCanvas,
      lastNDays(points, shortDays),
      opts.title,
      opts.yLabel,
    );
  }

  function renderLong(payload: SeriesPayload) {
    longChart = destroyChart(longChart);
    longChart = lineTimeChart(longCanvas, payload.points, opts.title, opts.yLabel);
    meta.textContent = metaLine(payload.source, payload.fetchedAt);
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
