import { readFileSync } from 'node:fs';
import { test, expect, readData, doFullSession, toast } from './fixtures';

test.describe('Données : export et import', () => {
  test('export complet puis import en fusion et en remplacement', async ({ app }) => {
    await doFullSession(app);
    await app.getByRole('link', { name: 'Données et sauvegarde' }).click();
    const download = app.waitForEvent('download');
    await app.locator('button[data-action=export-all]').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^dannythedog-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await file.path();
    const exported = JSON.parse(readFileSync(path, 'utf8'));
    expect(exported.history).toHaveLength(1);
    expect(exported.active).toBeNull();
    expect((await readData(app)).lastExport).not.toBeNull();

    // Fusion du même contenu : rien n'est dupliqué, et l'appli le dit
    await app.locator('input[data-change=import-file]').setInputFiles(path);
    await expect(app.getByRole('dialog', { name: 'Importer une sauvegarde' })).toContainText('1 séance(s)');
    await app.locator('button[data-action=import-merge]').click();
    await expect(toast(app)).toContainText('Rien de nouveau');
    expect((await readData(app)).history).toHaveLength(1);

    // Remplacement après une séance supplémentaire : on revient à l'état exporté
    await app.getByRole('link', { name: "Retour à l'accueil" }).click();
    await doFullSession(app);
    expect((await readData(app)).history).toHaveLength(2);
    await app.getByRole('link', { name: 'Données et sauvegarde' }).click();
    await app.locator('input[data-change=import-file]').setInputFiles(path);
    await app.locator('button[data-action=import-replace]').click();
    await expect(toast(app)).toContainText('Données remplacées : 1 séance(s)');
    expect((await readData(app)).history).toHaveLength(1);
  });

  test('import dans un téléphone vierge : les séances modifiées et les charges sont reprises', async ({ app, browser }) => {
    // Téléphone 1 : séance A renommée + une séance faite
    await app.getByRole('link', { name: 'Gérer mes séances' }).click();
    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('input[data-change=ed-name]').fill('Séance A — Jambes');
    await app.locator('input[data-change=ed-name]').blur();
    await app.locator('button[data-action=ed-save]').click();
    await app.goto('./#/');
    await doFullSession(app, 'A');
    await app.getByRole('link', { name: 'Données et sauvegarde' }).click();
    const download = app.waitForEvent('download');
    await app.locator('button[data-action=export-all]').click();
    const path = await (await download).path();

    // Téléphone 2 : tout neuf, on fusionne
    const ctx = await browser.newContext({ ...test.info().project.use, serviceWorkers: 'block' });
    const phone2 = await ctx.newPage();
    await phone2.goto('./#/donnees');
    await phone2.locator('input[data-change=import-file]').setInputFiles(path);
    await phone2.locator('button[data-action=import-merge]').click();
    await expect(phone2.locator('.toast')).toContainText('1 séance');
    await expect(phone2.locator('.toast')).toContainText('1 modèle mis à jour');
    const data = await readData(phone2);
    expect(data.templates[0].name).toBe('Séance A — Jambes');
    expect(data.progress.squat.weight).toBe(32.5);
    expect(data.history).toHaveLength(1);
    await ctx.close();
  });

  test('partage d’un modèle de séance', async ({ app }) => {
    await app.getByRole('link', { name: 'Données et sauvegarde' }).click();
    const download = app.waitForEvent('download');
    await app.locator('button[data-action=export-template][data-id=A]').click();
    const path = await (await download).path();
    const tpl = JSON.parse(readFileSync(path, 'utf8'));
    expect(tpl.type).toBe('dannythedog-template');
    expect(tpl.exercises.length).toBeGreaterThan(0);

    await app.locator('input[data-change=import-file]').setInputFiles(path);
    await expect(toast(app)).toContainText('ajoutée');
    const ids = (await readData(app)).templates.map((t: { id: string }) => t.id);
    expect(ids).toEqual(['A', 'B', 'C', 'A2']);
  });

  test('fichier invalide', async ({ app }) => {
    await app.getByRole('link', { name: 'Données et sauvegarde' }).click();
    await app.locator('input[data-change=import-file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
    await expect(toast(app)).toHaveText("Ce fichier n'est pas une sauvegarde Danny the DOG.");
    await app.locator('input[data-change=import-file]').setInputFiles({ name: 'y.json', mimeType: 'application/json', buffer: Buffer.from('pas du json') });
    await expect(toast(app)).toHaveText("Ce fichier n'est pas un JSON valide.");
  });

  test('effacer toutes les données (avec confirmation)', async ({ app }) => {
    await doFullSession(app);
    await app.getByRole('link', { name: 'Données et sauvegarde' }).click();
    await app.locator('button[data-action=clear-ask]').click();
    await app.locator('button[data-action=clear-cancel]').click();
    expect((await readData(app)).history).toHaveLength(1);
    await app.locator('button[data-action=clear-ask]').click();
    await app.locator('button[data-action=clear-confirm]').click();
    await expect(toast(app)).toHaveText('Données effacées');
    expect((await readData(app)).history).toHaveLength(0);
  });

  test('effacer remet aussi les séances du programme de base', async ({ app }) => {
    await app.getByRole('link', { name: 'Gérer mes séances' }).click();
    await app.locator('button[data-action=tpl-edit][data-id=A]').click();
    await app.locator('input[data-change=ed-name]').fill('Ma séance perso');
    await app.locator('input[data-change=ed-name]').blur();
    await app.locator('button[data-action=ed-save]').click();
    await app.goto('./#/donnees');
    await app.locator('button[data-action=clear-ask]').click();
    await app.locator('button[data-action=clear-confirm]').click();
    expect((await readData(app)).templates[0].name).toBe('Séance A — Squat');
  });

  test('une sauvegarde V1 (sans mesures) s’importe toujours', async ({ app }) => {
    await app.getByRole('link', { name: 'Données et sauvegarde' }).click();
    const v1 = await app.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('dannythedog:data')!);
      delete d.body;
      return JSON.stringify(d);
    });
    await app.locator('input[data-change=import-file]').setInputFiles({ name: 'v1.json', mimeType: 'application/json', buffer: Buffer.from(v1) });
    await app.locator('button[data-action=import-replace]').click();
    expect((await readData(app)).body).toEqual([]);
    await app.getByRole('link', { name: "Retour à l'accueil" }).click();
    await app.getByRole('link', { name: 'Corps' }).click();
    await expect(app.getByRole('heading', { name: 'Corps' })).toBeVisible();
  });
});
