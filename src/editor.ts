import type { AppData, Exercise, ExerciseKind, Template, TemplateBlock, TemplateItem } from './types';
import { exerciseById, progressOf } from './store';

/** Réglages d'exercice modifiés dans l'éditeur (appliqués au catalogue à l'enregistrement). */
export interface ExerciseDraft {
  name: string;
  kind: ExerciseKind;
  step: number;
  weight: number | null;
}

export interface EditorDraft {
  /** Identifiant d'origine (null pour une nouvelle séance). */
  originalId: string | null;
  template: Template;
  exercises: Record<string, ExerciseDraft>;
  /** Exercices créés pendant l'édition, ajoutés au catalogue à l'enregistrement. */
  created: Exercise[];
  /** Exercices supprimés du catalogue pendant l'édition (archivés à l'enregistrement). */
  deleted: string[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function nextFreeId(data: AppData, exclude: string | null = null): string {
  const used = new Set(data.templates.map((t) => t.id).filter((id) => id !== exclude));
  for (let c = 65; c <= 90; c++) {
    const id = String.fromCharCode(c);
    if (!used.has(id)) return id;
  }
  let n = 1;
  while (used.has(`S${n}`)) n++;
  return `S${n}`;
}

export function newDraft(data: AppData, from?: Template, duplicate = false): EditorDraft {
  if (from && !duplicate) return { originalId: from.id, template: clone(from), exercises: {}, created: [], deleted: [] };
  if (from && duplicate) {
    const id = nextFreeId(data);
    return { originalId: null, template: { ...clone(from), id, name: `${from.name} (copie)` }, exercises: {}, created: [], deleted: [] };
  }
  const id = nextFreeId(data);
  return { originalId: null, template: { id, name: `Séance ${id}`, day: 0, optional: false, blocks: [] }, exercises: {}, created: [], deleted: [] };
}

/** Exercice vu par l'éditeur : catalogue + exercices créés + réglages en cours. */
export function draftExercise(data: AppData, d: EditorDraft, id: string): Exercise & { weight: number | null } {
  const base = d.created.find((e) => e.id === id) ?? exerciseById(data, id);
  const over = d.exercises[id];
  const createdStart = d.created.find((e) => e.id === id)?.startWeight ?? null;
  const weight = over ? over.weight : d.created.some((e) => e.id === id) ? createdStart : progressOf(data, id).weight;
  return { ...base, name: over?.name ?? base.name, kind: over?.kind ?? base.kind, step: over?.step ?? base.step, weight };
}

export function defaultItem(ex: Exercise): TemplateItem {
  if (ex.kind === 'heavy') return { exerciseId: ex.id, sets: 4, repsMin: 6, repsMax: 8 };
  if (ex.kind === 'timed') return { exerciseId: ex.id, sets: 3, repsMin: 30, repsMax: 45 };
  if (ex.kind === 'bodyweight') return { exerciseId: ex.id, sets: 3, repsMin: 10, repsMax: 12 };
  return { exerciseId: ex.id, sets: 3, repsMin: 10, repsMax: 12 };
}

export function addItem(t: Template, item: TemplateItem, rest: number): void {
  t.blocks.push({ rest, items: [item] });
}

export function replaceItem(t: Template, bi: number, xi: number, item: TemplateItem): void {
  t.blocks[bi].items[xi] = item;
}

export function removeItem(t: Template, bi: number, xi: number): void {
  t.blocks[bi].items.splice(xi, 1);
  if (t.blocks[bi].items.length === 0) t.blocks.splice(bi, 1);
}

/** Monte un exercice : dans son superset, ou déplace tout le bloc. */
export function moveItem(t: Template, bi: number, xi: number, dir: -1 | 1): void {
  const block = t.blocks[bi];
  const target = xi + dir;
  if (block.items.length > 1 && target >= 0 && target < block.items.length) {
    [block.items[xi], block.items[target]] = [block.items[target], block.items[xi]];
    return;
  }
  const tb = bi + dir;
  if (tb < 0 || tb >= t.blocks.length) return;
  [t.blocks[bi], t.blocks[tb]] = [t.blocks[tb], t.blocks[bi]];
}

/** Lie le bloc `bi` (un seul exercice) au bloc précédent pour former un superset. */
export function linkWithPrevious(t: Template, bi: number): void {
  if (bi <= 0) return;
  const prev = t.blocks[bi - 1];
  const cur = t.blocks[bi];
  prev.items.push(...cur.items);
  prev.rest = cur.rest;
  t.blocks.splice(bi, 1);
}

export function unlink(t: Template, bi: number): void {
  const b = t.blocks[bi];
  const parts: TemplateBlock[] = b.items.map((it) => ({ rest: b.rest, items: [it] }));
  t.blocks.splice(bi, 1, ...parts);
}

/** Libellés S1, S2… dans l'ordre pour les supersets ; rien pour les exercices seuls. */
export function relabel(t: Template): void {
  let n = 0;
  for (const b of t.blocks) {
    if (b.items.length > 1) b.label = `S${++n}`;
    else delete b.label;
  }
}

export function validateDraft(data: AppData, d: EditorDraft): string | null {
  const t = d.template;
  if (!t.name.trim()) return 'Donne un nom à la séance.';
  if (!t.id.trim()) return 'Donne une lettre à la séance.';
  if (data.templates.some((x) => x.id === t.id && x.id !== d.originalId)) return `La lettre « ${t.id} » est déjà utilisée.`;
  if (t.blocks.length === 0) return 'Ajoute au moins un exercice.';
  return null;
}

/** Applique le brouillon : séance, nouveaux exercices et réglages d'exercice. */
export function commitDraft(data: AppData, d: EditorDraft): Template {
  const t = clone(d.template);
  t.id = t.id.trim();
  t.name = t.name.trim();
  relabel(t);
  for (const ex of d.created) {
    if (d.deleted.includes(ex.id)) continue;
    if (!data.exercises.some((e) => e.id === ex.id)) {
      data.exercises.push({ ...ex });
      data.progress[ex.id] = { weight: ex.startWeight, failStreak: 0, lastChange: 0 };
    }
  }
  for (const [id, over] of Object.entries(d.exercises)) {
    const ex = data.exercises.find((e) => e.id === id);
    if (!ex) continue;
    if (over.name.trim()) ex.name = over.name.trim();
    ex.kind = over.kind;
    ex.step = over.step;
    const p = progressOf(data, id);
    data.progress[id] = { ...p, weight: over.weight, failStreak: over.weight !== p.weight ? 0 : p.failStreak };
  }
  const i = d.originalId ? data.templates.findIndex((x) => x.id === d.originalId) : -1;
  if (i >= 0) data.templates[i] = t;
  else data.templates.push(t);
  for (const id of d.deleted) archiveExercise(data, id);
  return t;
}

/** Supprime un exercice du catalogue : archivé (l'historique garde son nom) et retiré de toutes les séances. */
export function archiveExercise(data: AppData, id: string): void {
  const ex = data.exercises.find((e) => e.id === id);
  if (ex) ex.archived = true;
  for (const t of data.templates) {
    removeExerciseFrom(t, id);
    relabel(t);
  }
}

export function removeExerciseFrom(t: Template, id: string): void {
  for (const b of t.blocks) b.items = b.items.filter((it) => it.exerciseId !== id);
  t.blocks = t.blocks.filter((b) => b.items.length > 0);
}

/** Où un exercice est utilisé (séances autres que celle en cours d'édition, et historique). */
export function exerciseUsage(data: AppData, d: EditorDraft, id: string): { templates: string[]; sessions: number } {
  const templates = data.templates
    .filter((t) => t.id !== d.originalId && t.blocks.some((b) => b.items.some((i) => i.exerciseId === id)))
    .map((t) => t.name);
  if (d.template.blocks.some((b) => b.items.some((i) => i.exerciseId === id))) templates.unshift(`${d.template.name} (en cours d'édition)`);
  const sessions = data.history.filter((h) => h.blocks.some((b) => b.exercises.some((e) => e.exerciseId === id))).length;
  return { templates, sessions };
}

export function deleteTemplate(data: AppData, id: string): void {
  data.templates = data.templates.filter((t) => t.id !== id);
}

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function createExercise(data: AppData, d: EditorDraft, name: string, kind: ExerciseKind, step: number, start: number | null): Exercise {
  const base = slugify(name) || 'exercice';
  let id = base;
  let n = 2;
  while (data.exercises.some((e) => e.id === id) || d.created.some((e) => e.id === id)) id = `${base}-${n++}`;
  const ex: Exercise = { id, name: name.trim(), kind, step, startWeight: kind === 'timed' || kind === 'bodyweight' ? null : start, custom: true };
  d.created.push(ex);
  return ex;
}
