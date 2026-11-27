import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../src/App";
import { AwardsPage, seasonFromRoute } from "../../src/features/awards/AwardsPage";
import { parseHash } from "../../src/lib/router";
import { resetPersistedCache, SCHEMA_VERSION, STORAGE_KEY } from "../../src/lib/storage";
import { FIXTURE_NOW } from "../support/fixture-fetch";
import { proxyResponse, server } from "../support/msw";

const now = () => FIXTURE_NOW;

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Intercepta só uma operação; as outras seguem para o handler real sobre as respostas gravadas. */
function onOp(op: string, reply: (request: Request) => Response | Promise<Response>) {
  server.use(
    http.get("*/api/nba", ({ request }) => {
      const url = new URL(request.url);
      return url.searchParams.get("op") === op ? reply(request) : proxyResponse(url.pathname + url.search);
    }),
  );
}

beforeEach(() => {
  resetPersistedCache();
  window.location.hash = "";
  window.sessionStorage.setItem("garrafao:intro-seen", "1");
});

describe("Prêmios", () => {
  it("abre na última temporada encerrada com campeão, Copa, MVP, calouro, Draft e a disputa atual", async () => {
    renderWithClient(<AwardsPage route={parseHash("#/premios")} now={now} />);
    expect(screen.getByRole("heading", { level: 2, name: "Temporada 2025-26" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ver temporada" })).toHaveValue("2026");

    const champion = await screen.findByRole("region", { name: "Campeão da NBA" });
    expect(within(champion).getByText("New York Knicks")).toBeInTheDocument();
    expect(within(champion).getByText(/Venceu a final por 4 a 1 contra o San Antonio Spurs/)).toBeInTheDocument();
    expect(within(champion).getByRole("link", { name: "Jalen Brunson" })).toHaveAttribute("href", "#/jogadores/3934672");

    const main = screen.getByRole("region", { name: "MVP e calouro do ano" });
    expect(within(main).getByRole("link", { name: "Shai Gilgeous-Alexander" })).toHaveAttribute("href", "#/jogadores/4278073");
    expect(within(main).getByRole("link", { name: "Cooper Flagg" })).toBeInTheDocument();

    const cup = screen.getByRole("region", { name: "Copa NBA" });
    expect(await within(cup).findByText(/Campeão da Copa NBA 2025-26: 124 a 113 no San Antonio Spurs/)).toBeInTheDocument();
    expect(within(cup).getByRole("link", { name: "Ver a final" })).toHaveAttribute("href", expect.stringMatching(/^#\/ao-vivo\/20251216\?jogo=\d+$/));

    const draft = await screen.findByRole("region", { name: "Draft 2026: as três primeiras escolhas" });
    expect(within(draft).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("AJ Dybantsa"),
      expect.stringContaining("Darryn Peterson"),
      expect.stringContaining("Cameron Boozer"),
    ]);

    const race = screen.getByRole("region", { name: "Disputa pelo MVP · 2026-27" });
    expect(within(race).getByText(/não publica votação nem ranking do MVP/)).toBeInTheDocument();
    const points = await within(race).findByRole("region", { name: "Pontos por jogo" });
    expect(within(points).getAllByRole("listitem")[0]).toHaveTextContent("Luka Doncic");
    expect(within(points).getAllByRole("listitem")[0]).toHaveTextContent("36,6");
  });

  it("link direto para a temporada em andamento: estado vazio honesto, Copa e Draft ainda por vir", async () => {
    renderWithClient(<AwardsPage route={parseHash("#/premios/2027")} now={now} />);
    expect(await screen.findByText("Nenhum prêmio publicado ainda")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Campeão da NBA" })).not.toBeInTheDocument();
    expect(await screen.findByText(/Final da Copa NBA ainda não disputada/)).toBeInTheDocument();
    expect(await screen.findByText("As escolhas deste Draft ainda não foram publicadas pela fonte.")).toBeInTheDocument();
  });

  it("trocar a temporada no seletor muda o endereço (vai para o histórico)", async () => {
    window.location.hash = "#/premios/2027";
    renderWithClient(<AwardsPage route={parseHash(window.location.hash)} now={now} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Ver temporada" }), "2026");
    await waitFor(() => expect(window.location.hash).toBe("#/premios/2026"));
  });

  it("temporada inválida no link volta ao endereço canônico sem criar histórico", async () => {
    window.location.hash = "#/premios/1999";
    renderWithClient(<AwardsPage route={parseHash(window.location.hash)} now={now} />);
    await waitFor(() => expect(window.location.hash).toBe("#/premios"));
    expect(screen.getByRole("heading", { level: 2, name: "Temporada 2025-26" })).toBeInTheDocument();
  });

  it("erro da API de prêmios mostra alerta e tentar de novo recupera", async () => {
    let failures = 1;
    onOp("awards", async (request) => {
      if (failures-- > 0) return HttpResponse.json({ error: "x" }, { status: 502 });
      const url = new URL(request.url);
      return proxyResponse(url.pathname + url.search);
    });
    renderWithClient(<AwardsPage route={parseHash("#/premios/2026")} now={now} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar os prêmios");
    expect(alert).toHaveTextContent("A fonte de dados não respondeu agora");
    await userEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("region", { name: "Campeão da NBA" })).toBeInTheDocument();
  });

  it("falha parcial avisa e mostra o que veio completo", async () => {
    onOp("awards", async (request) => {
      const url = new URL(request.url);
      const body = (await (await proxyResponse(url.pathname + url.search)).json()) as { awards: { key: string }[]; failed: string[] };
      return HttpResponse.json({ ...body, awards: body.awards.filter((award) => award.key !== "roy"), failed: ["roy"] });
    });
    renderWithClient(<AwardsPage route={parseHash("#/premios/2026")} now={now} />);
    expect(await screen.findByText(/Parte dos prêmios não carregou agora \(1\)/)).toBeInTheDocument();
    const main = screen.getByRole("region", { name: "MVP e calouro do ano" });
    expect(within(main).getByRole("link", { name: "Shai Gilgeous-Alexander" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cooper Flagg" })).not.toBeInTheDocument();
  });

  it("líderes vazios (temporada sem estatísticas) viram estado vazio", async () => {
    onOp("leaders", () => HttpResponse.json({ year: 2027, label: "2026-27", categories: [] }));
    renderWithClient(<AwardsPage route={parseHash("#/premios")} now={now} />);
    expect(await screen.findByText("Ainda sem líderes")).toBeInTheDocument();
  });

  it("seasonFromRoute: padrão, intervalo aceito e fallback", () => {
    expect(seasonFromRoute(null, FIXTURE_NOW)).toEqual({ year: 2026, valid: true });
    expect(seasonFromRoute("2027", FIXTURE_NOW)).toEqual({ year: 2027, valid: true });
    expect(seasonFromRoute("2017", FIXTURE_NOW)).toEqual({ year: 2017, valid: true });
    expect(seasonFromRoute("2016", FIXTURE_NOW)).toEqual({ year: 2026, valid: false });
    expect(seasonFromRoute("2028", FIXTURE_NOW)).toEqual({ year: 2026, valid: false });
    expect(seasonFromRoute("abc", FIXTURE_NOW)).toEqual({ year: 2026, valid: false });
    expect(seasonFromRoute("2026", new Date("2026-07-02T12:00:00Z"))).toEqual({ year: 2026, valid: true });
    expect(seasonFromRoute(null, new Date("2026-06-20T12:00:00Z"))).toEqual({ year: 2025, valid: true });
  });
});

describe("App: aba Prêmios e tema padrão", () => {
  it("link direto abre a aba Prêmios marcada no menu e, sem tema salvo, no tema escuro", async () => {
    window.location.hash = "#/premios";
    renderWithClient(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Prêmios" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Seções" });
    expect(within(nav).getByRole("link", { name: "Prêmios" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Prêmios" })).toHaveAttribute("href", "#/premios");
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(screen.getByRole("button", { name: "Tema escuro. Trocar tema" })).toBeInTheDocument();
    expect(document.title).toBe("Prêmios · Garrafão, NBA com dados públicos");
  });

  it("tema claro escolhido antes continua claro", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, favorites: { players: [], teams: [] }, theme: "light" }));
    resetPersistedCache();
    window.location.hash = "#/premios";
    renderWithClient(<App />);
    await screen.findByRole("heading", { level: 1, name: "Prêmios" });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    await userEvent.click(screen.getByRole("button", { name: "Tema claro. Trocar tema" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").theme).toBe("dark");
  });
});
