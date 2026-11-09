import type { AppData, Template } from '../types';
import { escapeHtml as e, formatDate, formatNumber, formatWeight } from '../format';
import { exerciseById, progressOf } from '../store';
import { icons } from './icons';
import { renderNav } from './nav';

const DAY_LABELS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - dow);
  return d;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Séance suggérée : on alterne les séances obligatoires dans l'ordre de la semaine. */
export function nextTemplate(data: AppData): Template | undefined {
  const required = data.templates.filter((t) => !t.optional).sort((a, b) => a.day - b.day);
  if (required.length === 0) return data.templates[0];
  const last = [...data.history].reverse().find((h) => required.some((t) => t.id === h.templateId));
  if (!last) return required[0];
  const i = required.findIndex((t) => t.id === last.templateId);
  return required[(i + 1) % required.length];
}

export function backupOverdue(data: AppData, now = Date.now()): number | null {
  if (data.history.length === 0) return null;
  const ref = data.lastExport ? Date.parse(data.lastExport) : data.history[0].endedAt;
  const days = Math.floor((now - ref) / 86400000);
  return days >= 7 ? days : null;
}

function changeBadge(change: number): string {
  if (!change) return '';
  return `<span class="badge${change < 0 ? ' down' : ''}">${change > 0 ? '+' : '−'}${formatNumber(Math.abs(change))}</span>`;
}

export function renderHome(data: AppData, now = new Date()): string {
  const monday = startOfWeek(now);
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 7);
  const weekSessions = data.history.filter((h) => h.endedAt >= monday.getTime() && h.endedAt < weekEnd.getTime());
  const requiredCount = data.templates.filter((t) => !t.optional).length;

  const days = DAY_LABELS.map((label, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const done = weekSessions.filter((h) => sameDay(new Date(h.endedAt), date)).map((h) => h.templateId);
    const planned = data.templates.find((t) => t.day === i + 1);
    let tag = '<span class="day-tag">·</span>';
    if (done.length) tag = `<span class="day-tag done">${e(done.join('+'))}</span>`;
    else if (data.settings.footDay === i + 1) tag = '<span class="day-tag">Foot</span>';
    else if (planned) tag = `<span class="day-tag planned${planned.optional ? ' optional' : ''}">${e(planned.id)}</span>`;
    return `<div class="day${sameDay(date, now) ? ' today' : ''}"><span class="day-label">${label}</span>${tag}</div>`;
  }).join('');

  let main = '';
  const active = data.active;
  if (active) {
    const t = data.templates.find((x) => x.id === active.templateId);
    const finishing = !!active.finishedAt;
    main = `
      <section class="card resume section" aria-label="Séance en cours">
        <span class="eyebrow">${finishing ? 'Séance terminée, à enregistrer' : 'Séance en cours'}</span>
        <h1 class="title" style="font-size:26px">${e(t?.name ?? active.templateId)}</h1>
        <span class="muted small">Commencée ${formatDate(active.startedAt, { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</span>
        <a class="btn btn-primary" href="#/${finishing ? 'fin' : 'seance'}">${icons.play} Reprendre</a>
      </section>`;
  } else {
    const next = nextTemplate(data);
    if (next) {
      const items = next.blocks.flatMap((b) => b.items);
      const preview = items.slice(0, 3).map((it) => {
        const ex = exerciseById(data, it.exerciseId);
        const p = progressOf(data, it.exerciseId);
        const w = ex.kind === 'timed' || ex.kind === 'bodyweight' ? '' : formatWeight(p.weight);
        return `<div class="preview-item"><span>${e(ex.name)}</span><span class="row" style="gap:8px"><b>${w}</b>${changeBadge(p.lastChange)}</span></div>`;
      }).join('');
      const supersets = next.blocks.filter((b) => b.items.length > 1).length;
      main = `
        <section class="card section" aria-label="Prochaine séance" style="gap:16px">
          <div class="section" style="gap:4px">
            <span class="eyebrow">Prochaine séance${DAY_NAMES[next.day - 1] ? ' · ' + DAY_NAMES[next.day - 1] : ''}</span>
            <h1 class="title" style="font-size:28px">${e(next.name)}</h1>
            <span class="muted small">${items.length} exercices${supersets ? ` · ${supersets} superset${supersets > 1 ? 's' : ''}` : ''}</span>
          </div>
          <div class="preview-list">
            ${preview}
            ${items.length > 3 ? `<span class="muted small" style="padding-left:4px">+ ${items.length - 3} autres exercices</span>` : ''}
          </div>
          <button type="button" class="btn btn-primary" data-action="start" data-id="${e(next.id)}">${icons.play} Démarrer la séance</button>
        </section>`;
    }
  }

  const nextId = active ? active.templateId : nextTemplate(data)?.id;
  const others = data.templates.filter((t) => t.id !== nextId).map((t) => {
    const last = [...data.history].reverse().find((h) => h.templateId === t.id);
    const sub = [DAY_NAMES[t.day - 1], t.optional ? 'optionnelle' : '', last ? 'dernière : ' + formatDate(last.endedAt) : 'jamais faite'].filter(Boolean).join(' · ');
    return `<button type="button" class="tpl-link${t.optional ? ' optional' : ''}" data-action="start" data-id="${e(t.id)}">
      <span class="section" style="gap:2px"><span style="font-size:15px;font-weight:600">${e(t.name)}</span><span class="muted small">${e(sub.charAt(0).toUpperCase() + sub.slice(1))}</span></span>
      <span class="muted">${icons.chevron}</span></button>`;
  }).join('');

  const overdue = backupOverdue(data);
  const banner = overdue !== null
    ? `<a class="banner-warn" href="#/donnees" style="margin-top:auto">${icons.download}<span>Dernière sauvegarde il y a ${overdue} jours</span><strong>Exporter</strong></a>`
    : '';

  return `
  <div class="screen with-nav">
    <header class="row between">
      <div class="row" style="gap:10px"><span class="logo">${icons.logo}</span><span class="title" style="font-size:20px">Danny the DOG</span></div>
      <a class="icon-btn" href="#/donnees" aria-label="Données et sauvegarde">${icons.data}</a>
    </header>
    <section class="section" aria-label="Cette semaine">
      <div class="row between"><h2 style="font-size:15px;font-weight:600">Cette semaine</h2><span class="muted small">${weekSessions.length} / ${requiredCount} séances</span></div>
      <div class="week">${days}</div>
    </section>
    ${main}
    ${others ? `<section class="section" aria-label="Autres séances"><h2 style="font-size:15px;font-weight:600">${active ? 'Séances' : 'Autres séances'}</h2>${others}</section>` : ''}
    <a class="btn" href="#/seances" style="align-self:flex-start">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
      Gérer mes séances</a>
    ${banner}
  </div>
  ${renderNav('home')}`;
}
