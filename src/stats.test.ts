import { describe, expect, it } from 'vitest';
import { exerciseSeries, niceTicks, sessionTonnage, weekStart } from './stats';
import { addBodyEntry, deleteSession, seed } from './store';
import type { SessionRecord } from './types';

const rec = (id: string, at: number, w: number, reps: number[]): SessionRecord => ({
  id, templateId: 'A', templateName: 'A', startedAt: at - 3600000, endedAt: at, feeling: 7, decisions: [],
  blocks: [{ rest: 90, exercises: [{ exerciseId: 'squat', repsMin: 6, repsMax: 8, sets: reps.map((r) => ({ w, reps: r, done: true })) }] }]
});

describe('stats', () => {
  it('série de charges par exercice, triée par date', () => {
    const data = seed();
    data.history = [rec('b', 2000, 32.5, [8, 8]), rec('a', 1000, 30, [8, 7])];
    expect(exerciseSeries(data, 'squat')).toEqual([
      { at: 1000, value: 30, sets: '8 / 7' },
      { at: 2000, value: 32.5, sets: '8 / 8' }
    ]);
  });
  it('tonnage', () => {
    expect(sessionTonnage(rec('a', 1, 30, [8, 8]))).toBe(480);
  });
  it('graduations rondes qui encadrent les valeurs', () => {
    const t = niceTicks(30, 37.5);
    expect(t[0]).toBeLessThan(30);
    expect(t[2]).toBeGreaterThan(37.5);
    expect(t[1] - t[0]).toBe(t[2] - t[1]);
    const b = niceTicks(60, 60.8);
    expect(b[0]).toBeLessThanOrEqual(60);
    expect(b[2]).toBeGreaterThanOrEqual(60.8);
  });
  it('début de semaine = lundi', () => {
    const wed = new Date(2026, 10, 11, 18).getTime();
    expect(new Date(weekStart(wed)).getDay()).toBe(1);
    expect(new Date(weekStart(wed)).getDate()).toBe(9);
  });
});

describe('données', () => {
  it('une seconde mesure le même jour remplace la première', () => {
    const data = seed();
    const day = new Date(2026, 10, 9, 8).getTime();
    addBodyEntry(data, 60, null, day);
    addBodyEntry(data, 60.4, 77, day + 3600000);
    expect(data.body).toHaveLength(1);
    expect(data.body[0]).toMatchObject({ weight: 60.4, waist: 77 });
  });
  it("suppression d'une séance", () => {
    const data = seed();
    data.history = [rec('a', 1, 30, [8]), rec('b', 2, 30, [8])];
    deleteSession(data, 'a');
    expect(data.history.map((h) => h.id)).toEqual(['b']);
  });
});
