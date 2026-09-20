import type { FearGreedData } from '../data/fearGreed';
import { metaLine } from '../charts/chartHelpers';

const SEGMENTS: { start: number; end: number; color: string }[] = [
  { start: 0, end: 20, color: '#dc2626' },
  { start: 20, end: 40, color: '#f97316' },
  { start: 40, end: 60, color: '#eab308' },
  { start: 60, end: 80, color: '#84cc16' },
  { start: 80, end: 100, color: '#059669' },
];

const GAP_DEG = 3;

function valueToDeg(value: number): number {
  return -180 + (value / 100) * 180;
}

function polarToXY(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArcSegment(
  cx: number,
  cy: number,
  r: number,
  startValue: number,
  endValue: number,
): string {
  const startDeg = valueToDeg(startValue) + GAP_DEG / 2;
  const endDeg = valueToDeg(endValue) - GAP_DEG / 2;
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);
  const sweep = endDeg - startDeg;
  const largeArc = sweep <= -180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function shortClassification(classification: string): string {
  return classification.replace(/^Extreme\s+/i, '');
}

export function createFearGreedPanel(container: HTMLElement, data: FearGreedData): void {
  const panel = document.createElement('section');
  panel.className = 'fng-panel';

  const main = document.createElement('div');
  main.className = 'fng-panel-main';

  const h2 = document.createElement('h2');
  h2.textContent = 'Crypto Fear & Greed Index';
  main.appendChild(h2);

  const meta = document.createElement('div');
  meta.className = 'panel-meta';
  meta.textContent = metaLine(data.source, data.fetchedAt);
  main.appendChild(meta);

  const wrap = document.createElement('div');
  wrap.className = 'fng-dial-wrap';

  const dialCard = document.createElement('div');
  dialCard.className = 'fng-dial';

  const value = Math.max(0, Math.min(100, data.value));
  const cx = 100;
  const cy = 92;
  const r = 72;
  const markerDeg = valueToDeg(value);
  const marker = polarToXY(cx, cy, r, markerDeg);
  const label = shortClassification(data.classification);

  const segmentPaths = SEGMENTS.map(
    (seg) =>
      `<path d="${describeArcSegment(cx, cy, r, seg.start, seg.end)}" fill="none" stroke="${seg.color}" stroke-width="10" stroke-linecap="round"/>`,
  ).join('\n    ');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 115');
  svg.setAttribute('aria-label', `Fear and Greed Index ${value}, ${data.classification}`);
  svg.innerHTML = `
    ${segmentPaths}
    <circle cx="${marker.x}" cy="${marker.y}" r="5" fill="#fff"/>
    <text x="${cx}" y="${cy + 8}" text-anchor="middle" fill="#fff" font-size="28" font-weight="700" font-family="system-ui,sans-serif">${value}</text>
    <text x="${cx}" y="${cy + 28}" text-anchor="middle" fill="#9ca3af" font-size="13" font-family="system-ui,sans-serif">${label}</text>
  `;

  dialCard.appendChild(svg);
  wrap.appendChild(dialCard);

  const attr = document.createElement('p');
  attr.className = 'fng-attribution';
  attr.textContent =
    'Fear & Greed data from alternative.me — https://alternative.me/crypto/fear-and-greed-index/';

  wrap.append(attr);
  main.append(wrap);
  panel.appendChild(main);
  container.appendChild(panel);
}
