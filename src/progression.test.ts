import { describe, expect, it } from 'vitest';
import { decide, roundToStep } from './progression';
import type { Exercise, ExerciseLog } from './types';

const heavy: Exercise = { id: 'squat', name: 'Squat', kind: 'heavy', step: 2.5, startWeight: 30 };
const iso: Exercise = { id: 'curl', name: 'Leg curl', kind: 'isolation', step: 2.5, startWeight: 30 };
const plank: Exercise = { id: 'plank', name: 'Gainage', kind: 'timed', step: 5, startWeight: null };

const log = (w: number | null, reps: number[], min: number, max: number, done = true): ExerciseLog => ({
  exerciseId: 'x',
  repsMin: min,
  repsMax: max,
  sets: reps.map((r) => ({ w, reps: r, done }))
});

describe('roundToStep', () => {
  it('arrondit au pas', () => {
    expect(roundToStep(29.25, 2.5)).toBe(30);
    expect(roundToStep(27, 2.5)).toBe(27.5);
    expect(roundToStep(13, 2)).toBe(14);
  });
});

describe('exercice lourd', () => {
  const fresh = { weight: 30, failStreak: 0, lastChange: 0 };
  it('monte de 2,5 kg quand toutes les séries atteignent le minimum', () => {
    const d = decide(heavy, log(30, [8, 7, 6, 6], 6, 8), fresh);
    expect(d).toMatchObject({ kind: 'up', from: 30, to: 32.5, failStreak: 0 });
  });
  it('garde la charge au premier échec', () => {
    const d = decide(heavy, log(30, [8, 7, 5, 4], 6, 8), fresh);
    expect(d).toMatchObject({ kind: 'same', to: 30, failStreak: 1 });
  });
  it('baisse de 10 % (arrondi) au deuxième échec', () => {
    const d = decide(heavy, log(32.5, [6, 5, 5, 4], 6, 8), { weight: 32.5, failStreak: 1, lastChange: 0 });
    expect(d).toMatchObject({ kind: 'down', to: 30, failStreak: 0 });
  });
  it('une série non validée compte comme un échec', () => {
    const l = log(30, [8, 8, 8, 8], 6, 8);
    l.sets[3].done = false;
    expect(decide(heavy, l, fresh).kind).toBe('same');
  });
  it('part de la charge la plus faible utilisée', () => {
    const l = log(32.5, [8, 8, 8], 6, 8);
    l.sets[2].w = 30;
    expect(decide(heavy, l, fresh)).toMatchObject({ from: 30, to: 32.5 });
  });
});

describe('isolation (double progression)', () => {
  const p = { weight: 30, failStreak: 0, lastChange: 0 };
  it('monte seulement au haut de la fourchette', () => {
    expect(decide(iso, log(30, [12, 12, 12], 10, 12), p)).toMatchObject({ kind: 'up', to: 32.5 });
  });
  it('garde la charge sans jamais baisser', () => {
    expect(decide(iso, log(30, [9, 8, 8], 10, 12), { ...p, failStreak: 5 })).toMatchObject({ kind: 'same', to: 30 });
  });
  it('charge non définie', () => {
    expect(decide(iso, log(null, [12, 12, 12], 10, 12), { weight: null, failStreak: 0, lastChange: 0 }).note).toBe('charge à définir');
  });
});

describe('gainage', () => {
  it("n'a pas de charge", () => {
    const d = decide(plank, log(null, [45, 45, 40], 30, 45), { weight: null, failStreak: 0, lastChange: 0 });
    expect(d).toMatchObject({ kind: 'same', from: null, to: null });
  });
});
