import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Game } from "../../server/types";
import { normalizeScoreboard } from "../../server/normalize/game";
import {
  dayKey,
  formatDayLong,
  formatGameWhen,
  formatTime,
  formatWinPct,
  gameDayKey,
  gameStatusText,
  heightM,
  periodName,
  seasonYearAt,
  shiftDay,
  weightKg,
} from "../../src/lib/format";
import { LIVE_POLL_MS, liveRefetchInterval, usePageVisible } from "../../src/lib/polling";
import { buildHash, parseHash } from "../../src/lib/router";
import { DEFAULTS, getPersisted, migrate, resetPersistedCache, SCHEMA_VERSION, STORAGE_KEY, toggleFavorite } from "../../src/lib/storage";
import { favoritesFirst, posGroup } from "../../src/features/players/model";
import { fixtureJson } from "../support/fixture-fetch";

const games = normalizeScoreboard(fixtureJson("scoreboard-20261125.json"), "20261125").games;
const finals = normalizeScoreboard(fixtureJson("scoreboard-20261124.json"), "20261124").games;

describe("datas e horas em pt-BR, fuso de Brasília", () => {
  it("jogo das 17h de Nova York aparece às 19h em Brasília", () => {
    expect(games[0].date).toBe("2026-11-25T22:00Z");
    expect(formatTime(games[0].date)).toBe("19:00");
    expect(gameStatusText(games[0])).toBe("19:00");
  });

  it("jogo da noite nos EUA cai no dia seguinte em Brasília, mas pertence à rodada do dia da liga", () => {
    const late = games[games.length - 1];
    expect(late.date).toBe("2026-11-26T03:00Z");
    expect(formatGameWhen(late)).toBe("qui., 26/11/2026, 00:00");
    expect(gameDayKey(late)).toBe("20261125");
  });

  it("sem horário definido pela fonte, mostra só o dia (no fuso da liga) e não inventa hora", () => {
    const tbd = { date: "2026-12-11T05:00Z", timeValid: false };
    expect(formatGameWhen(tbd)).toBe("sex., 11/12, horário a definir");
    expect(gameStatusText({ ...games[0], ...tbd })).toBe("Horário a definir");
  });

  it("status ao vivo, intervalo, prorrogação e final", () => {
    const base = finals[0];
    const live: Game = { ...base, state: "in", status: "live", period: 3, clock: "5:32" };
    expect(gameStatusText(live)).toBe("3º quarto · 5:32");
    expect(gameStatusText({ ...live, status: "halftime" })).toBe("Intervalo");
    expect(gameStatusText({ ...live, status: "end-period", period: 1 })).toBe("Fim do 1º quarto");
    expect(gameStatusText({ ...live, period: 6, clock: "1:00" })).toBe("2ª prorrogação · 1:00");
    expect(gameStatusText(base)).toBe("Final");
    expect(gameStatusText({ ...base, period: 5 })).toBe("Final, com prorrogação");
    expect(periodName(5)).toBe("Prorrogação");
    expect(gameStatusText({ ...live, period: 2, clock: "53.5" })).toBe("2º quarto · 53,5 s");
  });

  it("dia da liga, aritmética de calendário e rótulos", () => {
    expect(dayKey(new Date("2026-11-26T03:30:00Z"))).toBe("20261125");
    expect(shiftDay("20261231", 1)).toBe("20270101");
    expect(shiftDay("20240301", -1)).toBe("20240229");
    expect(formatDayLong("20261124")).toBe("terça-feira, 24 de novembro de 2026");
    expect(seasonYearAt(new Date("2026-11-25T20:00:00Z"))).toBe(2027);
    expect(seasonYearAt(new Date("2027-05-10T20:00:00Z"))).toBe(2027);
  });

  it("números e medidas", () => {
    expect(formatWinPct(14 / 18)).toBe(",778");
    expect(formatWinPct(1)).toBe("1,000");
    expect(heightM(78)).toBe("1,98 m");
    expect(weightKg(195)).toBe("88 kg");
  });
});

describe("polling do placar", () => {
  it("só liga com jogo ao vivo E aba visível", () => {
    expect(liveRefetchInterval(true, true)).toBe(LIVE_POLL_MS);
    expect(liveRefetchInterval(true, false)).toBe(false);
    expect(liveRefetchInterval(false, true)).toBe(false);
    expect(liveRefetchInterval(undefined, true)).toBe(false);
  });

  it("acompanha a visibilidade da aba", () => {
    let state: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    const { result } = renderHook(() => usePageVisible());
    expect(result.current).toBe(true);
    act(() => {
      state = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(false);
  });
});

describe("rotas por hash", () => {
  it("lê aba, parâmetro e query; aba desconhecida cai em jogadores", () => {
    expect(parseHash("#/ao-vivo/20261124?jogo=401909314")).toMatchObject({ tab: "ao-vivo", param: "20261124" });
    expect(parseHash("#/ao-vivo/20261124?jogo=401909314").query.get("jogo")).toBe("401909314");
    expect(parseHash("#/qualquer")).toMatchObject({ tab: "jogadores", param: null });
    expect(parseHash("")).toMatchObject({ tab: "jogadores" });
  });

  it("monta hash sem parâmetros vazios", () => {
    expect(buildHash("jogadores", "3975", { vs: null })).toBe("#/jogadores/3975");
    expect(buildHash("ao-vivo", null, { jogo: "1" })).toBe("#/ao-vivo?jogo=1");
  });
});

describe("persistência local com versão de esquema", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetPersistedCache();
  });

  it("dado corrompido, versão desconhecida ou ids inválidos voltam ao padrão", () => {
    expect(migrate("lixo")).toEqual(DEFAULTS);
    expect(migrate({ version: 99, favorites: { players: ["1"] } })).toEqual(DEFAULTS);
    expect(migrate({ version: SCHEMA_VERSION, favorites: { players: ["3975", "x", "3975", 7, "<script>"] }, theme: "neon" })).toEqual({
      version: SCHEMA_VERSION,
      favorites: { players: ["3975"], teams: [] },
      theme: "dark",
    });
    window.localStorage.setItem(STORAGE_KEY, "{quebrado");
    expect(getPersisted()).toEqual(DEFAULTS);
  });

  it("favoritar grava com a versão e desfavoritar remove", () => {
    toggleFavorite("players", "3975");
    toggleFavorite("teams", "25");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      version: SCHEMA_VERSION,
      favorites: { players: ["3975"], teams: ["25"] },
      theme: "dark",
    });
    toggleFavorite("players", "3975");
    expect(getPersisted().favorites.players).toEqual([]);
  });

  it("primeira visita abre no tema escuro; tema escolhido e salvo é respeitado", () => {
    expect(getPersisted().theme).toBe("dark");
    for (const saved of ["light", "system", "dark"] as const) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, favorites: { players: [], teams: [] }, theme: saved }));
      resetPersistedCache();
      expect(getPersisted().theme).toBe(saved);
    }
  });

  it("ignora id inválido", () => {
    toggleFavorite("players", "../x");
    expect(getPersisted().favorites.players).toEqual([]);
  });
});

describe("modelo de jogadores", () => {
  it("agrupa posições", () => {
    expect(["PG", "SG", "G", "SF", "PF", "F", "C", "G-F", "X"].map(posGroup)).toEqual(["G", "G", "G", "F", "F", "F", "C", "G", null]);
  });

  it("favoritos primeiro, na ordem marcada, resto na ordem original", () => {
    const list = ["a", "b", "c", "d"].map((id) => ({ id }));
    expect(favoritesFirst(list, ["d", "b"]).map((x) => x.id)).toEqual(["d", "b", "a", "c"]);
  });
});
