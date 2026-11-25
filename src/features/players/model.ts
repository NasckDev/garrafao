import type { PlayerProfile, StatLine, TeamRef } from "../../../server/types";

export type PosGroup = "G" | "F" | "C";

export interface PlayerView {
  id: string;
  name: string;
  first: string;
  last: string;
  jersey: string | null;
  posAbbr: string | null;
  posGroup: PosGroup | null;
  posName: string | null;
  team: TeamRef | null;
  headshot: string | null;
  heightIn: number | null;
  weightLb: number | null;
  age: number | null;
  from: string | null;
  draft: string | null;
  stats: Partial<StatLine>;
  /** "season": médias completas da temporada; "summary": só o resumo do perfil; "none": sem médias publicadas. */
  statsKind: "season" | "summary" | "none";
  seasonLabel: string | null;
  featured: boolean;
}

const POS_NAME: Record<string, string> = {
  PG: "Armador",
  SG: "Ala-armador",
  G: "Armador",
  SF: "Ala",
  PF: "Ala-pivô",
  F: "Ala",
  C: "Pivô",
};

export function posGroup(abbr: string | null): PosGroup | null {
  // PG/SG/G -> G, SF/PF/F -> F, C -> C; posições duplas ("G-F") contam pela primeira.
  const main = (abbr ?? "").toUpperCase().split("-")[0];
  const letter = main[main.length - 1];
  return letter === "G" || letter === "F" || letter === "C" ? letter : null;
}

/** "2026-27 regular season stats" -> "2026-27". */
const seasonOf = (label: string | null) => /(\d{4}-\d{2})/.exec(label ?? "")?.[1] ?? null;

export function toView(profile: PlayerProfile, featured: boolean): PlayerView {
  const { athlete } = profile;
  const parts = athlete.name.split(" ");
  const season = profile.stats?.season ?? null;
  const summary = athlete.summary;
  const hasSummary = summary !== null && summary.pts !== null;
  const posAbbr = athlete.position?.abbr ?? null;
  return {
    id: athlete.id,
    name: athlete.name,
    first: athlete.first ?? parts.slice(0, -1).join(" "),
    last: athlete.last ?? parts[parts.length - 1],
    jersey: athlete.jersey,
    posAbbr,
    posGroup: posGroup(posAbbr),
    posName: posAbbr ? POS_NAME[posAbbr] ?? athlete.position?.name ?? null : null,
    team: athlete.team,
    headshot: athlete.headshot,
    heightIn: athlete.heightIn,
    weightLb: athlete.weightLb,
    age: athlete.age,
    from: athlete.college ?? athlete.birthPlace,
    draft: athlete.draft ? `${athlete.draft.year}, escolha ${athlete.draft.pick}` : null,
    // Nunca mistura temporadas: ou as médias completas da temporada, ou o resumo do perfil (mesma temporada), ou nada.
    stats: season ?? (hasSummary ? { pts: summary.pts, reb: summary.reb, ast: summary.ast, fg: summary.fg } : {}),
    statsKind: season ? "season" : hasSummary ? "summary" : "none",
    seasonLabel: seasonOf(summary?.label ?? null),
    featured,
  };
}

/** Lista com favoritos primeiro (na ordem em que foram marcados), depois o resto na ordem original. */
export function favoritesFirst<T extends { id: string }>(items: readonly T[], favorites: readonly string[]): T[] {
  const rank = new Map(favorites.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

export type StatKey = keyof StatLine;

/** Posição no ranking entre os destaques: "2º de 25 em destaque". */
export function rankText(player: PlayerView, pool: readonly PlayerView[], key: StatKey): string {
  const value = player.stats[key];
  if (!player.featured || value === null || value === undefined) return "";
  const ranked = pool.filter((p) => p.featured && typeof p.stats[key] === "number");
  const above = ranked.filter((p) => (p.stats[key] as number) > value).length;
  return `${above + 1}º de ${ranked.length} em destaque`;
}

/** Eixos do radar: [rótulo, leitura, piso, teto]. O piso evita que todo mundo pareça igual. */
export const AXES: [string, (s: Partial<StatLine>) => number | null | undefined, number, number][] = [
  ["Pontos", (s) => s.pts, 8, 34],
  ["Rebotes", (s) => s.reb, 2, 13],
  ["Assistências", (s) => s.ast, 1.5, 12],
  ["Defesa", (s) => (s.stl == null || s.blk == null ? null : s.stl + s.blk), 0.6, 4.8],
  ["Três pontos", (s) => s.tp, 20, 44],
  ["Aproveitamento", (s) => s.fg, 40, 61],
];

export const radarValues = (stats: Partial<StatLine> | null) =>
  AXES.map(([, get, lo, hi]) => {
    const v = stats ? get(stats) : null;
    return v == null ? 0.05 : Math.max(0.1, Math.min(1, (v - lo) / (hi - lo)));
  });

export const DUEL: [string, (s: Partial<StatLine>) => number | null | undefined, string][] = [
  ["De quadra", (s) => s.fg, "%"],
  ["De três", (s) => s.tp, "%"],
  ["Lance livre", (s) => s.ft, "%"],
  ["Pontos", (s) => s.pts, ""],
  ["Rebotes", (s) => s.reb, ""],
  ["Assistências", (s) => s.ast, ""],
  ["Roubos e tocos", (s) => (s.stl == null || s.blk == null ? null : s.stl + s.blk), ""],
];

export interface DuelRow {
  label: string;
  a: number | null;
  b: number | null;
  unit: string;
  winner: "a" | "b" | null;
}

export function duel(a: Partial<StatLine>, b: Partial<StatLine>) {
  const rows: DuelRow[] = DUEL.map(([label, get, unit]) => {
    const va = get(a) ?? null;
    const vb = get(b) ?? null;
    const winner = va !== null && (vb === null || va > vb) ? "a" : vb !== null && (va === null || vb > va) ? "b" : null;
    return { label, a: va, b: vb, unit, winner };
  });
  return { rows, winsA: rows.filter((r) => r.winner === "a").length, winsB: rows.filter((r) => r.winner === "b").length };
}

export const LEAD: { key: StatKey; label: string; unit: string }[] = [
  { key: "pts", label: "Pontos", unit: "" },
  { key: "reb", label: "Rebotes", unit: "" },
  { key: "ast", label: "Assist.", unit: "" },
  { key: "stl", label: "Roubos", unit: "" },
  { key: "blk", label: "Tocos", unit: "" },
  { key: "tp", label: "De três", unit: "%" },
];
