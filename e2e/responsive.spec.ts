import { expect, test } from "./fixtures";

/**
 * Nada torto, cortado ou sobreposto: em cada largura e tema, nenhuma aba pode ter rolagem horizontal da página.
 * Tabelas (classificação, placar por período) rolam dentro da própria caixa.
 */
const WIDTHS = [320, 375, 390, 768, 1024, 1280, 1440, 1920];
const SCREENS = [
  { name: "jogadores (sobrenome longo)", hash: "#/jogadores/4278073", ready: "Shai Gilgeous-Alexander" },
  { name: "jogadores (Antetokounmpo, comparação)", hash: "#/jogadores/3032977?vs=4278073", ready: "Giannis Antetokounmpo" },
  { name: "favoritos", hash: "#/favoritos", ready: "Favoritos" },
  { name: "ao vivo", hash: "#/ao-vivo/20261124", ready: "Ao vivo" },
  { name: "painel do jogo", hash: "#/ao-vivo/20261124?jogo=401909314", ready: "Ao vivo" },
  { name: "classificação", hash: "#/classificacao", ready: "Classificação" },
  { name: "eventos", hash: "#/eventos", ready: "Eventos" },
  { name: "notícias", hash: "#/noticias", ready: "Notícias" },
];

// A varredura de larguras roda uma vez por tema (nos projetos desktop); os projetos mobile já cobrem 390 px com toque.
test("todas as abas, de 320 a 1920 px, sem rolagem horizontal e com o sobrenome inteiro", async ({ app: page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "varredura feita nos projetos desktop (claro e escuro)");
  await page.addInitScript(() =>
    window.localStorage.setItem("garrafao:state", JSON.stringify({ version: 1, favorites: { players: ["4278073", "3032977"], teams: ["20"] }, theme: "system" })),
  );
  const problems: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of SCREENS) {
      await page.goto(`/${screen.hash}`);
      await expect(page.getByRole("heading", { level: 1, name: screen.ready })).toBeVisible();
      await page.waitForTimeout(400);
      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const heading = document.querySelector("h1.last") as HTMLElement | null;
        const box = heading?.parentElement?.getBoundingClientRect();
        const rect = heading?.getBoundingClientRect();
        return {
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          nameFits: !heading || !box || !rect ? true : rect.right <= box.right + 1 && heading.scrollWidth <= heading.clientWidth + 1,
        };
      });
      if (metrics.scrollWidth > metrics.clientWidth) problems.push(`${width}px ${screen.name}: scrollWidth ${metrics.scrollWidth} > ${metrics.clientWidth}`);
      if (!metrics.nameFits) problems.push(`${width}px ${screen.name}: sobrenome cortado`);
    }
  }
  expect(problems).toEqual([]);
});
