import type { Chart } from 'chart.js';
import type { RangeKey } from '../data/types';
import {
  comparisonYieldCurves,
  currentYieldCurve,
  type YieldCurvePoint,
} from '../data/yieldCurve';
import type { DataPoint } from '../data/types';
import { destroyChart, yieldCurveChart } from '../charts/chartHelpers';

export function createYieldCurveSection(
  parent: HTMLElement,
  getSeriesMap: () => Record<string, DataPoint[]>,
  getRange: () => RangeKey,
): { refresh: () => void } {
  const section = document.createElement('div');
  section.className = 'yield-curve-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'US Treasury yield curve';
  section.appendChild(h3);

  const chartRow = document.createElement('div');
  chartRow.className = 'chart-row';

  const currentWrap = document.createElement('div');
  currentWrap.className = 'chart-wrap';
  const currentTitle = document.createElement('h3');
  currentTitle.textContent = 'Current curve';
  const currentSub = document.createElement('div');
  currentSub.className = 'panel-meta';
  const currentCanvas = document.createElement('canvas');
  currentWrap.append(currentTitle, currentSub, currentCanvas);

  const cmpWrap = document.createElement('div');
  cmpWrap.className = 'chart-wrap';
  const cmpTitle = document.createElement('h3');
  cmpTitle.textContent = 'Curve comparison';
  const cmpSub = document.createElement('div');
  cmpSub.className = 'panel-meta';
  const cmpCanvas = document.createElement('canvas');
  cmpWrap.append(cmpTitle, cmpSub, cmpCanvas);

  chartRow.append(currentWrap, cmpWrap);
  section.appendChild(chartRow);
  parent.appendChild(section);

  let currentChart: Chart | null = null;
  let cmpChart: Chart | null = null;

  function refresh() {
    const seriesMap = getSeriesMap();
    const { points, date } = currentYieldCurve(seriesMap);
    currentSub.textContent = date ? `As of ${date}` : 'No aligned data';
    currentChart = destroyChart(currentChart);
    if (points.length) {
      currentChart = yieldCurveChart(currentCanvas, [{ label: 'Current', points }]);
    }

    const rangeKey = getRange();
    const cmp = comparisonYieldCurves(seriesMap, rangeKey);
    cmpSub.textContent =
      cmp.latestDate && cmp.startDate
        ? `Latest (${cmp.latestDate}) vs start of range (${cmp.startDate})`
        : 'Comparison unavailable';

    cmpChart = destroyChart(cmpChart);
    const curves: { label: string; points: YieldCurvePoint[] }[] = [];
    if (cmp.latest.length) curves.push({ label: 'Latest', points: cmp.latest });
    if (cmp.start.length) curves.push({ label: 'Range start', points: cmp.start });
    if (curves.length) {
      cmpChart = yieldCurveChart(cmpCanvas, curves);
    }
  }

  refresh();
  return { refresh };
}
