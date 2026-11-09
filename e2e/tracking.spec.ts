import { test, expect, readData, doFullSession, seedData } from './fixtures';

test.describe('Historique', () => {
  test('vide au départ', async ({ app }) => {
    await app.getByRole('link', { name: 'Historique' }).click();
    await expect(app.getByText('Pas encore de séance')).toBeVisible();
  });

  test('liste, filtre, détail et suppression', async ({ app }) => {
    await doFullSession(app); // A
    await doFullSession(app); // B
    await app.getByRole('link', { name: 'Historique' }).click();
    await expect(app.locator('.hist-card')).toHaveCount(2);
    await expect(app.getByText('Cette semaine')).toBeVisible();

    await app.locator('button[data-action=hist-filter][data-id=B]').click();
    await expect(app.locator('.hist-card')).toHaveCount(1);
    await app.locator('button[data-action=hist-filter][data-id=Toutes]').click();

    const cardA = app.locator('.hist-card', { hasText: 'Séance A' });
    await cardA.locator('button[data-action=hist-toggle]').click();
    await expect(cardA.locator('.hist-ex')).toHaveCount(7);
    await expect(cardA).toContainText('8 / 8 / 8 / 8');

    await cardA.locator('button[data-action=hist-delete-ask]').click();
    await cardA.locator('button[data-action=hist-delete]').click();
    await expect(app.locator('.toast')).toHaveText('Séance supprimée');
    await expect(app.locator('.hist-card')).toHaveCount(1);
    const data = await readData(app);
    expect(data.history).toHaveLength(1);
    expect(data.progress.squat.weight).toBe(32.5); // les charges ne bougent pas
  });

  test('« Refaire cette séance » démarre la même séance', async ({ app }) => {
    await doFullSession(app);
    await app.getByRole('link', { name: 'Historique' }).click();
    await app.locator('button[data-action=hist-toggle]').first().click();
    await app.locator('.hist-detail button[data-action=start]').click();
    await expect(app).toHaveURL(/#\/seance$/);
    await expect(app.locator('.session-header')).toContainText('Séance A');
  });
});

test.describe('Progrès', () => {
  test('message sans données, puis courbe après des séances', async ({ app }) => {
    await app.getByRole('link', { name: 'Progrès' }).click();
    await expect(app.getByText(/Pas encore de séance enregistrée/)).toBeVisible();

    await app.getByRole('link', { name: 'Accueil' }).click();
    await doFullSession(app, 'A');
    await doFullSession(app, 'A');
    await app.getByRole('link', { name: 'Progrès' }).click();
    await app.locator('button[data-action=prog-pick][data-id=squat].chip').click();
    await expect(app.locator('section[aria-label="Charge de travail"]')).toContainText('32,5 kg');
    await expect(app.locator('.chart-hit')).toHaveCount(2);
    await app.locator('.chart-hit[data-i="0"]').click();
    await expect(app.locator('.chart-tip')).toContainText('30 kg');
    await expect(app.locator('.chart-tip')).toContainText('8 / 8 / 8 / 8');
    await expect(app.locator('.table-row', { hasText: 'Squat barre' })).toContainText('35 kg');
  });
});

test.describe('Corps', () => {
  test('ajout, remplacement le même jour, courbe et suppression', async ({ app }) => {
    await app.getByRole('link', { name: 'Corps' }).click();
    await app.locator('input[data-key=weight]').fill('61,2');
    await app.locator('input[data-key=weight]').blur();
    await app.locator('button[data-action=body-step][data-key=waist][data-dir="1"]').click();
    await app.locator('button[data-action=body-save]').click();
    await expect(app.locator('.toast')).toHaveText('Mesure enregistrée');
    await app.locator('button[data-action=body-step][data-key=weight][data-dir="-1"]').click();
    await app.locator('button[data-action=body-save]').click();

    let data = await readData(app);
    expect(data.body).toHaveLength(1);
    expect(data.body[0].weight).toBe(61.1);
    expect(data.body[0].waist).toBe(75);
    await expect(app.locator('section[aria-label="Évolution"]')).toContainText('61,1 kg');

    await app.locator('button[data-action=body-metric][data-id=waist]').click();
    await expect(app.locator('section[aria-label="Évolution"]')).toContainText('75 cm');

    await app.locator('button[data-action=body-delete]').click();
    data = await readData(app);
    expect(data.body).toHaveLength(0);
  });

  test('courbe sur plusieurs jours', async ({ app }) => {
    await seedData(app, `const day = 86400000;
      d.body = [60, 60.4, 60.8].map((w, i) => ({ id: 'b' + i, at: Date.now() - (2 - i) * 3 * day, weight: w, waist: null }));`);
    await app.getByRole('link', { name: 'Corps' }).click();
    await expect(app.locator('.chart-hit')).toHaveCount(3);
    await expect(app.locator('section[aria-label="Évolution"]')).toContainText('+0,8 kg');
    await expect(app.locator('input[data-key=weight]')).toHaveValue('60,8');
  });
});
