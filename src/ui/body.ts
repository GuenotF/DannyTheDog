import type { AppData } from '../types';
import { escapeHtml as e, formatDate, formatNumber } from '../format';
import { renderLineChart } from './chart';
import { renderNav } from './nav';

export interface BodyUi {
  metric: 'weight' | 'waist';
  selected: number | null;
  draftWeight: number | null;
  draftWaist: number | null;
}

const f1 = (n: number) => formatNumber(Math.round(n * 10) / 10);

export function bodyDefaults(data: AppData): { weight: number | null; waist: number | null } {
  const lastW = [...data.body].reverse().find((b) => b.weight !== null)?.weight ?? 60;
  const lastT = [...data.body].reverse().find((b) => b.waist !== null)?.waist ?? null;
  return { weight: lastW, waist: lastT };
}

export function renderBody(data: AppData, ui: BodyUi): string {
  const isW = ui.metric === 'weight';
  const unit = isW ? ' kg' : ' cm';
  const pts = data.body.filter((b) => (isW ? b.weight : b.waist) !== null);
  let chart = `<span class="muted small">Pas encore de mesure de ${isW ? 'poids' : 'tour de taille'}.</span>`;
  if (pts.length) {
    const vals = pts.map((b) => (isW ? b.weight! : b.waist!));
    const diff = vals[vals.length - 1] - vals[0];
    chart = `
      <div class="row" style="gap:10px;align-items:baseline">
        <span class="title" style="font-size:36px;letter-spacing:-1px">${f1(vals[vals.length - 1])}${unit}</span>
        ${pts.length > 1 ? `<span style="font-size:14px;font-weight:600;color:var(--text-2)">${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${f1(Math.abs(diff))}${unit} depuis le ${formatDate(pts[0].at, { day: 'numeric', month: 'short' })}</span>` : ''}
      </div>
      ${renderLineChart({
        id: 'body',
        points: pts.map((b, i) => ({ label: formatDate(b.at, { day: 'numeric', month: 'short' }), value: vals[i] })),
        selected: ui.selected,
        unit,
        minSpan: isW ? 1 : 2,
        ariaLabel: isW ? 'Évolution du poids' : 'Évolution du tour de taille'
      })}`;
  }

  const rows = [...data.body].reverse().slice(0, 10).map((b) => `
    <div class="table-row" style="cursor:default">
      <span style="flex:1;font-size:14px">${formatDate(b.at)}</span>
      <span style="width:76px;text-align:right;font-size:14px;font-weight:700">${b.weight !== null ? f1(b.weight) + ' kg' : '—'}</span>
      <span class="muted" style="width:64px;text-align:right;font-size:14px">${b.waist !== null ? f1(b.waist) + ' cm' : '—'}</span>
      <button type="button" class="icon-btn" style="border:none;background:transparent;color:var(--muted)" data-action="body-delete" data-id="${e(b.id)}" aria-label="Supprimer la mesure du ${formatDate(b.at)}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
      </button>
    </div>`).join('');

  const field = (key: 'weight' | 'waist', label: string, value: number | null, step: string, u: string) => `
    <div class="measure">
      <label class="muted xsmall" for="m-${key}">${label}</label>
      <div class="row between" style="gap:4px">
        <button type="button" class="step-btn" style="background:var(--surface)" data-action="body-step" data-key="${key}" data-dir="-1" aria-label="${label} : moins ${step}">−</button>
        <span class="row" style="gap:2px;align-items:baseline"><input id="m-${key}" class="measure-input" type="number" inputmode="decimal" step="any" min="0" value="${value ?? ''}" placeholder="—" data-change="body-input" data-key="${key}"><span class="muted small">${u}</span></span>
        <button type="button" class="step-btn" style="background:var(--surface)" data-action="body-step" data-key="${key}" data-dir="1" aria-label="${label} : plus ${step}">+</button>
      </div>
    </div>`;

  return `
  <div class="screen with-nav">
    <header class="section" style="gap:4px">
      <h1 class="title" style="font-size:28px">Corps</h1>
      <span class="muted" style="font-size:14px">Poids le matin 2 à 3 fois par semaine, tour de taille toutes les 2 semaines.</span>
    </header>
    <section class="card section" aria-label="Nouvelle mesure" style="gap:12px">
      <div class="row between"><h2 class="section-title">Nouvelle mesure</h2><span class="muted small">aujourd'hui</span></div>
      <div class="measures">
        ${field('weight', 'Poids', ui.draftWeight, '100 g', 'kg')}
        ${field('waist', 'Tour de taille (optionnel)', ui.draftWaist, '0,5 cm', 'cm')}
      </div>
      <button type="button" class="btn btn-primary" style="min-height:52px;font-size:16px" data-action="body-save">Enregistrer la mesure</button>
    </section>
    <section class="card section" aria-label="Évolution" style="gap:14px">
      <div class="segmented" role="group" aria-label="Mesure affichée">
        <button type="button" data-action="body-metric" data-id="weight" aria-pressed="${isW}">Poids</button>
        <button type="button" data-action="body-metric" data-id="waist" aria-pressed="${!isW}">Tour de taille</button>
      </div>
      ${chart}
    </section>
    ${rows ? `<section class="section" aria-label="Dernières mesures"><h2 class="section-title">Dernières mesures</h2><div class="card" style="padding:4px 6px 4px 14px">${rows}</div></section>` : ''}
  </div>
  ${renderNav('corps')}`;
}
