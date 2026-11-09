import type { AppData, ExerciseKind } from '../types';
import { escapeHtml as e, formatNumber, formatWeight } from '../format';
import { draftExercise, type EditorDraft } from '../editor';
import { exerciseById } from '../store';

export interface PickerState {
  mode: 'add' | 'replace';
  bi?: number;
  xi?: number;
  query: string;
  filter: ExerciseKind | 'all';
  create: boolean;
  name: string;
  kind: ExerciseKind;
  step: number;
  start: number;
}

export interface EditorUi {
  draft: EditorDraft | null;
  open: string | null;
  picker: PickerState | null;
  confirmDelete: boolean;
}

export const KIND_LABEL: Record<ExerciseKind, string> = { heavy: 'Lourd', isolation: 'Isolation', timed: 'Temps', bodyweight: 'Poids du corps' };
const KIND_HELP: Record<ExerciseKind, string> = {
  heavy: '+pas si toutes les séries atteignent le minimum ; −10 % au 2e échec.',
  isolation: '+pas quand toutes les séries atteignent le maximum.',
  timed: 'Pas de charge, objectif en secondes.',
  bodyweight: 'Pas de charge, objectif en reps.'
};
const KINDS: ExerciseKind[] = ['heavy', 'isolation', 'timed', 'bodyweight'];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Tuile −/+ ; `field` est transmis à l'action « ed-field ». */
function stepper(label: string, value: string, key: string, field: string): string {
  return `
    <div class="tile">
      <span class="tile-label">${label}</span>
      <div class="row between" style="gap:2px">
        <button type="button" class="tile-btn" data-action="ed-field" data-key="${key}" data-field="${field}" data-dir="-1" aria-label="${label} : moins">−</button>
        <span class="tile-value">${value}</span>
        <button type="button" class="tile-btn" data-action="ed-field" data-key="${key}" data-field="${field}" data-dir="1" aria-label="${label} : plus">+</button>
      </div>
    </div>`;
}

function kindButtons(current: ExerciseKind, action: string, key = ''): string {
  return `<div class="kind-grid" role="group" aria-label="Type d'exercice">${KINDS.map((k) =>
    `<button type="button" data-action="${action}" data-key="${key}" data-kind="${k}" aria-pressed="${k === current}">${KIND_LABEL[k]}</button>`).join('')}</div>`;
}

export function renderEditor(data: AppData, ui: EditorUi): string {
  const d = ui.draft!;
  const t = d.template;
  const days = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((l, i) =>
    `<button type="button" data-action="ed-day" data-day="${i + 1}" aria-pressed="${t.day === i + 1}" aria-label="${['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][i]}">${l}</button>`).join('');

  let supers = 0;
  let count = 0;
  const blocks = t.blocks.map((b, bi) => {
    const isSuper = b.items.length > 1;
    if (isSuper) supers++;
    const items = b.items.map((it, xi) => {
      count++;
      const key = `${bi}-${xi}`;
      const ex = draftExercise(data, d, it.exerciseId);
      const timed = ex.kind === 'timed';
      const u = timed ? ' s' : '';
      const open = ui.open === key;
      const fields = [stepper('Séries', String(it.sets), key, 'sets')];
      if (!isSuper) fields.push(stepper('Repos', clock(b.rest), key, 'rest'));
      fields.push(stepper(`${timed ? 'Durée' : 'Reps'} min`, `${it.repsMin}${u}`, key, 'min'));
      fields.push(stepper(`${timed ? 'Durée' : 'Reps'} max`, `${it.repsMax}${u}`, key, 'max'));
      const noWeight = ex.kind === 'timed' || ex.kind === 'bodyweight';
      const settings = open ? `
        <div class="ex-settings">
          <span class="muted xsmall">Réglages de l'exercice, valables dans toutes les séances</span>
          ${kindButtons(ex.kind, 'ed-kind', key)}
          <span class="muted xsmall">${KIND_HELP[ex.kind]}</span>
          <div class="tiles">
            ${stepper('Pas de charge', `${formatNumber(ex.step)}${timed ? ' s' : ' kg'}`, key, 'step')}
            ${noWeight ? '' : `
            <div class="tile">
              <label class="tile-label" for="w-${key}">Charge actuelle</label>
              <div class="row between" style="gap:2px">
                <button type="button" class="tile-btn" data-action="ed-field" data-key="${key}" data-field="weight" data-dir="-1" aria-label="Charge : moins">−</button>
                <span class="row" style="gap:2px;align-items:baseline"><input id="w-${key}" class="tile-input" type="number" inputmode="decimal" step="any" min="0" value="${ex.weight ?? ''}" placeholder="—" data-change="ed-weight" data-key="${key}"><span class="muted xsmall">kg</span></span>
                <button type="button" class="tile-btn" data-action="ed-field" data-key="${key}" data-field="weight" data-dir="1" aria-label="Charge : plus">+</button>
              </div>
            </div>`}
          </div>
        </div>` : '';
      const iconBtn = (action: string, label: string, path: string, extra = '') =>
        `<button type="button" class="ed-icon" data-action="${action}" data-key="${key}" aria-label="${label}" ${extra}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></button>`;
      return `
        <article class="card ed-card">
          <div class="row" style="gap:2px">
            <button type="button" class="ed-name" data-action="ed-replace" data-key="${key}" aria-label="Changer d'exercice : ${e(ex.name)}">
              <span style="font-size:15px;font-weight:700">${e(ex.name)}</span>
              <span class="muted xsmall">${KIND_LABEL[ex.kind]}${noWeight ? '' : ' · ' + formatWeight(ex.weight)} · toucher pour changer</span>
            </button>
            ${iconBtn('ed-up', `Monter ${e(ex.name)}`, '<path d="M6 15l6-6 6 6"></path>')}
            ${iconBtn('ed-down', `Descendre ${e(ex.name)}`, '<path d="M6 9l6 6 6-6"></path>')}
            ${iconBtn('ed-settings', `Réglages de ${e(ex.name)}`, '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path>', `aria-expanded="${open}"`)}
            ${iconBtn('ed-remove', `Retirer ${e(ex.name)}`, '<path d="M6 6l12 12M18 6L6 18"></path>', 'style="color:var(--danger)"')}
          </div>
          <div class="tiles">${fields.join('')}</div>
          ${settings}
        </article>`;
    }).join('');

    const link = bi > 0 && !isSuper
      ? `<button type="button" class="link-btn" data-action="ed-link" data-bi="${bi}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg>
          Lier en superset avec le précédent</button>`
      : '';
    if (!isSuper) return `${link}${items}`;
    return `
      <section class="superset" aria-label="Superset S${supers}">
        <div class="row" style="gap:8px;padding:2px 4px"><span class="badge super">Superset S${supers}</span><span style="flex:1"></span>
          <button type="button" class="btn btn-ghost" style="color:var(--superset);min-height:36px" data-action="ed-unlink" data-bi="${bi}">Dissocier</button></div>
        ${items}
        <div class="row between" style="padding:4px 6px 2px">
          <span class="small" style="color:var(--text-2)">Repos après le superset</span>
          <div class="row" style="gap:6px">
            <button type="button" class="tile-btn" style="background:var(--surface-2);width:36px" data-action="ed-field" data-key="${bi}-0" data-field="rest" data-dir="-1" aria-label="Repos : moins 15 secondes">−</button>
            <span style="min-width:48px;text-align:center;font-weight:700">${clock(b.rest)}</span>
            <button type="button" class="tile-btn" style="background:var(--surface-2);width:36px" data-action="ed-field" data-key="${bi}-0" data-field="rest" data-dir="1" aria-label="Repos : plus 15 secondes">+</button>
          </div>
        </div>
      </section>`;
  }).join('');

  const del = d.originalId === null ? '' : ui.confirmDelete
    ? `<div class="dialog" style="border-color:var(--danger)">
        <span class="small">Supprimer cette séance ? Les séances déjà faites restent dans l'historique.</span>
        <button type="button" class="btn" style="color:var(--danger);border-color:var(--danger)" data-action="tpl-delete" data-id="${e(d.originalId)}">Oui, supprimer</button>
        <button type="button" class="btn btn-ghost" data-action="ed-delete-cancel">Annuler</button>
      </div>`
    : `<button type="button" class="btn btn-danger" data-action="ed-delete-ask">Supprimer cette séance…</button>`;

  return `
  <div class="screen session-screen">
    <header class="session-header" style="flex-direction:row;align-items:center">
      <button type="button" class="icon-btn" data-action="ed-cancel" aria-label="Annuler les modifications"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
      <h1 class="title" style="flex:1;min-width:0;font-size:18px;letter-spacing:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.originalId === null ? 'Nouvelle séance' : 'Modifier la séance'}</h1>
      <button type="button" class="btn btn-primary" style="width:auto;min-height:44px;font-size:15px;padding:0 16px" data-action="ed-save">Enregistrer</button>
    </header>
    <main class="section" style="gap:18px;padding-bottom:32px">
      <section class="card section" aria-label="Informations" style="gap:14px">
        <div style="display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px">
          <label class="field-label">Lettre<input class="text-input" style="text-align:center;font-weight:700" maxlength="3" value="${e(t.id)}" data-change="ed-id"></label>
          <label class="field-label">Nom<input class="text-input" style="font-weight:600" value="${e(t.name)}" data-change="ed-name"></label>
        </div>
        <div class="section" style="gap:6px">
          <span class="field-label">Jour prévu <span class="muted">(touche à nouveau pour retirer)</span></span>
          <div class="days-grid" role="group" aria-label="Jour prévu">${days}</div>
        </div>
        <label class="row between" style="min-height:44px;cursor:pointer">
          <span class="section" style="gap:2px"><span style="font-size:15px">Séance optionnelle</span><span class="muted xsmall">Hors alternance des séances proposées à l'accueil</span></span>
          <input type="checkbox" class="switch" ${t.optional ? 'checked' : ''} data-change="ed-optional">
        </label>
      </section>
      <section class="section" aria-label="Exercices">
        <div class="row between"><h2 class="section-title">Exercices</h2><span class="muted small">${count} exercice${count > 1 ? 's' : ''}${supers ? ` · ${supers} superset${supers > 1 ? 's' : ''}` : ''}</span></div>
        ${blocks || '<span class="muted small">Aucun exercice pour le moment.</span>'}
        <button type="button" class="btn btn-dashed" data-action="ed-add">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
          Ajouter un exercice</button>
      </section>
      ${del}
    </main>
  </div>
  ${ui.picker ? renderPicker(data, ui) : ''}`;
}

/** Liste filtrée du panneau (re-rendue seule pendant la frappe). */
export function renderPickerList(data: AppData, ui: EditorUi): string {
  const p = ui.picker!;
  const d = ui.draft!;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const inSession = new Set(d.template.blocks.flatMap((b) => b.items.map((i) => i.exerciseId)));
  const all = [...data.exercises, ...d.created]
    .map((x) => draftExercise(data, d, x.id))
    .filter((x) => (p.filter === 'all' || x.kind === p.filter) && norm(x.name).includes(norm(p.query)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (all.length === 0) return `<span class="muted small" style="padding:14px 0;display:block">Aucun exercice trouvé.</span>`;
  return all.map((x) => {
    const noW = x.kind === 'timed' || x.kind === 'bodyweight';
    const meta = `${KIND_LABEL[x.kind]} · ${noW ? 'sans charge' : x.weight === null ? 'charge à définir' : formatWeight(x.weight)}`;
    const already = inSession.has(x.id);
    return `
      <div class="pick-row">
        <span class="section" style="flex:1;gap:2px;min-width:0"><span style="font-size:15px;font-weight:600">${e(x.name)}</span><span class="muted xsmall">${e(meta)}</span></span>
        ${already ? '<span class="muted xsmall" style="padding-right:6px">déjà dans la séance</span>' : `<button type="button" class="btn" data-action="pick-choose" data-id="${e(x.id)}">${p.mode === 'replace' ? 'Choisir' : 'Ajouter'}</button>`}
      </div>`;
  }).join('');
}

function renderPicker(data: AppData, ui: EditorUi): string {
  const p = ui.picker!;
  const title = p.create ? 'Nouvel exercice' : p.mode === 'replace' ? 'Changer d\'exercice' : 'Ajouter un exercice';
  let body: string;
  if (!p.create) {
    const filters = (['all', ...KINDS] as const).map((f) =>
      `<button type="button" class="chip" data-action="pick-filter" data-kind="${f}" aria-pressed="${p.filter === f}">${f === 'all' ? 'Tous' : KIND_LABEL[f]}</button>`).join('');
    body = `
      <label class="search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path></svg>
        <span class="visually-hidden">Rechercher un exercice</span>
        <input type="search" value="${e(p.query)}" placeholder="Rechercher (curl, presse…)" data-input="pick-query" autocomplete="off">
      </label>
      <div class="chips" role="group" aria-label="Filtrer par type">${filters}</div>
      <div class="pick-list" id="pick-list">${renderPickerList(data, ui)}</div>
      <button type="button" class="btn btn-dashed" data-action="pick-create">Créer un exercice<span id="pick-create-suffix">${p.query ? ` « ${e(p.query)} »` : ''}</span></button>`;
  } else {
    const noW = p.kind === 'timed' || p.kind === 'bodyweight';
    body = `
      <label class="field-label">Nom<input class="text-input" style="font-weight:600;height:48px" value="${e(p.name)}" placeholder="Ex. Hip thrust" data-change="pick-name"></label>
      <div class="section" style="gap:6px">
        <span class="field-label">Type (règle de progression)</span>
        ${kindButtons(p.kind, 'pick-kind')}
        <span class="muted xsmall">${KIND_HELP[p.kind]}</span>
      </div>
      <div class="tiles">
        ${stepper('Pas de charge', `${formatNumber(p.step)}${p.kind === 'timed' ? ' s' : ' kg'}`, 'new', 'new-step')}
        ${noW ? '' : stepper('Charge de départ', formatWeight(p.start), 'new', 'new-start')}
      </div>
      <div style="flex:1"></div>
      <button type="button" class="btn btn-primary" data-action="pick-create-save">Créer et ${p.mode === 'replace' ? 'choisir' : 'ajouter à la séance'}</button>
      <button type="button" class="btn btn-ghost" data-action="pick-create-back">Retour au catalogue</button>`;
  }
  return `
  <div class="sheet-backdrop" data-action="pick-close"></div>
  <section class="sheet" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="row between">
      <h2 class="title" style="font-size:22px">${title}</h2>
      <button type="button" class="icon-btn" data-action="pick-close" aria-label="Fermer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
    </div>
    ${body}
  </section>`;
}

export function exerciseLabel(data: AppData, id: string): string {
  return exerciseById(data, id).name;
}
