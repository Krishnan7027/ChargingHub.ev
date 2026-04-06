import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  globalSetup: './tests/fixtures/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        baseURL: API_URL,
      },
    },
    {
      name: 'ui',
      testMatch: /.*\.ui\.spec\.ts/,
      use: {
        baseURL: BASE_URL,
      },
    },
  ],
});
