import { describe, expect, it } from 'vitest';
import { seed } from './store';
import {
  commitDraft, createExercise, exerciseUsage, removeExerciseFrom, linkWithPrevious, moveItem, newDraft, nextFreeId, relabel, removeItem, unlink, validateDraft
} from './editor';

const ids = (t: { blocks: { items: { exerciseId: string }[] }[] }) => t.blocks.map((b) => b.items.map((i) => i.exerciseId).join('+'));

describe('éditeur de séances', () => {
  it('propose la première lettre libre', () => {
    expect(nextFreeId(seed())).toBe('D');
  });

  it('réordonne un exercice seul ou dans un superset', () => {
    const data = seed();
    const d = newDraft(data, data.templates[0]);
    const t = d.template;
    moveItem(t, 1, 0, -1);
    expect(ids(t).slice(0, 2)).toEqual(['incline-db-press', 'squat']);
    moveItem(t, 3, 1, -1); // face pull avant élévations dans S1
    expect(ids(t)[3]).toBe('face-pull+lateral-raise');
  });

  it('lie et dissocie un superset, puis renumérote', () => {
    const data = seed();
    const t = newDraft(data, data.templates[0]).template;
    linkWithPrevious(t, 2); // tirage avec développé incliné
    expect(ids(t)[1]).toBe('incline-db-press+seated-row');
    relabel(t);
    expect(t.blocks.map((b) => b.label ?? '-')).toEqual(['-', 'S1', 'S2', 'S3']);
    unlink(t, 1);
    expect(ids(t).slice(1, 3)).toEqual(['incline-db-press', 'seated-row']);
  });

  it('retire un exercice et supprime le bloc vide', () => {
    const data = seed();
    const t = newDraft(data, data.templates[0]).template;
    removeItem(t, 0, 0);
    expect(t.blocks).toHaveLength(4);
  });

  it("valide puis enregistre sans toucher l'original avant l'enregistrement", () => {
    const data = seed();
    const d = newDraft(data, data.templates[0]);
    d.template.name = 'Séance A bis';
    expect(data.templates[0].name).toBe('Séance A — Squat');
    d.exercises['squat'] = { name: 'Squat barre', kind: 'heavy', step: 5, weight: 40 };
    const ex = createExercise(data, d, 'Hip thrust', 'isolation', 5, 40);
    d.template.blocks.push({ rest: 90, items: [{ exerciseId: ex.id, sets: 3, repsMin: 10, repsMax: 12 }] });
    expect(validateDraft(data, d)).toBeNull();
    commitDraft(data, d);
    expect(data.templates[0].name).toBe('Séance A bis');
    expect(data.exercises.find((e) => e.id === 'squat')!.step).toBe(5);
    expect(data.progress.squat.weight).toBe(40);
    expect(data.progress['hip-thrust'].weight).toBe(40);
  });

  it('refuse une lettre déjà prise et une séance vide', () => {
    const data = seed();
    const d = newDraft(data);
    expect(validateDraft(data, d)).toMatch(/au moins un exercice/);
    d.template.id = 'B';
    d.template.blocks.push({ rest: 90, items: [{ exerciseId: 'squat', sets: 3, repsMin: 6, repsMax: 8 }] });
    expect(validateDraft(data, d)).toMatch(/déjà utilisée/);
  });

  it('duplique avec une nouvelle lettre', () => {
    const data = seed();
    const d = newDraft(data, data.templates[1], true);
    expect(d.template.id).toBe('D');
    expect(d.originalId).toBeNull();
    commitDraft(data, d);
    expect(data.templates).toHaveLength(4);
  });

  it('renomme un exercice et archive un exercice supprimé', () => {
    const data = seed();
    data.history = [{ id: 'h', templateId: 'A', templateName: 'A', startedAt: 0, endedAt: 1, feeling: null, decisions: [],
      blocks: [{ rest: 90, exercises: [{ exerciseId: 'face-pull', repsMin: 15, repsMax: 15, sets: [] }] }] }];
    const d = newDraft(data, data.templates[0]);
    d.exercises['leg-curl'] = { name: 'Leg curl allongé', kind: 'isolation', step: 2.5, weight: 30 };
    expect(exerciseUsage(data, d, 'face-pull')).toEqual({ templates: ["Séance A — Squat (en cours d'édition)"], sessions: 1 });
    d.deleted.push('face-pull');
    removeExerciseFrom(d.template, 'face-pull');
    commitDraft(data, d);
    expect(data.exercises.find((e) => e.id === 'leg-curl')!.name).toBe('Leg curl allongé');
    const fp = data.exercises.find((e) => e.id === 'face-pull')!;
    expect(fp.archived).toBe(true);
    const a = data.templates.find((t) => t.id === 'A')!;
    expect(a.blocks.flatMap((b) => b.items.map((i) => i.exerciseId))).not.toContain('face-pull');
    expect(a.blocks.map((b) => b.label ?? '-')).toEqual(['-', '-', '-', '-', 'S1']);
  });

  it('un exercice créé puis supprimé avant enregistrement n’entre pas au catalogue', () => {
    const data = seed();
    const d = newDraft(data, data.templates[0]);
    const ex = createExercise(data, d, 'hip', 'isolation', 2.5, 20);
    expect(ex.custom).toBe(true);
    d.deleted.push(ex.id);
    commitDraft(data, d);
    expect(data.exercises.some((e) => e.id === 'hip')).toBe(false);
  });
});
