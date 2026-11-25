import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";
import { createNbaHandler } from "../server/handler";
import { fixtureFetch, FIXTURE_NOW } from "../tests/support/fixture-fetch";

const handler = createNbaHandler({ fetch: fixtureFetch, now: () => FIXTURE_NOW, log: () => undefined });

/** Responde /api/nba no navegador com o handler real sobre as respostas gravadas. */
async function routeApi(page: Page) {
  await page.route("**/api/nba?**", async (route) => {
    const url = new URL(route.request().url());
    let status = 200;
    const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8" };
    let body: unknown = null;
    const response = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        status = code;
        return response;
      },
      json(value: unknown) {
        body = value;
      },
    };
    await handler({ method: "GET", url: url.pathname + url.search }, response);
    await route.fulfill({ status, headers, body: JSON.stringify(body) });
  });
  // Fotos e logos da ESPN ficam de fora: o teste não depende de rede e o app mostra o substituto.
  await page.route(/^https:\/\/a\.espncdn\.com\//, (route) => route.abort());
}

export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    await page.clock.setFixedTime(FIXTURE_NOW);
    await routeApi(page);
    await page.addInitScript(() => window.sessionStorage.setItem("garrafao:intro-seen", "1"));
    await use(page);
  },
});

/** Sem violações sérias ou críticas de WCAG 2.1 A/AA. */
export async function expectAccessible(page: Page, label: string) {
  // Revela as seções com animação de entrada antes de auditar.
  await page.evaluate(() => document.querySelectorAll(".reveal").forEach((node) => node.classList.add("in")));
  await page.waitForTimeout(1000);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
}

export { expect };
