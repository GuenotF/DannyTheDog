import { test, expect, readData, startSession, toast } from './fixtures';

test.describe('Éditeur de séances', () => {
  test.beforeEach(async ({ app }) => {
    await app.getByRole('link', { name: 'Gérer mes séances' }).click();
    await expect(app.getByRole('heading', { name: 'Mes séances' })).toBeVisible();
  });

  test('liste les trois séances du programme', async ({ app }) => {
    await expect(app.locator('article.card')).toHaveCount(3);
    await expect(app.locator('article.card').first()).toContainText('Mercredi · 7 exercices · 2 supersets');
  });

  test('modifier : infos, réglages, réordonner, superset, enregistrer', async ({ app }) => {
    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('input[data-change=ed-name]').fill('Séance A — Jambes');
    await app.locator('input[data-change=ed-name]').blur();
    await app.locator('button[data-action=ed-day][data-day="4"]').click();
    await app.locator('button[data-action=ed-field][data-key="0-0"][data-field=sets][data-dir="1"]').click();
    await app.locator('button[data-action=ed-field][data-key="1-0"][data-field=min][data-dir="1"]').click();
    await app.locator('button[data-action=ed-settings][data-key="0-0"]').click();
    await app.locator('button[data-action=ed-field][data-key="0-0"][data-field=step][data-dir="1"]').click();
    await app.locator('input[data-change=ed-weight]').fill('35');
    await app.locator('input[data-change=ed-weight]').blur();
    await app.locator('button[data-action=ed-up][data-key="2-0"]').click(); // tirage avant développé incliné
    await app.locator('button[data-action=ed-link][data-bi="2"]').click(); // développé incliné avec le tirage
    await app.locator('button[data-action=ed-save]').click();
    await expect(toast(app)).toHaveText('Séance enregistrée');

    const data = await readData(app);
    const a = data.templates.find((t: { id: string }) => t.id === 'A');
    expect(a.name).toBe('Séance A — Jambes');
    expect(a.day).toBe(4);
    expect(a.blocks[0].items[0].sets).toBe(5);
    expect(a.blocks[1]).toMatchObject({ label: 'S1' });
    expect(a.blocks[1].items.map((i: { exerciseId: string }) => i.exerciseId)).toEqual(['seated-row', 'incline-db-press']);
    expect(a.blocks[1].items[1].repsMin).toBe(9);
    expect(data.exercises.find((e: { id: string }) => e.id === 'squat').step).toBe(3);
    expect(data.progress.squat.weight).toBe(35);
  });

  test('la croix annule toutes les modifications', async ({ app }) => {
    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('button[data-action=ed-remove][data-key="0-0"]').click();
    await app.locator('button[data-action=ed-cancel]').click();
    const a = (await readData(app)).templates.find((t: { id: string }) => t.id === 'A');
    expect(a.blocks[0].items[0].exerciseId).toBe('squat');
  });

  test('dissocier un superset', async ({ app }) => {
    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('button[data-action=ed-unlink][data-bi="3"]').click();
    await expect(app.locator('section.superset')).toHaveCount(1);
    await app.locator('button[data-action=ed-save]').click();
    const a = (await readData(app)).templates.find((t: { id: string }) => t.id === 'A');
    expect(a.blocks).toHaveLength(6);
    expect(a.blocks[5].label).toBe('S1');
  });

  test('catalogue : recherche, filtre, créer un exercice et l’utiliser en séance', async ({ app }) => {
    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('button[data-action=ed-add]').click();
    await app.locator('input[data-input=pick-query]').fill('curl');
    await expect(app.locator('.pick-row')).toHaveCount(3);
    await expect(app.locator('.pick-row', { hasText: 'Leg curl' })).toContainText('dans la séance');
    await app.locator('button[data-action=pick-filter][data-kind=heavy]').click();
    await expect(app.getByText('Aucun exercice trouvé.')).toBeVisible();

    await app.locator('button[data-action=pick-filter][data-kind=all]').click();
    await app.locator('input[data-input=pick-query]').fill('Hip thrust');
    await app.locator('button[data-action=pick-create]').click();
    await expect(app.locator('input[data-change=pick-name]')).toHaveValue('Hip thrust');
    await app.locator('button[data-action=pick-kind][data-kind=heavy]').click();
    await app.locator('button[data-action=ed-field][data-field=new-start][data-dir="1"]').click();
    await app.locator('button[data-action=pick-create-save]').click();
    await expect(app.locator('.ed-card').last()).toContainText('Hip thrust');
    await app.locator('button[data-action=ed-save]').click();

    const data = await readData(app);
    expect(data.exercises.find((e: { id: string }) => e.id === 'hip-thrust')).toMatchObject({ kind: 'heavy', startWeight: 22.5 });
    expect(data.progress['hip-thrust'].weight).toBe(22.5);

    await app.getByRole('link', { name: "Retour à l'accueil" }).click();
    await startSession(app, 'A');
    await expect(app.locator('.exercise', { hasText: 'Hip thrust' })).toContainText('22,5 kg');
    await expect(app.locator('.exercise', { hasText: 'Hip thrust' })).toContainText('4 × 6–8');
  });

  test('changer un exercice garde le nombre de séries', async ({ app }) => {
    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('button[data-action=ed-replace][data-key="1-0"]').click();
    await app.locator('input[data-input=pick-query]').fill('presse à');
    await app.locator('.pick-row', { hasText: 'Presse à cuisses' }).locator('button[data-action=pick-choose]').click();
    await app.locator('button[data-action=ed-save]').click();
    const a = (await readData(app)).templates.find((t: { id: string }) => t.id === 'A');
    expect(a.blocks[1].items[0]).toMatchObject({ exerciseId: 'leg-press', sets: 3 });
  });

  test('validation : séance vide et lettre déjà prise', async ({ app }) => {
    await app.locator('button[data-action=tpl-new]').click();
    await expect(app.locator('input[data-change=ed-id]')).toHaveValue('D');
    await app.locator('button[data-action=ed-save]').click();
    await expect(toast(app)).toHaveText('Ajoute au moins un exercice.');
    await app.locator('button[data-action=ed-add]').click();
    await app.locator('.pick-row', { hasText: 'Squat barre' }).locator('button[data-action=pick-choose]').click();
    await app.locator('input[data-change=ed-id]').fill('b');
    await app.locator('input[data-change=ed-id]').blur();
    await app.locator('button[data-action=ed-save]').click();
    await expect(toast(app)).toHaveText('La lettre « B » est déjà utilisée.');
    await app.locator('input[data-change=ed-id]').fill('D');
    await app.locator('input[data-change=ed-id]').blur();
    await app.locator('button[data-action=ed-save]').click();
    await expect(app.locator('article.card')).toHaveCount(4);
  });

  test('dupliquer puis supprimer une séance', async ({ app }) => {
    await app.locator('button[data-action=tpl-duplicate][data-id=B]').click();
    await expect(app.locator('input[data-change=ed-name]')).toHaveValue('Séance B — Développé couché + SDT (copie)');
    await app.locator('button[data-action=ed-save]').click();
    await expect(app.locator('article.card')).toHaveCount(4);
    await app.locator('button[data-action=tpl-delete-ask][data-id=D]').click();
    await app.locator('button[data-action=tpl-delete]').click();
    await expect(app.locator('article.card')).toHaveCount(3);
  });

  test('une séance en cours n’est pas modifiée par l’éditeur', async ({ app }) => {
    await app.getByRole('link', { name: "Retour à l'accueil" }).click();
    await startSession(app, 'A');
    await app.goto('./#/seances');
    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('button[data-action=ed-remove][data-key="0-0"]').click();
    await app.locator('button[data-action=ed-save]').click();
    await app.goto('./#/seance');
    await expect(app.locator('.exercise').first()).toContainText('Squat barre');
  });

  test('fiche exercice depuis la carte : renommer un exercice créé par erreur', async ({ app }) => {
    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('button[data-action=ed-add]').click();
    await app.locator('input[data-input=pick-query]').fill('hip');
    await app.locator('button[data-action=pick-create]').click();
    await app.locator('button[data-action=pick-create-save]').click();
    const card = app.locator('.ed-card').last();
    await expect(card).toContainText('perso');
    await card.locator('button[data-action=ed-settings]').click();
    await app.locator('button[data-action=ed-fiche]').click();
    const fiche = app.getByRole('dialog', { name: "Modifier l'exercice" });
    await expect(fiche.locator('input[data-change=fiche-name]')).toHaveValue('hip');
    await fiche.locator('input[data-change=fiche-name]').fill('Hip thrust');
    await fiche.locator('input[data-change=fiche-name]').blur();
    await fiche.locator('button[data-action=fiche-kind][data-kind=heavy]').click();
    await fiche.locator('button[data-action=fiche-save]').click();
    await expect(app.locator('.ed-card').last()).toContainText('Hip thrust');
    await expect(app.locator('.ed-card').last()).toContainText('Lourd');
    await app.locator('button[data-action=ed-save]').click();
    const ex = (await readData(app)).exercises.find((e: { id: string }) => e.id === 'hip');
    expect(ex).toMatchObject({ name: 'Hip thrust', kind: 'heavy', custom: true });
  });

  test('fiche exercice depuis le catalogue : supprimer (archivé, historique conservé)', async ({ app }) => {
    // Une séance A faite avant, pour vérifier que l'historique garde le nom
    await app.getByRole('link', { name: "Retour à l'accueil" }).click();
    await startSession(app, 'A');
    await app.locator('header button[data-action=finish]').click();
    await app.locator('button[data-action=commit]').click();
    await app.goto('./#/seances');

    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('button[data-action=ed-add]').click();
    await app.locator('input[data-input=pick-query]').fill('face');
    await app.locator('button[data-action=pick-edit][data-id=face-pull]').click();
    const fiche = app.getByRole('dialog', { name: "Modifier l'exercice" });
    await expect(fiche).toContainText("Séance A — Squat (en cours d'édition)");
    await expect(fiche).toContainText("1 séance dans l'historique");
    await fiche.locator('button[data-action=fiche-delete-ask]').click();
    await fiche.locator('button[data-action=fiche-delete-cancel]').click();
    await fiche.locator('button[data-action=fiche-delete-ask]').click();
    await fiche.locator('button[data-action=fiche-delete]').click();
    await expect(toast(app)).toContainText('Enregistre la séance pour valider');
    await expect(app.locator('.pick-row')).toHaveCount(0); // retiré du catalogue
    await app.locator('button[data-action=pick-close]').first().click();
    await expect(app.locator('.ed-card', { hasText: 'Face pull' })).toHaveCount(0);
    await app.locator('button[data-action=ed-save]').click();

    const data = await readData(app);
    expect(data.exercises.find((e: { id: string }) => e.id === 'face-pull').archived).toBe(true);
    const a = data.templates.find((t: { id: string }) => t.id === 'A');
    expect(a.blocks.flatMap((b: { items: { exerciseId: string }[] }) => b.items.map((i) => i.exerciseId))).not.toContain('face-pull');

    await app.getByRole('link', { name: "Retour à l'accueil" }).click();
    await app.getByRole('link', { name: 'Historique' }).click();
    await app.locator('button[data-action=hist-toggle]').first().click();
    await expect(app.locator('.hist-detail')).toContainText('Face pull');
  });

  test('annuler l’édition annule aussi une suppression d’exercice', async ({ app }) => {
    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('button[data-action=ed-settings][data-key="0-0"]').click();
    await app.locator('button[data-action=ed-fiche]').click();
    await app.locator('button[data-action=fiche-delete-ask]').click();
    await app.locator('button[data-action=fiche-delete]').click();
    await app.locator('button[data-action=ed-cancel]').click();
    const data = await readData(app);
    expect(data.exercises.find((e: { id: string }) => e.id === 'squat').archived).toBeUndefined();
    expect(data.templates[0].blocks[0].items[0].exerciseId).toBe('squat');
  });
});
