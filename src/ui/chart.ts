import { escapeHtml as e, formatNumber } from '../format';
import { niceTicks } from '../stats';

export interface ChartPoint {
  /** Libellé court de l'axe X (date). */
  label: string;
  value: number;
  /** Ligne secondaire de l'infobulle (reps, tour de taille…). */
  detail?: string;
}

export interface ChartOptions {
  id: string;
  points: ChartPoint[];
  selected: number | null;
  unit: string;
  minSpan?: number;
  ariaLabel: string;
}

const H = 160;

/**
 * Courbe d'une seule série : ligne 2 px, points tactiles (zone 44 px),
 * infobulle sur le point choisi (le dernier par défaut). Largeur fluide.
 */
export function renderLineChart(o: ChartOptions): string {
  const n = o.points.length;
  if (n === 0) return '';
  const values = o.points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values), o.minSpan ?? 1);
  const lo = ticks[0];
  const hi = ticks[2];
  const sel = o.selected === null || o.selected >= n ? n - 1 : o.selected;
  const fx = (i: number) => (n === 1 ? 0.5 : 0.04 + (i * 0.92) / (n - 1));
  const fy = (v: number) => 1 - (v - lo) / (hi - lo);
  const left = (f: number) => `calc(var(--axis) + (100% - var(--axis)) * ${f.toFixed(4)})`;

  const grid = ticks.map((t) => `
    <div class="chart-grid" style="top:${(fy(t) * H).toFixed(1)}px"></div>
    <span class="chart-ylabel" style="top:${(fy(t) * H - 8).toFixed(1)}px">${formatNumber(t)}</span>`).join('');

  const poly = values.map((v, i) => `${(fx(i) * 1000).toFixed(1)},${(fy(v) * H).toFixed(1)}`).join(' ');

  // Libellés X : premier, milieu, dernier (plus le point choisi) pour éviter les collisions.
  const shown = new Set([0, Math.floor((n - 1) / 2), n - 1]);
  const dots = o.points.map((p, i) => `
    <button type="button" class="chart-hit" style="left:${left(fx(i))};top:${(fy(p.value) * H).toFixed(1)}px"
      data-action="chart-pick" data-chart="${o.id}" data-i="${i}" aria-pressed="${i === sel}"
      aria-label="${e(p.label)} : ${e(formatNumber(p.value))}${e(o.unit)}"><span class="chart-dot${i === sel ? ' on' : ''}"></span></button>`).join('');
  const xlabels = [...shown].map((i) => `
    <span class="chart-xlabel${i === sel ? ' on' : ''}" style="left:${left(fx(i))}">${e(o.points[i].label)}</span>`).join('');
  const selLabel = shown.has(sel) ? '' : `<span class="chart-xlabel on" style="left:${left(fx(sel))}">${e(o.points[sel].label)}</span>`;

  const p = o.points[sel];
  const f = fx(sel);
  const align = f < 0.25 ? 'start' : f > 0.75 ? 'end' : 'center';
  const tipTop = fy(p.value) * H > 70 ? fy(p.value) * H - 74 : fy(p.value) * H + 14;
  const tip = `
    <div class="chart-tip ${align}" style="left:${left(f)};top:${tipTop.toFixed(1)}px" role="status">
      <span class="muted xsmall">${e(p.label)}</span>
      <b>${e(formatNumber(p.value))}${e(o.unit)}</b>
      ${p.detail ? `<span class="xsmall" style="color:var(--text-2)">${e(p.detail)}</span>` : ''}
    </div>`;

  return `
  <div class="chart" role="group" aria-label="${e(o.ariaLabel)}">
    ${grid}
    <svg class="chart-line" viewBox="0 0 1000 ${H}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"></polyline>
    </svg>
    ${dots}
    ${xlabels}${selLabel}
    ${tip}
  </div>`;
}
