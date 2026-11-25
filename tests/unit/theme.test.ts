import { describe, expect, it } from "vitest";
import type { TeamRef } from "../../server/types";
import { contrast, inkOn, mix, pickAccent, readableOn, themeVars } from "../../src/lib/color";
import { canonicalAbbr, swatch, teamPalette } from "../../src/lib/teams";
import { normalizeTeams } from "../../server/normalize/athlete";
import { fixtureJson } from "../support/fixture-fetch";

const TEAMS = normalizeTeams(fixtureJson("teams.json"));

describe("contraste (WCAG)", () => {
  it("valores de referência", () => {
    expect(contrast("#FFFFFF", "#000000")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
    expect(contrast("#ABCDEF", "#ABCDEF")).toBe(1);
  });

  it("tinta escolhida é a de maior contraste", () => {
    expect(inkOn("#FFC72C")).toBe("#12151A");
    expect(inkOn("#1D428A")).toBe("#FFFFFF");
  });

  it("mix nas pontas devolve as cores de origem", () => {
    expect(mix("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mix("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
  });

  it("readableOn sempre chega a 4,5:1", () => {
    for (const [color, bg] of [["#FFC72C", "#FFFFFF"], ["#1D1160", "#151A22"], ["#C4CED4", "#F6F8FB"]]) {
      expect(contrast(readableOn(color, bg), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("pickAccent prefere a cor viva do time quando ela passa de 3:1", () => {
    expect(pickAccent({ primary: "#1D428A", secondary: "#FFC72C" }, "#FFFFFF")).toBe("#1D428A");
    expect(pickAccent({ primary: "#1D428A", secondary: "#FFC72C" }, "#151A22")).toBe("#FFC72C");
  });
});

describe("tema do time", () => {
  it.each([false, true])("todos os 30 times atingem AA no modo %s (escuro?)", (dark) => {
    for (const team of TEAMS) {
      const vars = themeVars(teamPalette(team), dark);
      const label = `${team.abbr} ${dark ? "escuro" : "claro"}`;
      expect(contrast(vars["--ink"], vars["--bg"]), label).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--ink"], vars["--surface"]), label).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--muted"], vars["--bg"]), label).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--muted"], vars["--surface"]), label).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--accent-text"], vars["--surface"]), label).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--accent-text"], vars["--bg"]), label).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--accent"], vars["--surface"]), label).toBeGreaterThanOrEqual(3);
      expect(contrast(vars["--accent-ink"], vars["--accent"]), label).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("amostra de camisa (número sobre a cor do time) tem ao menos 3:1, como texto grande", () => {
    for (const team of TEAMS) {
      const { background, color } = swatch(teamPalette(team));
      expect(contrast(color, background), team.abbr).toBeGreaterThanOrEqual(3);
    }
  });

  it("siglas curtas da ESPN viram as canônicas e acham as cores de marca", () => {
    expect(canonicalAbbr("GS")).toBe("GSW");
    expect(canonicalAbbr("UTAH")).toBe("UTA");
    const warriors = TEAMS.find((t) => t.abbr === "GS") as TeamRef;
    expect(teamPalette(warriors)).toMatchObject({ abbr: "GSW", primary: "#1D428A", secondary: "#FFC72C" });
  });

  it("time desconhecido usa as cores publicadas pela fonte; sem time, paleta neutra estável", () => {
    const custom: TeamRef = { id: "99", abbr: "XYZ", name: "Time X", shortName: "X", logo: null, color: "123456", altColor: "abcdef", tbd: false };
    expect(teamPalette(custom)).toMatchObject({ primary: "#123456", secondary: "#ABCDEF" });
    expect(teamPalette(null, "Fulano")).toEqual(teamPalette(null, "Fulano"));
  });
});
