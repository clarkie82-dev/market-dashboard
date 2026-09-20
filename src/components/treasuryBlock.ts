import type { Chart } from 'chart.js';
import type { DataPoint, RangeKey } from '../data/types';
import { RANGE_OPTIONS } from '../data/types';
import { FRED_SERIES, loadFredMultiForRange } from '../data/fred';
import { lastNDays } from '../data/ranges';
import { destroyChart, lineTimeMultiChart, metaLine } from '../charts/chartHelpers';
import { createYieldCurveSection } from './yieldCurvePanel';

const TREASURY_IDS = [
  FRED_SERIES.dgs3mo,
  FRED_SERIES.dgs5,
  FRED_SERIES.dgs10,
  FRED_SERIES.dgs20,
  FRED_SERIES.dgs30,
];

const TREASURY_LABELS: Record<string, string> = {
  [FRED_SERIES.dgs3mo]: '3M T-Bill',
  [FRED_SERIES.dgs5]: '5Y T-Note',
  [FRED_SERIES.dgs10]: '10Y T-Note',
  [FRED_SERIES.dgs20]: '20Y T-Bond',
  [FRED_SERIES.dgs30]: '30Y T-Bond',
};

export async function createTreasuryBlock(container: HTMLElement): Promise<void> {
  const block = document.createElement('section');
  block.className = 'treasury-block metric-panel';

  const h2 = document.createElement('h2');
  h2.textContent = 'US Treasury yields';
  block.appendChild(h2);

  const meta = document.createElement('div');
  meta.className = 'panel-meta';
  block.appendChild(meta);

  let rangeKey: RangeKey = '6m';
  let seriesMap: Record<string, DataPoint[]> = {};

  const payload = await loadFredMultiForRange(TREASURY_IDS, 'treasury.json', rangeKey);
  seriesMap = payload.series;
  meta.textContent = metaLine(payload.source, payload.fetchedAt);

  const chartRow = document.createElement('div');
  chartRow.className = 'chart-row';

  const shortWrap = document.createElement('div');
  shortWrap.className = 'chart-wrap';
  shortWrap.innerHTML = '<h3>Recent daily</h3>';
  const shortCanvas = document.createElement('canvas');
  shortWrap.appendChild(shortCanvas);

  const longWrap = document.createElement('div');
  longWrap.className = 'chart-wrap';
  longWrap.innerHTML = '<h3>Historical</h3>';
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

  longWrap.append(longCanvas, rangeRow);

  chartRow.append(shortWrap, longWrap);
  block.appendChild(chartRow);

  container.appendChild(block);

  let shortChart: Chart | null = null;
  let longChart: Chart | null = null;

  function toMultiSeries(map: Record<string, DataPoint[]>, filter?: (p: DataPoint[]) => DataPoint[]) {
    return TREASURY_IDS.map((id) => ({
      label: TREASURY_LABELS[id] ?? id,
      points: filter ? filter(map[id] ?? []) : (map[id] ?? []),
    }));
  }

  function renderCharts() {
    shortChart = destroyChart(shortChart);
    longChart = destroyChart(longChart);
    shortChart = lineTimeMultiChart(
      shortCanvas,
      toMultiSeries(seriesMap, (p) => lastNDays(p, 30)),
      'Yield (%)',
    );
    longChart = lineTimeMultiChart(
      longCanvas,
      toMultiSeries(seriesMap),
      'Yield (%)',
    );
  }

  renderCharts();

  const yieldCurve = createYieldCurveSection(
    block,
    () => seriesMap,
    () => rangeKey,
  );

  select.addEventListener('change', async () => {
    rangeKey = select.value as RangeKey;
    select.disabled = true;
    try {
      const next = await loadFredMultiForRange(TREASURY_IDS, 'treasury.json', rangeKey);
      seriesMap = next.series;
      meta.textContent = metaLine(next.source, next.fetchedAt);
      renderCharts();
      yieldCurve.refresh();
    } catch (e) {
      meta.textContent = e instanceof Error ? e.message : 'Load failed';
      meta.classList.add('error');
    } finally {
      select.disabled = false;
    }
  });
}
