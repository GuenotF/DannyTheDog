import { test, expect, readData, startSession, completeAllSets, finishAndSave } from './fixtures';

test.describe('Accueil', () => {
  test('propose la séance A avec les charges de départ', async ({ app }) => {
    const next = app.locator('section[aria-label="Prochaine séance"]');
    await expect(next.getByRole('heading', { name: 'Séance A — Squat' })).toBeVisible();
    await expect(next).toContainText('Squat barre');
    await expect(next).toContainText('30 kg');
    await expect(app.locator('.day')).toHaveCount(7);
    await expect(app.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  });
});

test.describe('Séance en cours', () => {
  test('pré-remplit charges et reps, et masque la barre d’onglets', async ({ app }) => {
    await startSession(app);
    await expect(app.locator('button[data-key="0-0-0"][data-action=edit-weight]')).toHaveText('30 kg');
    await expect(app.locator('.set').first()).toContainText('8');
    await expect(app.locator('.tabbar')).toHaveCount(0);
    await expect(app.locator('#elapsed')).not.toHaveText('');
  });

  test('valider une série lance le minuteur de repos, « Passer » l’arrête', async ({ app }) => {
    await startSession(app);
    await expect(app.locator('#timer-clock')).toHaveText('GO');
    await app.locator('button[data-key="0-0-0"][data-action=toggle-set]').click();
    await expect(app.locator('#timer-clock')).toHaveText(/^2:(30|29|28)$/);
    await expect(app.locator('#timer-title')).toContainText('Squat barre');
    await app.locator('button[data-action=rest-add][data-sec="15"]').click();
    await expect(app.locator('#timer-clock')).toHaveText(/^2:(4[0-5])$/);
    await app.locator('button[data-action=rest-skip]').click();
    await expect(app.locator('#timer-clock')).toHaveText('GO');
  });

  test('pas de repos entre les deux exercices d’un superset', async ({ app }) => {
    await startSession(app);
    // Bloc 3 = superset S1 : élévations latérales puis face pull
    await app.locator('button[data-key="3-0-0"][data-action=toggle-set]').click();
    await expect(app.locator('#timer-clock')).toHaveText('GO');
    await app.locator('button[data-key="3-1-0"][data-action=toggle-set]').click();
    await expect(app.locator('#timer-clock')).toHaveText(/^1:(30|29|28)$/);
  });

  test('modifier la charge s’applique aux séries suivantes', async ({ app }) => {
    await startSession(app);
    await app.locator('button[data-key="0-0-1"][data-action=edit-weight]').click();
    await app.locator('button[data-key="0-0-1"][data-action=weight-step][data-dir="1"]').click();
    await app.locator('button[data-action=close-edit]').click();
    const weights = app.locator('button[data-action=edit-weight][data-key^="0-0-"]');
    await expect(weights).toHaveText(['30 kg', '32,5 kg', '32,5 kg', '32,5 kg']);
  });

  test('saisie directe d’une charge, sans propager si la case est décochée', async ({ app }) => {
    await startSession(app);
    await app.locator('button[data-key="0-0-0"][data-action=edit-weight]').click();
    await app.locator('input[data-change=apply-next]').uncheck();
    await app.locator('input[data-key="0-0-0"]').fill('27,5');
    await app.locator('input[data-key="0-0-0"]').blur();
    const weights = app.locator('button[data-action=edit-weight][data-key^="0-0-"]');
    await expect(weights).toHaveText(['27,5 kg', '30 kg', '30 kg', '30 kg']);
  });

  test('une saisie de charge invalide est ignorée', async ({ app }) => {
    await startSession(app);
    await app.locator('button[data-key="0-0-0"][data-action=edit-weight]').click();
    await app.locator('input[data-key="0-0-0"]').fill('abc');
    await app.locator('input[data-key="0-0-0"]').blur();
    await expect(app.locator('button[data-key="0-0-0"][data-action=edit-weight]')).toHaveText('30 kg');
  });

  test('les reps se règlent avec − et +', async ({ app }) => {
    await startSession(app);
    await app.locator('button[data-key="0-0-0"][data-action=reps][data-dir="-1"]').click();
    await app.locator('button[data-key="0-0-0"][data-action=reps][data-dir="-1"]').click();
    await expect(app.locator('.set').first().locator('.reps-value')).toContainText('6');
  });

  test('la séance survit à un rechargement de la page', async ({ app }) => {
    await startSession(app);
    await app.locator('button[data-key="0-0-0"][data-action=toggle-set]').click();
    await app.reload();
    await expect(app).toHaveURL(/#\/seance$/);
    await expect(app.locator('button[data-key="0-0-0"][data-action=toggle-set]')).toHaveAttribute('aria-pressed', 'true');
    await expect(app.locator('#timer-clock')).not.toHaveText('GO');
  });

  test('retour à l’accueil puis reprise de la séance', async ({ app }) => {
    await startSession(app);
    await app.getByRole('link', { name: /Retour à l'accueil/ }).click();
    await expect(app.locator('section[aria-label="Séance en cours"]')).toBeVisible();
    await app.getByRole('link', { name: 'Reprendre' }).click();
    await expect(app).toHaveURL(/#\/seance$/);
  });

  test('annuler une séance ne laisse aucune trace', async ({ app }) => {
    await startSession(app);
    await app.locator('button[data-key="0-0-0"][data-action=toggle-set]').click();
    await app.locator('button[data-action=cancel-ask]').click();
    await app.locator('button[data-action=cancel-dismiss]').click();
    await expect((await readData(app)).active).not.toBeNull();
    await app.locator('button[data-action=cancel-ask]').click();
    await app.locator('button[data-action=cancel-confirm]').click();
    await expect(app.locator('.toast')).toHaveText('Séance annulée');
    const data = await readData(app);
    expect(data.active).toBeNull();
    expect(data.history).toHaveLength(0);
    expect(data.progress.squat.weight).toBe(30);
  });
});

test.describe('Fin de séance et progression', () => {
  test('séance réussie : charges augmentées, séance B proposée ensuite', async ({ app }) => {
    await startSession(app);
    await completeAllSets(app);
    await app.locator('header button[data-action=finish]').click();
    const squat = app.locator('button.decision', { hasText: 'Squat barre' });
    await expect(squat).toContainText('32,5 kg');
    await expect(squat).toContainText('+2,5 kg');
    await app.locator('button[data-action=feeling][data-v="8"]').click();
    await app.locator('button[data-action=commit]').click();

    const data = await readData(app);
    expect(data.history).toHaveLength(1);
    expect(data.history[0].feeling).toBe(8);
    expect(data.progress.squat).toMatchObject({ weight: 32.5, lastChange: 2.5 });
    await expect(app.locator('section[aria-label="Prochaine séance"]')).toContainText('Séance B');
    await expect(app.locator('.day-tag.done')).toHaveCount(1);
  });

  test('échec sur un exercice lourd : on garde, puis −10 % au 2e échec', async ({ app }) => {
    for (let i = 0; i < 2; i++) {
      await startSession(app, 'A');
      await completeAllSets(app);
      await app.locator('button[data-key="0-0-3"][data-action=toggle-set]').click(); // dernière série de squat non faite
      await app.locator('header button[data-action=finish]').click();
      const squat = app.locator('button.decision', { hasText: 'Squat barre' });
      await expect(squat).toContainText(i === 0 ? '1er échec' : '2e échec');
      await app.locator('button[data-action=commit]').click();
      await expect(app.locator('.toast')).toHaveText('Séance enregistrée');
    }
    const data = await readData(app);
    expect(data.progress.squat.weight).toBe(27.5);
  });

  test('la charge proposée peut être forcée avant d’enregistrer', async ({ app }) => {
    await startSession(app);
    await completeAllSets(app);
    await app.locator('header button[data-action=finish]').click();
    await app.locator('button.decision', { hasText: 'Squat barre' }).click();
    await app.locator('button[data-action=decision-step][data-id=squat][data-dir="1"]').click();
    await app.locator('button[data-action=decision-close]').click();
    await expect(app.locator('button.decision', { hasText: 'Squat barre' })).toContainText('35 kg');
    await app.locator('button[data-action=commit]').click();
    expect((await readData(app)).progress.squat.weight).toBe(35);
  });

  test('« Revenir à la séance » depuis l’écran de fin', async ({ app }) => {
    await startSession(app);
    await app.locator('header button[data-action=finish]').click();
    await app.locator('button[data-action=resume]').click();
    await expect(app).toHaveURL(/#\/seance$/);
  });

  test('raccourci : une séance enregistrée bout à bout', async ({ app }) => {
    await startSession(app);
    await completeAllSets(app);
    await finishAndSave(app, 6);
    expect((await readData(app)).history[0].feeling).toBe(6);
  });
});
