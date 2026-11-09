import { test as base, expect, type Page } from '@playwright/test';

/** Chaque test part d'un navigateur vierge et échoue si l'appli lève une erreur JavaScript. */
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Cette semaine' })).toBeVisible();
    await use(page);
    expect(errors, 'erreurs JavaScript pendant le test').toEqual([]);
  }
});

export { expect };

export const STORAGE_KEY = 'dannythedog:data';

export async function readData(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), STORAGE_KEY);
}

/** Modifie les données stockées puis recharge l'appli. */
export async function seedData(page: Page, mutate: string) {
  await page.evaluate(
    ([k, body]) => {
      const d = JSON.parse(localStorage.getItem(k)!);
      new Function('d', body)(d);
      localStorage.setItem(k, JSON.stringify(d));
    },
    [STORAGE_KEY, mutate]
  );
  await page.reload();
}

export const toast = (page: Page) => page.locator('.toast');

/** Démarre la séance proposée sur l'accueil (ou celle dont la lettre est donnée). */
export async function startSession(page: Page, id?: string) {
  const btn = id ? page.locator(`button[data-action=start][data-id="${id}"]`).first() : page.locator('section[aria-label="Prochaine séance"] button[data-action=start]');
  await btn.click();
  await expect(page).toHaveURL(/#\/seance$/);
  // L'écran est rendu après l'événement hashchange : on attend qu'il soit là.
  await expect(page.locator('button[data-action=toggle-set]').first()).toBeVisible();
}

/** Valide toutes les séries de la séance en cours. */
export async function completeAllSets(page: Page) {
  const all = page.locator('button[data-action=toggle-set]');
  await expect(all.first()).toBeVisible();
  const open = page.locator('button[data-action=toggle-set][aria-pressed=false]');
  while ((await open.count()) > 0) await open.first().click();
  await expect(open).toHaveCount(0);
}

export async function finishAndSave(page: Page, feeling = 7) {
  await page.locator('header button[data-action=finish]').click();
  await expect(page).toHaveURL(/#\/fin$/);
  await page.locator(`button[data-action=feeling][data-v="${feeling}"]`).click();
  await page.locator('button[data-action=commit]').click();
  await expect(page.locator('.toast')).toHaveText('Séance enregistrée');
}

/** Enregistre une séance complète via l'interface. */
export async function doFullSession(page: Page, id?: string) {
  await startSession(page, id);
  await completeAllSets(page);
  await finishAndSave(page);
}
