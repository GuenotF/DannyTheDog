import type { AppData } from '../types';
import { escapeHtml as e, formatDate, formatNumber, formatWeight } from '../format';
import { exerciseById, progressOf } from '../store';
import { exerciseSeries } from '../stats';
import { renderLineChart } from './chart';
import { renderNav } from './nav';

export interface ProgressUi {
  exercise: string | null;
  selected: number | null;
}

/** Exercices avec charge présents dans les séances, dans l'ordre des séances. */
function weightedExercises(data: AppData): string[] {
  const ids: string[] = [];
  for (const t of data.templates) for (const b of t.blocks) for (const it of b.items) {
    const ex = exerciseById(data, it.exerciseId);
    if ((ex.kind === 'heavy' || ex.kind === 'isolation') && !ids.includes(ex.id)) ids.push(ex.id);
  }
  return ids;
}

export function renderProgress(data: AppData, ui: ProgressUi): string {
  const all = weightedExercises(data);
  const withData = all.filter((id) => exerciseSeries(data, id).length > 0);
  const current = ui.exercise && all.includes(ui.exercise) ? ui.exercise : withData[0] ?? all[0];
  const ex = exerciseById(data, current);
  const series = exerciseSeries(data, current);

  const chipIds = withData.length ? withData : all.slice(0, 6);
  if (!chipIds.includes(current)) chipIds.unshift(current);
  const chips = chipIds.map((id) =>
    `<button type="button" class="chip" data-action="prog-pick" data-id="${e(id)}" aria-pressed="${id === current}">${e(exerciseById(data, id).name)}</button>`).join('');

  let hero = '';
  if (series.length === 0) {
    hero = `<span class="muted small">Pas encore de séance enregistrée pour cet exercice. La courbe apparaîtra après ta première séance.</span>`;
  } else {
    const first = series[0];
    const last = series[series.length - 1];
    const diff = Math.round((last.value - first.value) * 100) / 100;
    const record = Math.max(...series.map((s) => s.value));
    hero = `
      <div class="section" style="gap:2px">
        <span class="muted small">Charge de travail · ${e(ex.name)}</span>
        <div class="row" style="gap:10px;align-items:baseline">
          <span class="title" style="font-size:40px;letter-spacing:-1px">${formatWeight(last.value)}</span>
          <span style="font-size:14px;font-weight:700;color:${diff > 0 ? 'var(--accent)' : 'var(--text-2)'}">${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${formatNumber(Math.abs(diff))} kg</span>
        </div>
        <span class="muted small">depuis le ${formatDate(first.at, { day: 'numeric', month: 'long' })}</span>
      </div>
      ${renderLineChart({
        id: 'prog',
        points: series.map((s) => ({ label: formatDate(s.at, { day: 'numeric', month: 'short' }), value: s.value, detail: s.sets })),
        selected: ui.selected,
        unit: ' kg',
        minSpan: 5,
        ariaLabel: `Évolution de la charge de travail, ${ex.name}`
      })}
      <div class="stats" style="border-top:1px solid #2a2c31;padding-top:12px">
        <div class="section" style="gap:2px"><span class="muted xsmall">Départ</span><b>${formatWeight(first.value)}</b></div>
        <div class="section" style="gap:2px"><span class="muted xsmall">Record</span><b>${formatWeight(record)}</b></div>
        <div class="section" style="gap:2px"><span class="muted xsmall">Séances</span><b>${series.length}</b></div>
      </div>`;
  }

  const rows = all.filter((id) => progressOf(data, id).weight !== null).map((id) => {
    const x = exerciseById(data, id);
    const s = exerciseSeries(data, id);
    const from = s.length ? s[0].value : x.startWeight;
    const to = progressOf(data, id).weight;
    const diff = from !== null && to !== null ? Math.round((to - from) * 100) / 100 : null;
    const badge = diff === null ? '' : `<span class="delta${diff > 0 ? ' up' : ''}">${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${formatNumber(Math.abs(diff))}</span>`;
    return `
      <button type="button" class="table-row" data-action="prog-pick" data-id="${e(id)}" aria-label="${e(x.name)} : ${e(formatWeight(from))} au départ, ${e(formatWeight(to))} aujourd'hui">
        <span style="flex:1;font-size:14px;font-weight:600;text-align:left">${e(x.name)}</span>
        <span class="muted small" style="white-space:nowrap">${formatWeight(from)} →</span>
        <span style="min-width:62px;text-align:right;font-size:14px;font-weight:700;white-space:nowrap">${formatWeight(to)}</span>
        <span style="min-width:44px;text-align:right">${badge}</span>
      </button>`;
  }).join('');

  return `
  <div class="screen with-nav">
    <header><h1 class="title" style="font-size:28px">Progrès</h1></header>
    <div class="chips scroll" role="group" aria-label="Choisir un exercice">${chips}</div>
    <section class="card section" aria-label="Charge de travail" style="gap:14px">${hero}</section>
    <section class="section" aria-label="Toutes les charges">
      <h2 class="section-title">Toutes les charges</h2>
      <div class="card" style="padding:4px 14px">${rows}</div>
      <span class="muted xsmall" style="padding:0 4px">Départ : première séance enregistrée (ou charge de départ du programme). Aujourd'hui : charge prévue à la prochaine séance. Les exercices sans charge définie n'apparaissent pas.</span>
    </section>
  </div>
  ${renderNav('progres')}`;
}
