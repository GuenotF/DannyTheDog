import exercisesJson from './data/exercises.json';
import templatesJson from './data/templates.json';
import type { ActiveSession, AppData, BodyEntry, Exercise, ExerciseLog, ExerciseProgress, SessionRecord, Template } from './types';
import { decide } from './progression';

const KEY = 'dannythedog:data';

export function seed(): AppData {
  // Copies profondes : les JSON importés sont partagés et ne doivent jamais être modifiés.
  const exercises = structuredClone(exercisesJson) as Exercise[];
  const progress: Record<string, ExerciseProgress> = {};
  for (const ex of exercises) progress[ex.id] = { weight: ex.startWeight, failStreak: 0, lastChange: 0 };
  return {
    version: 1,
    exercises,
    templates: structuredClone(templatesJson) as Template[],
    progress,
    history: [],
    body: [],
    active: null,
    lastExport: null,
    settings: { footDay: 1 }
  };
}

export function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isAppData(parsed)) return withNewCatalogEntries(parsed);
    }
  } catch {
    /* données illisibles : on repart des données par défaut */
  }
  return seed();
}

export function save(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Sauvegarde impossible', err);
  }
}

/** Ajoute les exercices du catalogue apparus dans une nouvelle version de l'appli. */
function withNewCatalogEntries(data: AppData): AppData {
  if (!Array.isArray(data.body)) data.body = [];
  for (const ex of exercisesJson as Exercise[]) {
    if (!data.exercises.some((e) => e.id === ex.id)) data.exercises.push({ ...ex });
    if (!data.progress[ex.id]) data.progress[ex.id] = { weight: ex.startWeight, failStreak: 0, lastChange: 0 };
  }
  return data;
}

export function isAppData(v: unknown): v is AppData {
  const d = v as AppData;
  return !!d && d.version === 1 && Array.isArray(d.exercises) && Array.isArray(d.templates) && Array.isArray(d.history) && typeof d.progress === 'object';
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignoré */
  }
  return false;
}

export function exerciseById(data: AppData, id: string): Exercise {
  return data.exercises.find((e) => e.id === id) ?? { id, name: id, kind: 'isolation', step: 2.5, startWeight: null };
}

export function templateById(data: AppData, id: string): Template | undefined {
  return data.templates.find((t) => t.id === id);
}

export function progressOf(data: AppData, id: string): ExerciseProgress {
  return data.progress[id] ?? { weight: null, failStreak: 0, lastChange: 0 };
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function startSession(data: AppData, templateId: string, now = Date.now()): ActiveSession {
  const t = templateById(data, templateId);
  if (!t) throw new Error(`Séance inconnue : ${templateId}`);
  return {
    id: uid(),
    templateId,
    startedAt: now,
    restEnd: 0,
    restTotal: 0,
    restFrom: '',
    editing: null,
    applyNext: true,
    blocks: t.blocks.map((b) => ({
      label: b.label,
      rest: b.rest,
      exercises: b.items.map((it) => {
        const ex = exerciseById(data, it.exerciseId);
        const w = ex.kind === 'timed' || ex.kind === 'bodyweight' ? null : progressOf(data, it.exerciseId).weight;
        return {
          exerciseId: it.exerciseId,
          repsMin: it.repsMin,
          repsMax: it.repsMax,
          sets: Array.from({ length: it.sets }, () => ({ w, reps: it.repsMax, done: false }))
        };
      })
    }))
  };
}

/** Dernière performance enregistrée pour un exercice. */
export function lastLog(data: AppData, exerciseId: string): { log: ExerciseLog; at: number } | null {
  for (let i = data.history.length - 1; i >= 0; i--) {
    const rec = data.history[i];
    for (const b of rec.blocks) {
      const log = b.exercises.find((e) => e.exerciseId === exerciseId);
      if (log) return { log, at: rec.endedAt };
    }
  }
  return null;
}

export function computeDecisions(data: AppData, session: ActiveSession) {
  return session.blocks.flatMap((b) =>
    b.exercises.map((log) => decide(exerciseById(data, log.exerciseId), log, progressOf(data, log.exerciseId)))
  );
}

/** Enregistre la séance terminée et applique les nouvelles charges. */
export function commitSession(data: AppData): SessionRecord | null {
  const s = data.active;
  if (!s || !s.decisions) return null;
  const t = templateById(data, s.templateId);
  const record: SessionRecord = {
    id: s.id,
    templateId: s.templateId,
    templateName: t?.name ?? s.templateId,
    startedAt: s.startedAt,
    endedAt: s.finishedAt ?? Date.now(),
    feeling: s.feeling ?? null,
    blocks: s.blocks,
    decisions: s.decisions
  };
  for (const d of s.decisions) {
    const prev = progressOf(data, d.exerciseId);
    data.progress[d.exerciseId] = {
      weight: d.to ?? prev.weight,
      failStreak: d.failStreak,
      lastChange: d.to !== null && d.from !== null ? Math.round((d.to - d.from) * 100) / 100 : 0
    };
  }
  data.history.push(record);
  data.active = null;
  return record;
}

/* ---------- Export / import ---------- */

export function exportAll(data: AppData): string {
  return JSON.stringify({ ...data, active: null, exportedAt: new Date().toISOString() }, null, 2);
}

export function exportTemplate(data: AppData, templateId: string): string {
  const t = templateById(data, templateId);
  if (!t) throw new Error('Séance introuvable');
  const ids = new Set(t.blocks.flatMap((b) => b.items.map((i) => i.exerciseId)));
  return JSON.stringify(
    { type: 'dannythedog-template', version: 1, template: t, exercises: data.exercises.filter((e) => ids.has(e.id)) },
    null,
    2
  );
}

export type ImportResult = { kind: 'backup'; backup: AppData } | { kind: 'template'; template: Template; exercises: Exercise[] };

export function parseImport(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  const p = parsed as { type?: string; template?: Template; exercises?: Exercise[] };
  if (p && p.type === 'dannythedog-template' && p.template && Array.isArray(p.template.blocks)) {
    return { kind: 'template', template: p.template, exercises: Array.isArray(p.exercises) ? p.exercises : [] };
  }
  if (isAppData(parsed)) return { kind: 'backup', backup: parsed };
  throw new Error("Ce fichier n'est pas une sauvegarde Danny the DOG.");
}

export interface MergeReport {
  sessions: number;
  body: number;
  templatesAdded: number;
  templatesUpdated: number;
  exercisesAdded: number;
  weightsUpdated: number;
  /** Côté retenu pour les modèles, exercices et charges présents des deux côtés. */
  winner: 'fichier' | 'téléphone';
}

/** Date de la dernière activité enregistrée (séance ou mesure). */
export function lastActivity(d: AppData): number {
  return Math.max(0, ...d.history.map((h) => h.endedAt), ...(d.body ?? []).map((b) => b.at));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Fusionne une sauvegarde : séances et mesures des deux côtés ; pour les modèles,
 * exercices et charges présents des deux côtés, la version la plus récente l'emporte
 * (celle du fichier si le téléphone n'a pas d'activité plus récente).
 */
export function mergeBackup(data: AppData, backup: AppData): { merged: AppData; report: MergeReport } {
  const fileWins = lastActivity(backup) >= lastActivity(data);
  const report: MergeReport = { sessions: 0, body: 0, templatesAdded: 0, templatesUpdated: 0, exercisesAdded: 0, weightsUpdated: 0, winner: fileWins ? 'fichier' : 'téléphone' };

  const unionById = <T extends { id: string }>(local: T[], incoming: T[], onAdd: () => void, onUpdate?: () => void): T[] => {
    const out = local.map((l) => {
      const other = incoming.find((x) => x.id === l.id);
      if (other && fileWins && !same(other, l)) {
        onUpdate?.();
        return structuredClone(other);
      }
      return l;
    });
    for (const x of incoming) if (!local.some((l) => l.id === x.id)) {
      out.push(structuredClone(x));
      onAdd();
    }
    return out;
  };

  const merged: AppData = { ...data };
  merged.exercises = unionById(data.exercises, backup.exercises, () => report.exercisesAdded++);
  merged.templates = unionById(data.templates, backup.templates, () => report.templatesAdded++, () => report.templatesUpdated++);

  merged.progress = { ...data.progress };
  for (const [id, p] of Object.entries(backup.progress)) {
    const local = data.progress[id];
    if (!local || (fileWins && !same(local, p))) {
      if (local && local.weight !== p.weight) report.weightsUpdated++;
      merged.progress[id] = { ...p };
    }
  }

  const known = new Set(data.history.map((h) => h.id));
  const newSessions = backup.history.filter((h) => !known.has(h.id));
  report.sessions = newSessions.length;
  merged.history = [...data.history, ...newSessions].sort((a, b) => a.endedAt - b.endedAt);

  const bodyIds = new Set((data.body ?? []).map((b) => b.id));
  const newBody = (backup.body ?? []).filter((b) => !bodyIds.has(b.id));
  report.body = newBody.length;
  merged.body = [...(data.body ?? []), ...newBody].sort((a, b) => a.at - b.at);

  if (data.lastExport === null) merged.lastExport = backup.lastExport ?? null;
  return { merged, report };
}

/** Phrase de bilan affichée après une fusion. */
export function describeMerge(r: MergeReport): string {
  const parts: string[] = [];
  const n = (k: number, one: string, many: string) => `${k} ${k > 1 ? many : one}`;
  if (r.sessions) parts.push(n(r.sessions, 'séance', 'séances'));
  if (r.body) parts.push(n(r.body, 'mesure', 'mesures'));
  if (r.templatesAdded) parts.push(n(r.templatesAdded, 'modèle ajouté', 'modèles ajoutés'));
  if (r.templatesUpdated) parts.push(n(r.templatesUpdated, 'modèle mis à jour', 'modèles mis à jour'));
  if (r.exercisesAdded) parts.push(n(r.exercisesAdded, 'exercice ajouté', 'exercices ajoutés'));
  if (r.weightsUpdated) parts.push(n(r.weightsUpdated, 'charge mise à jour', 'charges mises à jour'));
  if (parts.length === 0) return 'Rien de nouveau : ce fichier contient les mêmes données que ce téléphone.';
  return `Importé : ${parts.join(', ')}.`;
}

export function addTemplate(data: AppData, template: Template, exercises: Exercise[]): Template {
  for (const ex of exercises) {
    if (!data.exercises.some((e) => e.id === ex.id)) {
      data.exercises.push(ex);
      data.progress[ex.id] = { weight: ex.startWeight, failStreak: 0, lastChange: 0 };
    }
  }
  let id = template.id;
  let n = 2;
  while (data.templates.some((t) => t.id === id)) id = `${template.id}${n++}`;
  const copy = { ...template, id, name: id === template.id ? template.name : `${template.name} (${n - 1})` };
  data.templates.push(copy);
  return copy;
}

/* ---------- Historique ---------- */

export function deleteSession(data: AppData, id: string): void {
  data.history = data.history.filter((h) => h.id !== id);
}

/* ---------- Mesures corporelles ---------- */

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** Ajoute une mesure ; une seconde mesure le même jour remplace la première. */
export function addBodyEntry(data: AppData, weight: number | null, waist: number | null, at = Date.now()): BodyEntry {
  const existing = data.body.find((b) => sameDay(b.at, at));
  if (existing) {
    existing.weight = weight;
    existing.waist = waist;
    existing.at = at;
    return existing;
  }
  const entry: BodyEntry = { id: uid(), at, weight, waist };
  data.body.push(entry);
  data.body.sort((a, b) => a.at - b.at);
  return entry;
}

export function deleteBodyEntry(data: AppData, id: string): void {
  data.body = data.body.filter((b) => b.id !== id);
}
