import { expect, expectAccessible, test } from "./fixtures";

test("jogadores -> favoritar -> favoritos -> ao vivo -> classificação -> eventos -> notícias", async ({ app: page }, testInfo) => {
  const mobile = testInfo.project.name.startsWith("mobile");
  const nav = page.getByRole("navigation", { name: "Seções" });

  // Jogadores: destaques reais, palco com o time, raio-x.
  await page.goto("/#/jogadores");
  await expect(page.getByRole("heading", { level: 1, name: "Shai Gilgeous-Alexander" })).toBeVisible();
  await expect(page.getByText("Médias por jogo da temporada 2026-27, direto da ESPN (17 jogos).")).toBeVisible();
  await expect(page.locator(".big3")).toContainText("32,1");
  await expectAccessible(page, "jogadores");

  // Favoritar e trocar de jogador pelo teclado.
  await page.getByRole("button", { name: "Favoritar Shai Gilgeous-Alexander" }).click();
  await expect(page.getByRole("button", { name: "Favorito Shai Gilgeous-Alexander" })).toBeVisible();
  await page.locator("body").press("ArrowRight");
  await expect(page.getByRole("heading", { level: 1, name: "Nikola Jokic" })).toBeVisible();
  await expect(page).toHaveURL(/#\/jogadores\/3112335$/);
  await page.getByRole("button", { name: "Favoritar Nikola Jokic" }).click();

  // Comparação pelo seletor próprio (listbox).
  await page.getByRole("button", { name: "Comparar com…" }).click();
  await page.getByRole("option", { name: /Shai Gilgeous-Alexander/ }).click();
  await expect(page.getByRole("table", { name: /Frente a frente: Nikola Jokic contra Shai Gilgeous-Alexander/ })).toBeVisible();

  // Favoritos: os dois jogadores, com comparação rápida.
  await nav.getByRole("link", { name: "Favoritos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible();
  await expect(page.locator(".fav-player")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Comparação rápida" })).toBeVisible();
  await expectAccessible(page, "favoritos");

  // Os favoritos aparecem primeiro no trilho de jogadores.
  await nav.getByRole("link", { name: "Jogadores" }).click();
  await expect(page.locator(".rail .chip").first()).toContainText("Nikola Jokic");

  // Ao vivo: hoje com jogos agendados, troca de data e detalhe do jogo.
  await nav.getByRole("link", { name: "Ao vivo" }).click();
  await expect(page.getByRole("heading", { name: "quarta-feira, 25 de novembro de 2026" })).toBeVisible();
  await expect(page.locator(".game")).toHaveCount(9);
  await expect(page.locator(".game").first()).toContainText("19:00");
  await expectAccessible(page, "ao vivo (hoje)");
  await page.getByRole("button", { name: /Dia anterior/ }).click();
  await expect(page.getByRole("heading", { name: "terça-feira, 24 de novembro de 2026" })).toBeVisible();
  await expect(page.locator(".game")).toHaveCount(3);
  await page.getByRole("button", { name: /Detalhes do jogo: Detroit Pistons contra Orlando Magic/ }).click();
  const dialog = page.getByRole("dialog", { name: "Pistons x Magic" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Desmond Bane")).toBeVisible();
  await expect(dialog.getByRole("table", { name: /Pontos por período/ })).toBeVisible();
  await expectAccessible(page, "painel do jogo");
  await dialog.getByRole("button", { name: "Seguir Orlando Magic" }).click();
  await expect(dialog.getByRole("button", { name: "Seguindo Orlando Magic" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Jogo do time seguido vem primeiro e destacado.
  await expect(page.locator(".game").first()).toContainText("Você segue");
  await expect(page.locator(".game").first()).toContainText("Magic");
  await page.getByRole("button", { name: /Próximo dia/ }).click();
  await page.getByRole("button", { name: /Próximo dia/ }).click();
  await expect(page.getByText("Nenhum jogo neste dia")).toBeVisible();

  // Classificação: tabela que rola na própria caixa no celular, sem rolagem lateral da página.
  await nav.getByRole("link", { name: "Classificação" }).click();
  const east = page.getByRole("table", { name: /Conferência Leste/ });
  await expect(east).toBeVisible();
  await expect(east.getByRole("row").nth(1)).toContainText(mobile ? "PHI" : "Philadelphia 76ers");
  const region = page.getByRole("region", { name: "Tabela da Conferência Leste" });
  expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(mobile);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectAccessible(page, "classificação");

  // Eventos: NBA Cup, All-Star sem data inventada, Draft.
  await nav.getByRole("link", { name: "Eventos" }).click();
  await expect(page.getByText(/Fase de grupos: 60 jogos/)).toBeVisible();
  await expect(page.getByText("Data não disponível na fonte")).toBeVisible();
  await expect(page.getByText("AJ Dybantsa")).toBeVisible();
  await expectAccessible(page, "eventos");
  await page.getByRole("link", { name: /Ver jogo/ }).last().click();
  await expect(page).toHaveURL(/#\/ao-vivo\/20261211\?jogo=401909456/);
  // O link abre o painel do jogo na aba Ao vivo; fecha com Esc antes de seguir.
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Notícias.
  await nav.getByRole("link", { name: "Notícias" }).click();
  await expect(page.getByRole("link", { name: /abre a ESPN em nova aba/ }).first()).toHaveAttribute("target", "_blank");
  await expectAccessible(page, "notícias");
});

test("abertura animada aparece na primeira visita da sessão e pode ser pulada", async ({ page }) => {
  await page.route("**/api/nba?**", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "x" }) }));
  await page.goto("/");
  const intro = page.getByTestId("intro");
  await expect(intro).toBeVisible();
  await page.getByRole("button", { name: "Pular abertura" }).click();
  await expect(intro).toBeHidden();
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();
  await expect(intro).toBeHidden();
});

test("sem a API (site estático), cai no instantâneo offline com a data de captura", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("garrafao:intro-seen", "1"));
  await page.route("**/api/nba?**", (route) => route.fulfill({ status: 404, contentType: "text/html", body: "<!doctype html><title>404</title>" }));
  await page.route(/^https:\/\/a\.espncdn\.com\//, (route) => route.abort());
  await page.goto("/#/jogadores");
  await expect(page.getByText(/Sem conexão com a fonte\./)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name: "Ao vivo" }).click();
  await expect(page.getByRole("alert")).toContainText("A fonte de dados não respondeu agora");
  await expect(page.getByRole("button", { name: "Tentar de novo", exact: true })).toBeVisible();
});
