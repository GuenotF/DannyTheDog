import type { AppData, SessionRecord } from '../types';
import { escapeHtml as e, formatDate, formatNumber, formatWeight } from '../format';
import { exerciseById } from '../store';
import { sessionSetCounts, sessionTonnage, setsText, weekStart } from '../stats';
import { workingWeight } from '../progression';
import { renderNav } from './nav';

export interface HistoryUi {
  filter: string;
  open: string | null;
  confirmDelete: string | null;
}

const ARROW = { up: '↑', same: '=', down: '↓' } as const;
const ARROW_LABEL = { up: 'charge en hausse la prochaine fois', same: 'charge maintenue', down: 'charge en baisse la prochaine fois' } as const;

export function tonnageText(t: number): string {
  return t >= 1000 ? `${formatNumber(Math.round(t / 100) / 10)} t` : `${Math.round(t)} kg`;
}

function weekTitle(start: number, now = Date.now()): string {
  const thisWeek = weekStart(now);
  if (start === thisWeek) return 'Cette semaine';
  if (start === thisWeek - 7 * 86400000) return 'Semaine dernière';
  return `Semaine du ${formatDate(start, { day: 'numeric', month: 'short' })}`;
}

function renderCard(data: AppData, rec: SessionRecord, ui: HistoryUi): string {
  const open = ui.open === rec.id;
  const { done, total } = sessionSetCounts(rec);
  const minutes = Math.round((rec.endedAt - rec.startedAt) / 60000);
  const meta = `${formatDate(rec.endedAt)} · ${minutes} min · ${done}/${total} séries`;
  let detail = '';
  if (open) {
    const rows = rec.blocks.flatMap((b) => b.exercises).map((log) => {
      const ex = exerciseById(data, log.exerciseId);
      const d = rec.decisions.find((x) => x.exerciseId === log.exerciseId);
      const kind = d?.kind ?? 'same';
      const w = ex.kind === 'timed' || ex.kind === 'bodyweight' ? '' : formatWeight(workingWeight(log, null));
      return `
        <div class="hist-ex">
          <span class="section" style="flex:1;gap:2px;min-width:0"><span style="font-size:14px;font-weight:600">${e(ex.name)}</span><span class="muted xsmall">${e(setsText(log, ex.kind === 'timed' ? ' s' : ''))}</span></span>
          <span style="font-size:14px;font-weight:600;white-space:nowrap">${w}</span>
          <span class="hist-arrow ${kind}" aria-label="${ARROW_LABEL[kind]}">${ARROW[kind]}</span>
        </div>`;
    }).join('');
    const del = ui.confirmDelete === rec.id
      ? `<div class="dialog" style="border-color:var(--danger);margin-top:10px">
          <span class="small">Supprimer cette séance de l'historique ? Les charges actuelles ne changent pas.</span>
          <button type="button" class="btn" style="color:var(--danger);border-color:var(--danger)" data-action="hist-delete" data-id="${e(rec.id)}">Oui, supprimer</button>
          <button type="button" class="btn btn-ghost" data-action="hist-delete-cancel">Annuler</button>
        </div>`
      : `<div class="row" style="gap:8px;padding-top:10px;border-top:1px solid #2a2c31">
          <button type="button" class="btn" style="flex:1" data-action="start" data-id="${e(rec.templateId)}">Refaire cette séance</button>
          <button type="button" class="btn btn-danger" data-action="hist-delete-ask" data-id="${e(rec.id)}">Supprimer…</button>
        </div>`;
    detail = `<div class="hist-detail">${rows}${del}</div>`;
  }
  return `
    <article class="hist-card${open ? ' open' : ''}">
      <button type="button" class="hist-head" data-action="hist-toggle" data-id="${e(rec.id)}" aria-expanded="${open}">
        <span class="hist-letter">${e(rec.templateId)}</span>
        <span class="section" style="flex:1;gap:2px;min-width:0"><span style="font-size:15px;font-weight:600">${e(rec.templateName)}</span><span class="muted small">${e(meta)}</span></span>
        <span class="section" style="align-items:flex-end;gap:2px"><b style="font-size:15px">${tonnageText(sessionTonnage(rec))}</b>${rec.feeling ? `<span class="muted xsmall">ressenti ${rec.feeling}/10</span>` : ''}</span>
      </button>
      ${detail}
    </article>`;
}

export function renderHistory(data: AppData, ui: HistoryUi): string {
  const ids = [...new Set([...data.templates.map((t) => t.id), ...data.history.map((h) => h.templateId)])];
  const filters = ['Toutes', ...ids].map((f) =>
    `<button type="button" class="chip" data-action="hist-filter" data-id="${e(f)}" aria-pressed="${ui.filter === f}">${e(f)}</button>`).join('');

  const visible = [...data.history].reverse().filter((h) => ui.filter === 'Toutes' || h.templateId === ui.filter);
  const groups = new Map<number, SessionRecord[]>();
  for (const h of visible) {
    const k = weekStart(h.endedAt);
    groups.set(k, [...(groups.get(k) ?? []), h]);
  }
  const weeks = [...groups.entries()].map(([start, recs]) => `
    <section class="section">
      <div class="row between"><h2 style="font-size:15px;font-weight:700">${weekTitle(start)}</h2><span class="muted small">${recs.length} séance${recs.length > 1 ? 's' : ''}</span></div>
      ${recs.map((r) => renderCard(data, r, ui)).join('')}
    </section>`).join('');

  const first = data.history[0];
  const sub = data.history.length
    ? `${data.history.length} séance${data.history.length > 1 ? 's' : ''} depuis le ${formatDate(first.endedAt, { day: 'numeric', month: 'long' })}`
    : 'Aucune séance enregistrée';

  const empty = data.history.length === 0
    ? `<div class="card section" style="align-items:flex-start"><span style="font-weight:600">Pas encore de séance</span><span class="muted small">Tes séances enregistrées apparaîtront ici, groupées par semaine.</span><a class="btn" href="#/">Aller à l'accueil</a></div>`
    : visible.length === 0 ? '<span class="muted small">Aucune séance pour ce filtre.</span>' : '';

  return `
  <div class="screen with-nav">
    <header class="section" style="gap:4px">
      <h1 class="title" style="font-size:28px">Historique</h1>
      <span class="muted" style="font-size:14px">${e(sub)}</span>
    </header>
    ${data.history.length ? `<div class="chips" role="group" aria-label="Filtrer par séance">${filters}</div>` : ''}
    ${weeks}${empty}
  </div>
  ${renderNav('historique')}`;
}
