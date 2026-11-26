import { defineConfig, devices } from '@playwright/test'

const PORT = 5179

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // O servidor de desenvolvimento compila cada tela na primeira visita.
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // A Nova cara é a de todos. Os testes que ainda não migraram rodam na cara antiga por esta chave (só existe nos
    // testes; os que migraram a trocam por '0' ou ligam a Nova cara nas preferências). Sai quando a migração acabar.
    storageState: { cookies: [], origins: [{ origin: `http://localhost:${PORT}`, localStorage: [{ name: 'papirus:cara-antiga', value: '1' }] }] },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Permite usar um Chromium já instalado (ex.: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium).
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
