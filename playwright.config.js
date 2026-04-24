const path = require('path')
const { defineConfig } = require('@playwright/test')

const TEST_PORT = Number(process.env.PLAYWRIGHT_TEST_PORT || 4185)
const runtimeDir = path.join(__dirname, 'tests', 'e2e', '.runtime')
const dataDir = path.join(runtimeDir, 'data')
const fixturePath = path.join(__dirname, 'tests', 'e2e', 'fixtures', 'mock-scraper.json')

module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests', 'e2e', 'specs'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${TEST_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node server.js',
    url: `http://127.0.0.1:${TEST_PORT}/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      PFB_TEST_MODE: '1',
      PFB_DATA_DIR: dataDir,
      PFB_TEST_FIXTURE_PATH: fixturePath,
    },
  },
})