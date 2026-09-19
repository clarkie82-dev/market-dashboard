import type { FearGreedData } from '../data/fearGreed';
import { metaLine } from '../charts/chartHelpers';

export function createFearGreedPanel(container: HTMLElement, data: FearGreedData): void {
  const panel = document.createElement('section');
  panel.className = 'fng-panel';

  const h2 = document.createElement('h2');
  h2.textContent = 'Crypto Fear & Greed Index';
  panel.appendChild(h2);

  const meta = document.createElement('div');
  meta.className = 'panel-meta';
  meta.textContent = metaLine(data.source, data.fetchedAt);
  panel.appendChild(meta);

  const wrap = document.createElement('div');
  wrap.className = 'fng-dial-wrap';

  const value = Math.max(0, Math.min(100, data.value));
  const angle = -180 + (value / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const cx = 140;
  const cy = 130;
  const r = 100;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 280 150');
  svg.innerHTML = `
    <path d="M 40 130 A 100 100 0 0 1 240 130" fill="none" stroke="#ddd" stroke-width="16"/>
    <path d="M 40 130 A 100 100 0 0 1 240 130" fill="none" stroke="#6366f1" stroke-width="16"
      stroke-dasharray="314" stroke-dashoffset="${314 - (value / 100) * 314}"/>
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#333" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#333"/>
    <text x="${cx}" y="145" text-anchor="middle" font-size="22" font-weight="bold">${value}</text>
    <text x="${cx}" y="95" text-anchor="middle" font-size="14">${data.classification}</text>
  `;

  const attr = document.createElement('p');
  attr.className = 'fng-attribution';
  attr.textContent =
    'Fear & Greed data from alternative.me — https://alternative.me/crypto/fear-and-greed-index/';

  wrap.append(svg, attr);
  panel.appendChild(wrap);
  container.appendChild(panel);
}
