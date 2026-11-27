// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeAthlete, normalizeOverview, normalizeRoster, normalizeSearch, normalizeTeams, parseDraft, parseHeight } from "../../server/normalize/athlete";
import { normalizeGame, normalizeGameList, normalizeScoreboard, normalizeTeamRef } from "../../server/normalize/game";
import { normalizeNews } from "../../server/normalize/news";
import { buildAward, findFinals, normalizeLeaders, parseAwardRefs } from "../../server/normalize/awards";
import { buildSeasonEvents, normalizeDraft, normalizeSeason, seasonMonths } from "../../server/normalize/season";
import { normalizeStandings } from "../../server/normalize/standings";
import { normalizeSummary } from "../../server/normalize/summary";
import type { SeasonInfo } from "../../server/types";
import { FEATURED_IDS } from "../../src/config/featured";
import { fixtureJson } from "../support/fixture-fetch";

describe("placar (scoreboard)", () => {
  it("normaliza jogos finalizados com parciais por quarto, vencedor e nota da NBA Cup", () => {
    const board = normalizeScoreboard(fixtureJson("scoreboard-20261124.json"), "20261124");
    expect(board.games).toHaveLength(3);
    expect(board.hasLive).toBe(false);
    const det = board.games[0];
    expect(det).toMatchObject({ id: "401909314", state: "post", status: "final", kind: "cup", note: "NBA Cup - Group Play", timeValid: true });
    expect(det.away).toMatchObject({ score: 104, winner: true, linescores: [16, 32, 25, 31] });
    expect(det.away.team).toMatchObject({ abbr: "DET", name: "Detroit Pistons", tbd: false });
    expect(det.home).toMatchObject({ score: 86, winner: false, linescores: [22, 14, 25, 25] });
    expect(det.away.linescores.reduce((a, b) => a + b, 0)).toBe(det.away.score);
  });

  it("normaliza jogos agendados sem relógio e ordenados pelo horário", () => {
    const board = normalizeScoreboard(fixtureJson("scoreboard-20261125.json"), "20261125");
    expect(board.games.length).toBe(9);
    expect(board.games.every((g) => g.state === "pre" && g.status === "scheduled" && g.clock === null)).toBe(true);
    const dates = board.games.map((g) => g.date);
    expect([...dates].sort()).toEqual(dates);
    expect(board.games[0].home.record).toBe("14-4");
  });

  it("dia sem jogos vira lista vazia (estado vazio real, gravado no feriado de Ação de Graças)", () => {
    expect(normalizeScoreboard(fixtureJson("scoreboard-20261126.json"), "20261126")).toEqual({ date: "20261126", games: [], hasLive: false });
  });

  it("vaga de mata-mata sem time vira TBD e horário a definir", () => {
    const month = normalizeGameList(fixtureJson("month-202612.json"));
    const final = month.find((g) => g.note === "NBA Cup Championship");
    expect(final).toBeDefined();
    expect(final?.timeValid).toBe(false);
    expect(final?.home.team.tbd).toBe(true);
    expect(final?.kind).toBe("cup");
  });

  it("descarta evento sem os dois times e tolera lixo", () => {
    expect(normalizeGame({ id: "1", competitions: [{ competitors: [] }] })).toBeNull();
    expect(normalizeGame(null)).toBeNull();
    expect(normalizeScoreboard("nada", "20261124").games).toEqual([]);
  });

  it("reconhece estados de jogo ao vivo, intervalo e prorrogação", () => {
    const base = structuredClone((fixtureJson("scoreboard-20261124.json") as { events: unknown[] }).events[0]) as Record<string, unknown>;
    const live = normalizeGame({ ...base, status: { period: 3, displayClock: "5:32", type: { name: "STATUS_IN_PROGRESS", state: "in" } } });
    expect(live).toMatchObject({ state: "in", status: "live", period: 3, clock: "5:32" });
    const half = normalizeGame({ ...base, status: { period: 2, displayClock: "0.0", type: { name: "STATUS_HALFTIME", state: "in" } } });
    expect(half?.status).toBe("halftime");
    const ot = normalizeGame({ ...base, status: { period: 5, type: { name: "STATUS_FINAL", state: "post" } } });
    expect(ot).toMatchObject({ status: "final", period: 5, clock: null });
  });

  it("team ref aceita logo em lista e rejeita cor inválida", () => {
    expect(normalizeTeamRef({ id: "1", abbreviation: "atl", displayName: "Atlanta Hawks", color: "zzz", logos: [{ href: "https://x.test/a.png", rel: ["default"] }] })).toMatchObject({
      abbr: "ATL",
      color: null,
      logo: "https://x.test/a.png",
    });
    expect(normalizeTeamRef({ id: "-1", abbreviation: "TBD" }).tbd).toBe(true);
  });
});

describe("resumo do jogo (summary)", () => {
  it("traz placar, líderes por time, público e local", () => {
    const detail = normalizeSummary(fixtureJson("summary-401909314.json"));
    expect(detail?.game).toMatchObject({ id: "401909314", state: "post", venue: "Kia Center" });
    expect(detail?.attendance).toBe(19352);
    expect(detail?.leaders.map((l) => l.teamAbbr)).toEqual(["ORL", "DET"]);
    expect(detail?.leaders[0].leaders[0]).toMatchObject({ category: "points", value: "21", name: "Desmond Bane", athleteId: "4066320" });
    expect(detail?.game.home.linescores).toEqual([22, 14, 25, 25]);
  });

  it("antes do jogo os líderes são da temporada (pontos por jogo)", () => {
    const detail = normalizeSummary(fixtureJson("summary-401909317.json"));
    expect(detail?.game.state).toBe("pre");
    expect(detail?.leaders[0].leaders.map((l) => l.category)).toContain("pointsPerGame");
  });
});

describe("classificação (standings)", () => {
  const standings = normalizeStandings(fixtureJson("standings.json"));

  it("separa Leste e Oeste, com 15 times cada, ordenados pela posição", () => {
    expect(standings.season).toBe("2026-27");
    expect(standings.conferences.map((c) => c.id)).toEqual(["east", "west"]);
    for (const conference of standings.conferences) {
      expect(conference.teams).toHaveLength(15);
      expect(conference.teams.map((t) => t.seed)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    }
  });

  it("líder tem 0 jogo atrás (a fonte publica '-') e números coerentes", () => {
    const leader = standings.conferences[0].teams[0];
    expect(leader).toMatchObject({ gamesBehind: 0, team: { abbr: "PHI" }, wins: 14, losses: 4, streak: "L1", lastTen: "7-3" });
    expect(leader.pct).toBeCloseTo(14 / 18, 3);
  });
});

describe("notícias", () => {
  it("só aceita links http(s), sem duplicatas", () => {
    const news = normalizeNews(fixtureJson("news.json"));
    expect(news.length).toBeGreaterThan(5);
    expect(news.every((n) => n.url.startsWith("https://"))).toBe(true);
    expect(new Set(news.map((n) => n.url)).size).toBe(news.length);
    const hostile = normalizeNews({ articles: [{ headline: "x", links: { web: { href: "javascript:alert(1)" } } }] });
    expect(hostile).toEqual([]);
  });
});

describe("atleta", () => {
  it("perfil com time, medidas, draft e resumo da temporada", () => {
    const athlete = normalizeAthlete(fixtureJson("athlete-4278073.json"));
    expect(athlete).toMatchObject({
      id: "4278073",
      name: "Shai Gilgeous-Alexander",
      jersey: "2",
      position: { abbr: "G" },
      team: { abbr: "OKC" },
      heightIn: 78,
      weightLb: 195,
      college: "Kentucky",
      draft: { year: 2018, round: 1, pick: 11 },
    });
    expect(athlete?.summary?.label).toBe("2026-27 regular season stats");
  });

  it("overview separa temporada regular e carreira pelos nomes estáveis das colunas", () => {
    const stats = normalizeOverview(fixtureJson("overview-4278073.json"));
    expect(stats?.season).toMatchObject({ gp: 17, pts: 32.1, reb: 4.1, ast: 4.6, stl: 0.8, blk: 0.9, fg: 47.9, tp: 37.5, ft: 82.4 });
    expect(stats?.career?.gp).toBe(547);
  });

  it("parsers de altura e draft", () => {
    expect(parseHeight("6' 11\"")).toBe(83);
    expect(parseHeight("")).toBeNull();
    expect(parseDraft("2003: Rd 1, Pk 1 (CLE)")).toEqual({ year: 2003, round: 1, pick: 1 });
    expect(parseDraft("Undrafted")).toBeNull();
  });

  it("todos os 25 destaques gravados normalizam com médias da temporada", () => {
    const manifest = Object.values((fixtureJson("../manifest.json") as { entries: Record<string, { file: string }> }).entries).map((e) => e.file);
    const athletes = FEATURED_IDS.map((id) => `athlete-${id}.json`);
    expect(athletes).toHaveLength(25);
    expect(athletes.every((file) => manifest.includes(file))).toBe(true);
    for (const file of athletes) {
      expect(normalizeAthlete(fixtureJson(file))?.name).toBeTruthy();
      expect(normalizeOverview(fixtureJson(file.replace("athlete-", "overview-")))?.season?.pts).toEqual(expect.any(Number));
    }
  });

  it("busca filtra jogadores da NBA", () => {
    expect(normalizeSearch(fixtureJson("search-curry.json"))[0]).toMatchObject({ id: "3975", name: "Stephen Curry", teamAbbr: "GS" });
  });

  it("elenco e times", () => {
    const roster = normalizeRoster(fixtureJson("roster-25.json"));
    expect(roster?.team.abbr).toBe("OKC");
    expect(roster?.players.length).toBeGreaterThan(12);
    const teams = normalizeTeams(fixtureJson("teams.json"));
    expect(teams).toHaveLength(30);
    expect(teams.every((t) => t.color === null || /^[0-9a-f]{6}$/.test(t.color))).toBe(true);
  });
});

describe("temporada, draft e eventos", () => {
  const season = normalizeSeason(fixtureJson("season-2027.json")) as SeasonInfo;

  it("fases da temporada em ordem cronológica, com nomes em português", () => {
    expect(season).toMatchObject({ year: 2027, label: "2026-27" });
    expect(season.phases.map((p) => p.slug)).toEqual(["preseason", "regular", "playin", "playoffs", "offseason"]);
    expect(season.phases[1]).toMatchObject({ name: "Temporada regular", start: "2026-10-20T07:00Z", end: "2027-04-12T06:59Z" });
  });

  it("meses do calendário cobrem do início ao fim da temporada", () => {
    expect(seasonMonths(season)).toEqual(["202609", "202610", "202611", "202612", "202701", "202702", "202703", "202704", "202705", "202706"]);
  });

  it("draft encerrado traz as 60 escolhas com time e atleta; draft agendado traz a data da API core", () => {
    const done = normalizeDraft(fixtureJson("draft-core-2026.json"), fixtureJson("draft-site-2026.json"));
    expect(done).toMatchObject({ year: 2026, state: "post", statusText: "Encerrado", rounds: 2 });
    expect(done?.picks).toHaveLength(60);
    expect(done?.picks[0]).toMatchObject({ overall: 1, team: { abbr: "WSH" }, athlete: { name: "AJ Dybantsa", position: "F", from: "BYU" } });
    const next = normalizeDraft(fixtureJson("draft-core-2027.json"), fixtureJson("draft-site-2027.json"));
    expect(next).toMatchObject({ year: 2027, state: "pre", statusText: "Agendado", start: "2027-06-25T00:00Z", picks: [] });
  });

  it("sem a parte do site, o draft fica só com os dados da core (sem inventar escolhas)", () => {
    expect(normalizeDraft(fixtureJson("draft-core-2027.json"), null)).toMatchObject({ statusText: null, state: null, picks: [] });
  });

  it("eventos: NBA Cup pelas notas dos jogos, All-Star vazio quando a fonte não publicou, falhas parciais listadas", () => {
    const months = seasonMonths(season).map((month) => ({ month, games: month === "202703" ? null : normalizeGameList(fixtureJson(`month-${month}.json`)) }));
    const events = buildSeasonEvents({ season, cupTournament: fixtureJson("cup-tournament.json"), cupSeason: fixtureJson("cup-season-2027.json"), months });
    expect(events.cup.name).toBe("NBA Cup");
    expect(events.cup.rounds).toBe(3);
    expect(events.cup.group?.count).toBe(60);
    expect(events.cup.knockout.map((e) => e.stage)).toEqual(["quarterfinal", "quarterfinal", "quarterfinal", "quarterfinal", "semifinal", "final"]);
    expect(events.allStar).toEqual([]);
    expect(events.months.failed).toEqual(["202703"]);
    expect(events.months.scanned).toHaveLength(9);
  });
});

describe("prêmios, campeão e líderes", () => {
  it("prêmio da core: só referências ao atleta e ao time, lidas pelos ids", () => {
    expect(parseAwardRefs(fixtureJson("award-2026-35.json"))).toEqual({ sourceName: "Rookie of the Year", winners: [{ athleteId: "5041939", teamId: "6" }] });
    expect(parseAwardRefs({ winners: [] })).toBeNull();
    expect(parseAwardRefs({ id: "1", winners: [{ athlete: { $ref: "https://evil.test/x" } }] })).toEqual({ sourceName: null, winners: [] });
  });

  it("monta o prêmio com atleta e time resolvidos; vencedor sem nome resolvido não vira prêmio", () => {
    const refs = parseAwardRefs(fixtureJson("award-2026-35.json"));
    if (!refs) throw new Error("fixture");
    const teams = new Map(normalizeTeams(fixtureJson("teams.json")).map((team) => [team.id, team]));
    const flagg = { id: "5041939", name: "Cooper Flagg", headshot: null, position: "F" };
    expect(buildAward({ key: "roy", name: "Calouro do ano" }, refs, new Map([[flagg.id, flagg]]), teams)).toMatchObject({
      key: "roy",
      sourceName: "Rookie of the Year",
      winners: [{ athlete: { name: "Cooper Flagg" }, team: { abbr: "DAL" } }],
    });
    expect(buildAward({ key: "roy", name: "Calouro do ano" }, refs, new Map(), teams)).toBeNull();
  });

  it("campeão contado pelas vitórias nos jogos \"NBA Finals\" (Knicks 4 x 1 Spurs em 2026)", () => {
    const games = ["202605", "202606"].flatMap((month) => normalizeGameList(fixtureJson(`month-${month}.json`)));
    const finals = findFinals(games);
    expect(finals).toMatchObject({ champion: { abbr: "NY" }, runnerUp: { abbr: "SA" }, wins: 4, losses: 1 });
    expect(finals?.decidedAt.startsWith("2026-06-14")).toBe(true);
  });

  it("sem time com 4 vitórias na final não há campeão (série em andamento ou fora dos meses lidos)", () => {
    const games = normalizeGameList(fixtureJson("month-202606.json")).filter((game) => !/Game 5/.test(game.note ?? ""));
    expect(findFinals(games)).toBeNull();
    expect(findFinals([])).toBeNull();
  });

  it("líderes: só as categorias escolhidas, 3 por categoria, com atleta e time já resolvidos", () => {
    const leaders = normalizeLeaders(fixtureJson("leaders-2027.json"));
    expect(leaders).toMatchObject({ year: 2027, label: "2026-27" });
    expect(leaders?.categories.map((category) => category.key)).toEqual(["pts", "reb", "ast", "stl", "blk", "3pm"]);
    expect(leaders?.categories[0].leaders).toHaveLength(3);
    expect(leaders?.categories[0].leaders[0]).toMatchObject({ athlete: { id: "3945274", name: "Luka Doncic", position: "G" }, team: { abbr: "LAL" } });
    expect(leaders?.categories[0].leaders[0].value).toBeCloseTo(36.6, 1);
    expect(normalizeLeaders({ leaders: {} })).toBeNull();
  });
});
