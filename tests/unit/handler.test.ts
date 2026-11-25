// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fetchJson, OriginError, type FetchLike } from "../../server/fetch-json";
import { createNbaHandler, MESSAGES } from "../../server/handler";
import { OPERATIONS } from "../../server/ops";
import { fixtureFetch, fixtureFor, FIXTURE_NOW } from "../support/fixture-fetch";

interface Captured {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

async function call(qs: string, fetcher: FetchLike = fixtureFetch, method = "GET") {
  const log = vi.fn();
  const handler = createNbaHandler({ fetch: fetcher, now: () => FIXTURE_NOW, log });
  const out: Captured = { status: 0, headers: {}, body: undefined };
  const response = {
    setHeader: (name: string, value: string) => {
      out.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      out.status = code;
      return response;
    },
    json(body: unknown) {
      out.body = body;
    },
  };
  await handler({ method, url: `/api/nba?${qs}` }, response);
  return { ...out, log };
}

const respond = (status: number, body: unknown = {}) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });

describe("lista fechada de operações", () => {
  it("expõe exatamente as operações documentadas", () => {
    expect(Object.keys(OPERATIONS).sort()).toEqual(
      ["athlete", "draft", "events", "news", "overview", "players", "roster", "scoreboard", "search", "season", "standings", "summary", "teams"].sort(),
    );
  });

  it.each(["", "op=", "op=__proto__", "op=constructor", "op=toString", "op=fetch", "op=http://evil.test"])("recusa operação desconhecida: %s", async (qs) => {
    const res = await call(qs);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MESSAGES.unknownOp });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("recusa parâmetro extra (inclusive tentativa de passar URL)", async () => {
    const res = await call("op=standings&url=https://evil.test/x");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MESSAGES.unknownParam });
  });

  it("só GET e HEAD", async () => {
    const res = await call("op=standings", fixtureFetch, "POST");
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("GET, HEAD");
  });

  it("manda nosniff em toda resposta", async () => {
    expect((await call("op=standings")).headers["x-content-type-options"]).toBe("nosniff");
    expect((await call("op=nada")).headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("validação de parâmetros", () => {
  it.each([
    ["op=scoreboard", "Parâmetro obrigatório ausente: date"],
    ["op=scoreboard&date=2026-11-24", "Data inválida: use o formato AAAAMMDD"],
    ["op=scoreboard&date=20260230", "Data inválida: dia inexistente"],
    ["op=scoreboard&date=19991231", "Data fora do intervalo disponível"],
    ["op=scoreboard&date=20301231", "Data fora do intervalo disponível"],
    ["op=summary&event=abc", "Identificador inválido: event"],
    ["op=summary&event=0123", "Identificador inválido: event"],
    ["op=athlete&id=1234567890123", "Identificador inválido: id"],
    ["op=roster&team=100", "Time inválido"],
    ["op=season&year=1990", "Ano fora do intervalo disponível"],
    ["op=season&year=20x7", "Ano inválido"],
    ["op=search&q=a", "A busca precisa de pelo menos 2 letras"],
    [`op=search&q=${"a".repeat(41)}`, "A busca aceita no máximo 40 caracteres"],
    ["op=search&q=%3Cscript%3E", "A busca aceita só letras, números, espaço, ponto, hífen e apóstrofo"],
    [`op=players&ids=${Array.from({ length: 31 }, (_, i) => i + 1).join(",")}`, "No máximo 30 identificadores por chamada"],
    ["op=players&ids=1,,2", "Identificador inválido: ids"],
  ])("%s -> 400", async (qs, message) => {
    const fetcher = vi.fn(fixtureFetch);
    const res = await call(qs, fetcher);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: message });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("aceita acentos e apóstrofo na busca", async () => {
    const fetcher = vi.fn<FetchLike>(async () => respond(200, { items: [] }));
    const res = await call(`op=search&q=${encodeURIComponent("Jokić D'Angelo")}`, fetcher);
    expect(res.status).toBe(200);
    expect(fetcher.mock.calls[0][0]).toContain("query=Joki%C4%87%20D'Angelo");
  });
});

describe("origem: timeout, erro e SSRF", () => {
  it("erro da origem vira 502 com mensagem genérica, sem vazar status nem URL", async () => {
    const res = await call("op=standings", async () => respond(500, { secret: "stack trace" }));
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: MESSAGES.origin });
    expect(JSON.stringify(res.body)).not.toMatch(/500|espn|stack/i);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.log).toHaveBeenCalledWith("[api/nba] op=standings origin failure: status 500");
  });

  it("falha de rede vira 502", async () => {
    const res = await call("op=news", async () => {
      throw new TypeError("fetch failed");
    });
    expect(res.status).toBe(502);
  });

  it("origem que não responde estoura o timeout e vira 502", async () => {
    vi.useFakeTimers();
    const hanging: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    const pending = call("op=teams", hanging);
    await vi.advanceTimersByTimeAsync(6_000);
    const res = await pending;
    vi.useRealTimers();
    expect(res.status).toBe(502);
    expect(res.log).toHaveBeenCalledWith("[api/nba] op=teams origin failure: timeout");
  });

  it("resposta com formato inesperado vira 502", async () => {
    const res = await call("op=standings", async () => respond(200, { children: [] }));
    expect(res.status).toBe(502);
  });

  it("id inexistente na origem vira 404 com cache curto", async () => {
    const res = await call("op=athlete&id=999999999", async () => respond(404));
    expect(res.status).toBe(404);
    expect(res.headers["cache-control"]).toBe("public, max-age=0, s-maxage=60");
  });

  it("fetchJson só fala com os hosts da ESPN", async () => {
    const fetcher = vi.fn(fixtureFetch);
    await expect(fetchJson(fetcher, "https://evil.test/x")).rejects.toBeInstanceOf(OriginError);
    await expect(fetchJson(fetcher, "http://169.254.169.254/latest/meta-data")).rejects.toMatchObject({ reason: "host" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("recusa resposta declarada grande demais", async () => {
    const big = { ok: true, status: 200, headers: { get: () => String(10 * 1024 * 1024) }, json: async () => ({}) };
    await expect(fetchJson(async () => big, "https://site.api.espn.com/x")).rejects.toMatchObject({ reason: "payload" });
  });
});

describe("cache por tipo de dado", () => {
  const cache = async (qs: string, fetcher: FetchLike = fixtureFetch) => (await call(qs, fetcher)).headers["cache-control"];

  it("placar de dia passado encerrado: 1 h na CDN", async () => {
    expect(await cache("op=scoreboard&date=20261124")).toBe("public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  });

  it("placar de hoje sem jogo ao vivo: 60 s", async () => {
    expect(await cache("op=scoreboard&date=20261125")).toBe("public, max-age=0, s-maxage=60, stale-while-revalidate=120");
  });

  it("placar com jogo ao vivo: 15 s com stale-while-revalidate", async () => {
    const raw = fixtureFor("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20261125") as { events: Record<string, unknown>[] };
    raw.events[0].status = { period: 2, displayClock: "3:10", type: { name: "STATUS_IN_PROGRESS", state: "in" } };
    const res = await call("op=scoreboard&date=20261125", async () => respond(200, raw));
    expect((res.body as { hasLive: boolean }).hasLive).toBe(true);
    expect(res.headers["cache-control"]).toBe("public, max-age=0, s-maxage=15, stale-while-revalidate=30");
  });

  it.each([
    ["op=standings", 300],
    ["op=news", 600],
    ["op=teams", 86400],
    ["op=roster&team=25", 3600],
    ["op=athlete&id=4278073", 3600],
    ["op=overview&id=4278073", 900],
    ["op=search&q=curry", 3600],
    ["op=season&year=2027", 86400],
    ["op=draft&year=2026", 86400],
    ["op=draft&year=2027", 3600],
    ["op=summary&event=401909314", 3600],
    ["op=summary&event=401909317", 300],
    ["op=events&season=2027", 21600],
  ])("%s -> s-maxage=%i", async (qs, seconds) => {
    expect(await cache(qs)).toContain(`s-maxage=${seconds},`);
  });

  it("lote de jogadores com falha parcial: devolve o que veio e cacheia pouco", async () => {
    const res = await call("op=players&ids=4278073,123456789");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ missing: ["123456789"] });
    expect(res.headers["cache-control"]).toContain("s-maxage=300,");
  });
});
