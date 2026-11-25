import { defineConfig } from "@playwright/test";

const PORT = 5292;

/**
 * E2E determinístico: o app de produção (vite build + preview) roda com a API interceptada no navegador
 * (page.route), respondida pelo handler real do proxy sobre as respostas gravadas da ESPN.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-claro", use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" } },
    { name: "desktop-escuro", use: { viewport: { width: 1440, height: 900 }, colorScheme: "dark" } },
    { name: "mobile-claro", use: { viewport: { width: 390, height: 844 }, colorScheme: "light", hasTouch: true, isMobile: true } },
    { name: "mobile-escuro", use: { viewport: { width: 390, height: 844 }, colorScheme: "dark", hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 600_000,
  },
});
