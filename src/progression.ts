import type { Decision, Exercise, ExerciseLog, ExerciseProgress } from './types';
import { formatNumber } from './format';

/** Arrondit au multiple du pas le plus proche (évite les 29,25 kg infaisables). */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) return Math.round(value * 100) / 100;
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

/** Charge de travail réelle : la plus faible charge utilisée sur les séries. */
export function workingWeight(log: ExerciseLog, fallback: number | null): number | null {
  const weights = log.sets.map((s) => s.w).filter((w): w is number => w !== null && w > 0);
  if (weights.length === 0) return fallback;
  return Math.min(...weights);
}

/**
 * Règles du programme :
 * - exercice lourd : toutes les séries faites avec au moins repsMin → +pas.
 *   Sinon échec ; au 2e échec consécutif → −10 % (arrondi au pas).
 * - isolation : double progression. Toutes les séries à repsMax → +pas, sinon on garde.
 * - gainage / poids du corps : pas de charge, on indique seulement l'objectif.
 */
export function decide(ex: Exercise, log: ExerciseLog, prev: ExerciseProgress): Decision {
  const unit = ex.kind === 'timed' ? ' s' : '';
  const allDone = log.sets.length > 0 && log.sets.every((s) => s.done);
  const allAtLeast = (n: number) => allDone && log.sets.every((s) => s.reps >= n);

  if (ex.kind === 'timed' || ex.kind === 'bodyweight') {
    const top = allAtLeast(log.repsMax);
    return {
      exerciseId: ex.id,
      from: null,
      to: null,
      kind: 'same',
      note: top ? 'objectif atteint' : `vise ${log.repsMax}${unit} partout`,
      failStreak: 0
    };
  }

  const from = workingWeight(log, prev.weight);
  if (from === null) {
    return { exerciseId: ex.id, from: null, to: null, kind: 'same', note: 'charge à définir', failStreak: 0 };
  }

  if (ex.kind === 'heavy') {
    if (allAtLeast(log.repsMin)) {
      return { exerciseId: ex.id, from, to: roundToStep(from + ex.step, ex.step), kind: 'up', note: `+${formatNumber(ex.step)} kg`, failStreak: 0 };
    }
    const streak = prev.failStreak + 1;
    if (streak >= 2) {
      return { exerciseId: ex.id, from, to: roundToStep(from * 0.9, ex.step), kind: 'down', note: '2e échec · −10 %', failStreak: 0 };
    }
    return { exerciseId: ex.id, from, to: from, kind: 'same', note: '1er échec · on garde', failStreak: streak };
  }

  if (allAtLeast(log.repsMax)) {
    return { exerciseId: ex.id, from, to: roundToStep(from + ex.step, ex.step), kind: 'up', note: `+${formatNumber(ex.step)} kg`, failStreak: 0 };
  }
  return { exerciseId: ex.id, from, to: from, kind: 'same', note: `vise ${log.repsMax} partout`, failStreak: 0 };
}

/** Recalcule le type (hausse, maintien, baisse) après une modification manuelle. */
export function kindFor(from: number | null, to: number | null): Decision['kind'] {
  if (from === null || to === null || from === to) return 'same';
  return to > from ? 'up' : 'down';
}
