import type { AppData, ExerciseLog, SessionRecord } from './types';
import { workingWeight } from './progression';

export interface SeriesPoint {
  at: number;
  value: number;
  /** Reps réalisées, ex. « 8 / 8 / 7 / 6 » (✗ pour une série non faite). */
  sets: string;
}

export function setsText(log: ExerciseLog, unit = ''): string {
  return log.sets.map((s) => (s.done ? `${s.reps}` : '✗')).join(' / ') + unit;
}

/** Charge de travail d'un exercice, séance par séance (séances sans charge ignorées). */
export function exerciseSeries(data: AppData, exerciseId: string): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const rec of data.history) {
    for (const b of rec.blocks) {
      for (const log of b.exercises) {
        if (log.exerciseId !== exerciseId) continue;
        const w = workingWeight(log, null);
        if (w !== null) points.push({ at: rec.endedAt, value: w, sets: setsText(log) });
      }
    }
  }
  return points.sort((a, b) => a.at - b.at);
}

export function sessionTonnage(rec: Pick<SessionRecord, 'blocks'>): number {
  let t = 0;
  for (const b of rec.blocks) for (const ex of b.exercises) for (const s of ex.sets) if (s.done && s.w) t += s.w * s.reps;
  return t;
}

export function sessionSetCounts(rec: Pick<SessionRecord, 'blocks'>): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const b of rec.blocks) for (const ex of b.exercises) for (const s of ex.sets) {
    total++;
    if (s.done) done++;
  }
  return { done, total };
}

/** Lundi 0 h de la semaine contenant `ts`. */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday.getTime();
}

/** Trois graduations « rondes » (pas de 0,5 / 1 / 2 / 2,5 / 5 / 10…) qui encadrent les valeurs avec une marge. */
export function niceTicks(min: number, max: number, minSpan = 1): number[] {
  const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  const span = Math.max(max - min, minSpan);
  const lo0 = min - span * 0.2;
  const hi0 = max + span * 0.2;
  for (const step of steps) {
    const lo = Math.floor(lo0 / step) * step;
    if (lo + 2 * step >= hi0) return [lo, lo + step, lo + 2 * step].map((v) => Math.max(0, Math.round(v * 100) / 100));
  }
  return [Math.floor(lo0), (lo0 + hi0) / 2, Math.ceil(hi0)];
}
