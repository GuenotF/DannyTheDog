import type { ActiveSession, AppData, BlockLog } from '../types';
import { escapeHtml as e, formatDate, formatNumber, formatRest, formatWeight } from '../format';
import { exerciseById, lastLog, progressOf, templateById } from '../store';
import { icons } from './icons';

const range = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

export function countSets(s: ActiveSession) {
  let done = 0;
  let total = 0;
  for (const b of s.blocks) for (const ex of b.exercises) for (const set of ex.sets) {
    total++;
    if (set.done) done++;
  }
  return { done, total };
}

/** Prochaine série à faire, dans l'ordre réel (les supersets alternent les exercices). */
export function nextSetLabel(data: AppData, s: ActiveSession): string {
  for (const b of s.blocks) {
    const maxSets = Math.max(...b.exercises.map((x) => x.sets.length));
    for (let si = 0; si < maxSets; si++) {
      for (const ex of b.exercises) {
        const set = ex.sets[si];
        if (set && !set.done) {
          const def = exerciseById(data, ex.exerciseId);
          const unit = def.kind === 'timed' ? ' s' : '';
          const w = set.w === null ? '' : `${formatWeight(set.w)} × `;
          return `${def.name} · série ${si + 1} · ${w}${set.reps}${unit}`;
        }
      }
    }
  }
  return '';
}

/** Repos à lancer après avoir validé une série. */
export function restAfter(block: BlockLog, exerciseIndex: number): number {
  if (block.exercises.length > 1) return exerciseIndex === block.exercises.length - 1 ? block.rest : 0;
  return block.rest;
}

function renderBlock(data: AppData, s: ActiveSession, b: BlockLog, bi: number): string {
  const isSuper = b.exercises.length > 1;
  const cards = b.exercises.map((log, ei) => {
    const ex = exerciseById(data, log.exerciseId);
    const isTimed = ex.kind === 'timed';
    const noWeight = isTimed || ex.kind === 'bodyweight';
    const p = progressOf(data, log.exerciseId);
    const last = lastLog(data, log.exerciseId);
    const lastText = last
      ? `${noWeight ? '' : formatWeight(Math.min(...last.log.sets.map((x) => x.w ?? 0))) + ' · '}${last.log.sets.map((x) => x.reps).join(' / ')}${isTimed ? ' s' : ''} (${formatDate(last.at)})`
      : 'première fois';
    const meta = `${log.sets.length} × ${range(log.repsMin, log.repsMax)}${isTimed ? ' s' : ''}${isSuper ? '' : ' · repos ' + formatRest(b.rest)}`;
    const badge = p.lastChange ? `<span class="badge${p.lastChange < 0 ? ' down' : ''}">${p.lastChange > 0 ? '+' : '−'}${formatNumber(Math.abs(p.lastChange))} kg</span>` : '';
    const firstOpen = log.sets.findIndex((x) => !x.done);

    const rows = log.sets.map((set, si) => {
      const key = `${bi}-${ei}-${si}`;
      const editing = s.editing === key;
      const cls = set.done ? 'set done' : si === firstOpen ? 'set current' : 'set';
      const wLabel = noWeight ? (isTimed ? 'Gainage' : 'Poids du corps') : formatWeight(set.w);
      const weightBtn = `<button type="button" class="weight-btn${!noWeight && set.w === null ? ' unset' : ''}" ${noWeight ? 'disabled' : `data-action="edit-weight" data-key="${key}" aria-expanded="${editing}"`} aria-label="Charge de la série ${si + 1} : ${e(wLabel)}">${e(wLabel)}</button>`;
      const panel = editing ? `
        <div class="weight-panel">
          <div class="row between" style="gap:8px">
            <button type="button" class="btn" data-action="weight-step" data-key="${key}" data-dir="-1">−${formatNumber(ex.step)}</button>
            <label class="visually-hidden" for="w-${key}">Charge en kg</label>
            <input id="w-${key}" class="weight-input" type="number" inputmode="decimal" step="any" min="0" value="${set.w ?? ''}" placeholder="kg" data-change="weight-input" data-key="${key}">
            <button type="button" class="btn" data-action="weight-step" data-key="${key}" data-dir="1">+${formatNumber(ex.step)}</button>
          </div>
          <label class="check-label"><input type="checkbox" data-change="apply-next" ${s.applyNext ? 'checked' : ''}> Appliquer aux séries suivantes</label>
          <button type="button" class="btn btn-primary" style="min-height:44px;font-size:15px" data-action="close-edit">OK</button>
        </div>` : '';
      return `
        <div class="${cls}">
          <span class="set-num">${si + 1}</span>
          ${weightBtn}
          <div class="reps">
            <button type="button" class="step-btn" data-action="reps" data-key="${key}" data-dir="-1" aria-label="${isTimed ? '5 secondes de moins' : 'Une répétition de moins'}">−</button>
            <span class="reps-value">${set.reps}<span> ${isTimed ? 's' : 'reps'}</span></span>
            <button type="button" class="step-btn" data-action="reps" data-key="${key}" data-dir="1" aria-label="${isTimed ? '5 secondes de plus' : 'Une répétition de plus'}">+</button>
          </div>
          <button type="button" class="check" data-action="toggle-set" data-key="${key}" aria-pressed="${set.done}" aria-label="${set.done ? 'Annuler' : 'Valider'} la série ${si + 1}">${icons.check}</button>
        </div>${panel}`;
    }).join('');

    return `
      <article class="card exercise">
        <div class="row between" style="align-items:flex-start;gap:8px">
          <div class="section" style="gap:3px"><h2>${e(ex.name)}</h2><span class="muted small">${meta}</span></div>
          ${badge}
        </div>
        <span class="muted xsmall">Dernière fois : ${e(lastText)}</span>
        <div class="sets">${rows}</div>
      </article>`;
  }).join('');

  if (!isSuper) return cards;
  return `
    <section class="superset" aria-label="Superset ${e(b.label ?? '')}">
      <div class="row" style="gap:8px;padding:2px 4px 0"><span class="badge super">Superset ${e(b.label ?? '')}</span><span class="muted small">Enchaîne les deux, puis repos ${formatRest(b.rest)}</span></div>
      ${cards}
    </section>`;
}

export function renderSession(data: AppData, s: ActiveSession): string {
  const t = templateById(data, s.templateId);
  const { done, total } = countSets(s);
  return `
  <div class="screen session-screen">
    <header class="session-header">
      <div class="row between">
        <a class="icon-btn" href="#/" aria-label="Retour à l'accueil (la séance reste en cours)">${icons.back}</a>
        <div class="section" style="flex:1;gap:2px;min-width:0">
          <span class="title" style="font-size:18px;letter-spacing:0">${e(t?.name ?? s.templateId)}</span>
          <span class="muted small"><span id="elapsed">0:00</span> · ${done}/${total} séries</span>
        </div>
        <button type="button" class="btn btn-outline" data-action="finish">Terminer</button>
      </div>
      <div class="progress"><div style="width:${total ? (done / total) * 100 : 0}%"></div></div>
    </header>
    <main class="section" style="gap:16px">
      ${s.blocks.map((b, bi) => renderBlock(data, s, b, bi)).join('')}
      <button type="button" class="btn btn-primary" data-action="finish">Terminer la séance</button>
    </main>
    <div class="timer" role="timer" aria-live="off">
      <div class="card">
        <div class="row between">
          <div class="section" style="gap:2px;min-width:0">
            <span id="timer-title" class="xsmall muted" style="font-weight:600;text-transform:uppercase;letter-spacing:0.6px">À toi de jouer</span>
            <span id="timer-next" class="small" style="color:var(--text-2)"></span>
          </div>
          <span id="timer-clock" class="timer-clock go">GO</span>
        </div>
        <div class="progress"><div id="timer-bar" style="width:0%"></div></div>
        <div class="timer-grid">
          <button type="button" class="btn" data-action="rest-add" data-sec="-15">−15 s</button>
          <button type="button" class="btn" data-action="rest-add" data-sec="15">+15 s</button>
          <button type="button" class="btn btn-light" data-action="rest-skip">Passer</button>
        </div>
      </div>
    </div>
  </div>`;
}
