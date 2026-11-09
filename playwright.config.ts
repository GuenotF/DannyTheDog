import { defineConfig, devices } from '@playwright/test';

/** Chrome local (sandbox de dev) si PW_CHROMIUM_PATH est défini ; sinon le Chromium de Playwright (CI). */
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173/DannyTheDog/',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    serviceWorkers: 'block',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath, args: ['--no-sandbox'] } : {}
  },
  projects: [{ name: 'mobile-chromium' }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/DannyTheDog/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
