import { defineConfig } from '@playwright/test'

// E2E_BASE_URL runs the suite against an already-running server (e.g. `npm start`).
const external = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: external ?? 'http://127.0.0.1:3123',
    launchOptions: { executablePath: '/usr/bin/google-chrome' },
    viewport: { width: 1360, height: 900 },
  },
  webServer: external
    ? undefined
    : {
        command: 'npx vite dev --port 3123 --host 127.0.0.1 --strictPort',
        url: 'http://127.0.0.1:3123',
        reuseExistingServer: false,
        // The suite makes more demo songs in a run than one visitor is allowed in an hour.
        env: { DATA_DIR: 'test-results/.data', MUSIC_PROVIDER: 'demo', MUSIC_HOURLY_PER_CLIENT: '60', MUSIC_DAILY_LIMIT: '200' },
        timeout: 60_000,
      },
})
