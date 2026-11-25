import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { normalizeScoreboard } from "../../server/normalize/game";
import { normalizeSummary } from "../../server/normalize/summary";
import { originUrl } from "../../server/origin";
import { LivePage } from "../../src/features/live/LivePage";
import { LIVE_POLL_MS } from "../../src/lib/polling";
import { parseHash } from "../../src/lib/router";
import { fixtureFetch, fixtureJson, FIXTURE_NOW } from "../support/fixture-fetch";
import { server } from "../support/msw";
import { createNbaHandler } from "../../server/handler";
import type { FetchLike } from "../../server/fetch-json";

/** Respostas gravadas com o primeiro jogo da noite em andamento (25/11/2026, 2º quarto). */
const LIVE_URLS: Record<string, string> = {
  [originUrl.scoreboardDay("20261125")]: "scoreboard-20261125-live.json",
  [originUrl.summary("401909317")]: "summary-401909317-live.json",
};
const liveFetch: FetchLike = async (url, init) =>
  LIVE_URLS[url] ? { ok: true, status: 200, headers: { get: () => null }, json: async () => fixtureJson(LIVE_URLS[url]) } : fixtureFetch(url, init);

describe("jogo ao vivo (resposta real gravada)", () => {
  it("normaliza período, relógio e placar parcial", () => {
    const board = normalizeScoreboard(fixtureJson("scoreboard-20261125-live.json"), "20261125");
    expect(board.hasLive).toBe(true);
    const live = board.games.find((g) => g.state === "in");
    expect(live).toMatchObject({ id: "401909317", status: "live" });
    expect(live?.period).toBeGreaterThanOrEqual(1);
    expect(live?.home.linescores.length).toBe(live?.period);
    expect(live?.clock).toMatch(/^\d{1,2}:\d{2}$/);
    expect(normalizeSummary(fixtureJson("summary-401909317-live.json"))?.game.state).toBe("in");
  });

  it("proxy responde o placar ao vivo com cache curto (15 s)", async () => {
    const handler = createNbaHandler({ fetch: liveFetch, now: () => FIXTURE_NOW, log: () => undefined });
    const headers: Record<string, string> = {};
    const response = { setHeader: (k: string, v: string) => void (headers[k] = v), status: () => response, json: () => undefined };
    await handler({ url: "/api/nba?op=scoreboard&date=20261125" }, response);
    expect(headers["Cache-Control"]).toBe("public, max-age=0, s-maxage=15, stale-while-revalidate=30");
  });

  it("a aba mostra 'Ao vivo' com período e relógio, e o polling só roda com a aba visível", async () => {
    const handler = createNbaHandler({ fetch: liveFetch, now: () => FIXTURE_NOW, log: () => undefined });
    server.use(
      http.get("*/api/nba", async ({ request }) => {
        const url = new URL(request.url);
        let status = 200;
        let body: unknown = null;
        const headers = new Headers();
        const response = { setHeader: (k: string, v: string) => headers.set(k, v), status: (c: number) => ((status = c), response), json: (b: unknown) => void (body = b) };
        await handler({ url: url.pathname + url.search }, response);
        return Response.json(body, { status, headers });
      }),
    );
    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LivePage route={parseHash("#/ao-vivo/20261125")} now={() => FIXTURE_NOW} />
      </QueryClientProvider>,
    );
    const list = await screen.findByRole("list", { name: /Jogos de/ });
    const first = within(list).getAllByRole("listitem")[0];
    expect(first).toHaveTextContent(/Ao vivo/);
    expect(first).toHaveTextContent(/2º quarto · \d{1,2}:\d{2}/);
    expect(screen.getByText(/Atualizando a cada 15 s/)).toBeInTheDocument();

    const query = client.getQueryCache().find({ queryKey: ["scoreboard", "20261125"] });
    const interval = (query?.options as { refetchInterval: (q: unknown) => number | false }).refetchInterval;
    expect(interval(query)).toBe(LIVE_POLL_MS);
    act(() => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const paused = client.getQueryCache().find({ queryKey: ["scoreboard", "20261125"] });
    expect((paused?.options as { refetchInterval: (q: unknown) => number | false }).refetchInterval(paused)).toBe(false);
    expect(screen.getByText(/Atualização pausada com a aba em segundo plano/)).toBeInTheDocument();
    visibility = "visible";
  });
});

