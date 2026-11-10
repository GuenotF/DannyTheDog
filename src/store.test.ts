import { describe, expect, it } from 'vitest';
import { describeMerge, mergeBackup, seed } from './store';
import type { SessionRecord } from './types';

const rec = (id: string, at: number): SessionRecord => ({
  id, templateId: 'A', templateName: 'A', startedAt: at - 1000, endedAt: at, feeling: null, decisions: [], blocks: []
});

describe('fusion de sauvegarde', () => {
  it('téléphone vierge : modèles, charges et exercices du fichier sont repris', () => {
    const fresh = seed();
    const backup = seed();
    backup.templates[0].name = 'Séance A — Jambes';
    backup.progress.squat.weight = 40;
    backup.exercises.push({ id: 'hip', name: 'Hip thrust', kind: 'heavy', step: 2.5, startWeight: 40, custom: true });
    backup.progress.hip = { weight: 40, failStreak: 0, lastChange: 0 };
    const { merged, report } = mergeBackup(fresh, backup);
    expect(merged.templates[0].name).toBe('Séance A — Jambes');
    expect(merged.progress.squat.weight).toBe(40);
    expect(merged.exercises.some((e) => e.id === 'hip')).toBe(true);
    expect(report).toMatchObject({ templatesUpdated: 1, weightsUpdated: 1, exercisesAdded: 1, winner: 'fichier' });
  });

  it('téléphone plus récent : il garde ses charges, mais récupère les séances du fichier', () => {
    const phone = seed();
    phone.history = [rec('p1', 5000)];
    phone.progress.squat.weight = 45;
    const backup = seed();
    backup.history = [rec('b1', 1000)];
    backup.progress.squat.weight = 35;
    const { merged, report } = mergeBackup(phone, backup);
    expect(merged.progress.squat.weight).toBe(45);
    expect(merged.history.map((h) => h.id)).toEqual(['b1', 'p1']);
    expect(report).toMatchObject({ sessions: 1, winner: 'téléphone' });
  });

  it('même contenu : rien de nouveau, et on le dit', () => {
    const { report } = mergeBackup(seed(), seed());
    expect(describeMerge(report)).toMatch(/^Rien de nouveau/);
  });

  it('bilan lisible', () => {
    expect(describeMerge({ sessions: 2, body: 1, templatesAdded: 0, templatesUpdated: 1, exercisesAdded: 0, weightsUpdated: 3, winner: 'fichier' }))
      .toBe('Importé : 2 séances, 1 mesure, 1 modèle mis à jour, 3 charges mises à jour.');
  });
});
