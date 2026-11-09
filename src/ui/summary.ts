import type { ActiveSession, AppData } from '../types';
import { escapeHtml as e, formatDate, formatNumber, formatWeight } from '../format';
import { exerciseById, templateById } from '../store';
import { countSets } from './session';

const ICON = { up: '↑', same: '=', down: '↓' } as const;

export function renderSummary(data: AppData, s: ActiveSession): string {
  const t = templateById(data, s.templateId);
  const { done, total } = countSets(s);
  const minutes = Math.round(((s.finishedAt ?? Date.now()) - s.startedAt) / 60000);
  let tonnage = 0;
  for (const b of s.blocks) for (const ex of b.exercises) for (const set of ex.sets) if (set.done && set.w) tonnage += set.w * set.reps;
  const tonnageText = tonnage >= 1000 ? `${formatNumber(Math.round(tonnage / 100) / 10)} t` : `${Math.round(tonnage)} kg`;

  const rows = (s.decisions ?? []).map((d) => {
    const ex = exerciseById(data, d.exerciseId);
    const log = s.blocks.flatMap((b) => b.exercises).find((x) => x.exerciseId === d.exerciseId);
    const unit = ex.kind === 'timed' ? ' s' : '';
    const reps = log ? log.sets.map((x) => (x.done ? x.reps : '✗')).join(' / ') + unit : '';
    const result = d.from !== null ? `${reps} à ${formatWeight(d.from)}` : reps;
    const editable = d.to !== null;
    const editing = s.editingDecision === d.exerciseId;
    const panel = editing ? `
      <div class="dialog" style="margin-bottom:12px">
        <div class="row between">
          <button type="button" class="btn" data-action="decision-step" data-id="${e(d.exerciseId)}" data-dir="-1">−${formatNumber(ex.step)}</button>
          <span class="title" style="font-size:22px">${formatWeight(d.to)}</span>
          <button type="button" class="btn" data-action="decision-step" data-id="${e(d.exerciseId)}" data-dir="1">+${formatNumber(ex.step)}</button>
        </div>
        <button type="button" class="btn btn-primary" style="min-height:44px;font-size:15px" data-action="decision-close">OK</button>
      </div>` : '';
    return `
      <button type="button" class="decision" ${editable ? `data-action="decision-edit" data-id="${e(d.exerciseId)}" aria-expanded="${editing}"` : 'disabled'} aria-label="${e(ex.name)} : prochaine charge ${e(d.to !== null ? formatWeight(d.to) : d.note)}">
        <span class="decision-icon ${d.kind}" aria-hidden="true">${ICON[d.kind]}</span>
        <span class="section" style="flex:1;gap:2px;min-width:0"><span style="font-size:15px;font-weight:600">${e(ex.name)}</span><span class="muted xsmall">${e(result)}</span></span>
        <span class="section" style="align-items:flex-end;gap:2px"><b style="font-size:15px">${d.to !== null ? formatWeight(d.to) : '—'}</b><span class="xsmall note ${d.kind}" style="font-weight:600${d.kind === 'same' ? ';color:var(--muted)' : ''}">${e(d.note)}</span></span>
      </button>${panel}`;
  }).join('');

  const feelings = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((v) => `<button type="button" data-action="feeling" data-v="${v}" aria-pressed="${s.feeling === v}" aria-label="Ressenti ${v} sur 10">${v}</button>`)
    .join('');

  return `
  <div class="screen">
    <header class="section" style="gap:4px">
      <span class="eyebrow">Séance terminée</span>
      <h1 class="title" style="font-size:28px">${e(t?.name ?? s.templateId)}</h1>
      <span class="muted" style="font-size:14px">${formatDate(s.startedAt, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </header>
    <div class="stats">
      <div class="stat"><span class="muted xsmall">Durée</span><b>${minutes} min</b></div>
      <div class="stat"><span class="muted xsmall">Séries</span><b>${done} / ${total}</b></div>
      <div class="stat"><span class="muted xsmall">Tonnage</span><b>${tonnageText}</b></div>
    </div>
    <section class="section" aria-label="Charges de la prochaine fois">
      <div class="row between"><h2 class="section-title">Charges de la prochaine fois</h2><span class="muted xsmall">calculées auto</span></div>
      <div class="card decisions">${rows}</div>
      <span class="muted xsmall" style="padding:0 4px">Touche une ligne pour choisir une autre charge.</span>
    </section>
    <section class="section" aria-label="Ressenti">
      <h2 class="section-title">Ressenti de la séance</h2>
      <div class="feelings">${feelings}</div>
      <div class="row between muted xsmall"><span>Très facile</span><span>Au max</span></div>
    </section>
    <div class="section" style="margin-top:auto">
      <button type="button" class="btn btn-primary" data-action="commit">Enregistrer la séance</button>
      <button type="button" class="btn btn-ghost" data-action="resume">Revenir à la séance</button>
    </div>
  </div>`;
}
