import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../src/App";
import { EventsPage } from "../../src/features/events/EventsPage";
import { FavoritesPage } from "../../src/features/favorites/FavoritesPage";
import { LivePage } from "../../src/features/live/LivePage";
import { NewsPage } from "../../src/features/news/NewsPage";
import { StandingsPage } from "../../src/features/standings/StandingsPage";
import { parseHash } from "../../src/lib/router";
import { resetPersistedCache, STORAGE_KEY } from "../../src/lib/storage";
import { FIXTURE_NOW } from "../support/fixture-fetch";
import { server } from "../support/msw";

const now = () => FIXTURE_NOW;

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  resetPersistedCache();
  window.location.hash = "";
  window.sessionStorage.setItem("garrafao:intro-seen", "1");
});

describe("Ao vivo", () => {
  it("lista os jogos agendados do dia com horário de Brasília e nota da NBA Cup", async () => {
    renderWithClient(<LivePage route={parseHash("#/ao-vivo/20261125")} now={now} />);
    const list = await screen.findByRole("list", { name: /Jogos de quarta-feira, 25 de novembro de 2026/ });
    const cards = within(list).getAllByRole("listitem").filter((li) => li.classList.contains("game"));
    expect(cards).toHaveLength(9);
    expect(within(cards[0]).getByText("19:00")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Copa NBA · fase de grupos")).toBeInTheDocument();
  });

  it("jogos finalizados mostram placar por quarto em tabela acessível", async () => {
    renderWithClient(<LivePage route={parseHash("#/ao-vivo/20261124")} now={now} />);
    const table = await screen.findByRole("table", { name: /Detroit Pistons contra Orlando Magic/ });
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).getByRole("rowheader")).toHaveTextContent("DET");
    expect(rows[1]).toHaveTextContent("16322531104");
    expect(screen.getAllByText("Final").length).toBe(3);
  });

  it("dia sem jogos mostra estado vazio", async () => {
    renderWithClient(<LivePage route={parseHash("#/ao-vivo/20261126")} now={now} />);
    expect(await screen.findByText("Nenhum jogo neste dia")).toBeInTheDocument();
  });

  it("painel do jogo traz líderes e fecha com Esc", async () => {
    window.location.hash = "#/ao-vivo/20261124?jogo=401909314";
    renderWithClient(<LivePage route={parseHash(window.location.hash)} now={now} />);
    const dialog = await screen.findByRole("dialog", { name: "Pistons x Magic" });
    expect(await within(dialog).findByText("Desmond Bane")).toBeInTheDocument();
    expect(within(dialog).getByText("Kia Center")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(window.location.hash).toBe("#/ao-vivo/20261124"));
  });

  it("erro da API mostra mensagem e tentar de novo recupera", async () => {
    server.use(http.get("*/api/nba", () => HttpResponse.json({ error: "x" }, { status: 502 }), { once: true }));
    renderWithClient(<LivePage route={parseHash("#/ao-vivo/20261124")} now={now} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("A fonte de dados não respondeu agora");
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("table", { name: /Detroit Pistons/ })).toBeInTheDocument();
  });
});

describe("Classificação", () => {
  it("duas conferências, líder com travessão em jogos atrás, sequência legível", async () => {
    renderWithClient(<StandingsPage />);
    const east = await screen.findByRole("table", { name: /Conferência Leste/ });
    expect(screen.getByRole("table", { name: /Conferência Oeste/ })).toBeInTheDocument();
    const first = within(east).getAllByRole("row")[1];
    expect(first).toHaveTextContent("Philadelphia 76ers");
    expect(first).toHaveTextContent("—");
    expect(within(first).getByText("1 derrota seguida")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tabela da Conferência Leste" })).toHaveAttribute("tabindex", "0");
  });

  it("seguir time persiste nos favoritos", async () => {
    renderWithClient(<StandingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Seguir Philadelphia 76ers" }));
    expect(screen.getByRole("button", { name: "Seguindo Philadelphia 76ers" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").favorites.teams).toEqual(["20"]);
  });

  it("com a API fora, mostra o instantâneo offline com a data de captura", async () => {
    server.use(http.get("*/api/nba", () => new HttpResponse("<!doctype html>", { status: 404, headers: { "Content-Type": "text/html" } })));
    renderWithClient(<StandingsPage />);
    expect(await screen.findByText(/Sem conexão com a fonte/)).toBeInTheDocument();
    expect(screen.getByText(/instantâneo gravado em \d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Conferência Leste/ })).toBeInTheDocument();
  });
});

describe("Eventos", () => {
  it("NBA Cup com mata-mata sem horário, All-Star sem data inventada e Draft da API core", async () => {
    renderWithClient(<EventsPage now={now} />);
    expect(await screen.findByRole("heading", { name: "Temporada 2026-27" })).toBeInTheDocument();
    expect(screen.getByText(/Fase de grupos: 60 jogos/)).toBeInTheDocument();
    expect(screen.getAllByText(/horário a definir/)).toHaveLength(6);
    expect(screen.getByText("Data não disponível na fonte")).toBeInTheDocument();
    const final = screen.getAllByRole("link", { name: /Ver jogo/ }).at(-1);
    expect(final).toHaveAttribute("href", "#/ao-vivo/20261211?jogo=401909456");
    expect(await screen.findByText("Draft 2027")).toBeInTheDocument();
    expect(screen.getByText("Agendado")).toBeInTheDocument();
    expect(await screen.findByText("Primeira rodada do Draft 2026")).toBeInTheDocument();
    expect(screen.getByText("AJ Dybantsa")).toBeInTheDocument();
  });
});

describe("Notícias", () => {
  it("manchetes com link externo seguro", async () => {
    renderWithClient(<NewsPage />);
    const links = await screen.findAllByRole("link", { name: /abre a ESPN em nova aba/ });
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });
});

describe("Jogadores e favoritos", () => {
  it("carrega os destaques reais, favorita e o favorito aparece na aba Favoritos com comparação", async () => {
    window.location.hash = "#/jogadores/3112335";
    renderWithClient(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Nikola Jokic" })).toBeInTheDocument();
    expect(screen.getByText(/Médias por jogo da temporada 2026-27, direto da ESPN \(16 jogos\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Favoritar Nikola Jokic" }));
    await userEvent.click(screen.getAllByRole("button", { name: /Shai Gilgeous-Alexander/ })[0]);
    await waitFor(() => expect(window.location.hash).toBe("#/jogadores/4278073"));
    await userEvent.click(await screen.findByRole("button", { name: "Favoritar Shai Gilgeous-Alexander" }));
    expect(await screen.findByRole("button", { name: "Favorito Shai Gilgeous-Alexander" })).toBeInTheDocument();

    window.location.hash = "#/favoritos";
    resetPersistedCache();
    renderWithClient(<FavoritesPage />);
    expect(await screen.findByRole("heading", { name: "Comparação rápida" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Shai Gilgeous-Alexander" })[0]).toHaveAttribute("href", "#/jogadores/4278073");
    expect(screen.getByRole("table", { name: /Frente a frente/ })).toBeInTheDocument();
  });

  it("filtro por posição e busca na liga inteira", async () => {
    window.location.hash = "#/jogadores";
    renderWithClient(<App />);
    await screen.findByRole("heading", { level: 1, name: "Shai Gilgeous-Alexander" });
    await userEvent.click(screen.getByRole("button", { name: "Pivôs" }));
    const rail = document.querySelector(".rail") as HTMLElement;
    expect(within(rail).queryByRole("button", { name: /Stephen Curry/ })).not.toBeInTheDocument();
    expect(within(rail).getByRole("button", { name: /Nikola Jokic/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Todos" }));
    await userEvent.type(screen.getByRole("searchbox", { name: /Buscar jogador/ }), "curry");
    expect(await within(rail).findByRole("button", { name: /Seth Curry.*Carregar da liga/ })).toBeInTheDocument();
  });

  it("API fora: jogadores vêm do instantâneo e o topo avisa", async () => {
    server.use(http.get("*/api/nba", () => HttpResponse.error()));
    window.location.hash = "#/jogadores";
    renderWithClient(<App />);
    expect(await screen.findByText(/Mostrando jogadores e médias do instantâneo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Situação dos dados: Dados: instantâneo\. A fonte não respondeu: mostrando o instantâneo gravado em \d{2}\/\d{2}\/\d{4}/ })).toBeInTheDocument();
  });
});
