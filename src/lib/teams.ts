import type { TeamRef } from "../../server/types";
import { contrast, inkOn, isHex } from "./color";

/**
 * Cores de marca dos times (as mesmas do protótipo). Têm prioridade sobre as cores que a ESPN publica,
 * que às vezes trazem variações de uniforme; servem também quando a fonte não informa cor.
 */
const TEAMS: Record<string, [string, string]> = {
  ATL: ["#E03A3E", "#C1D32F"],
  BOS: ["#007A33", "#BA9653"],
  BKN: ["#000000", "#FFFFFF"],
  CHA: ["#1D1160", "#00788C"],
  CHI: ["#CE1141", "#000000"],
  CLE: ["#860038", "#FDBB30"],
  DAL: ["#00538C", "#B8C4CA"],
  DEN: ["#0E2240", "#FEC524"],
  DET: ["#C8102E", "#1D42BA"],
  GSW: ["#1D428A", "#FFC72C"],
  HOU: ["#CE1141", "#C4CED4"],
  IND: ["#002D62", "#FDBB30"],
  LAC: ["#C8102E", "#1D428A"],
  LAL: ["#552583", "#FDB927"],
  MEM: ["#5D76A9", "#12173F"],
  MIA: ["#98002E", "#F9A01B"],
  MIL: ["#00471B", "#EEE1C6"],
  MIN: ["#0C2340", "#78BE20"],
  NOP: ["#0C2340", "#C8102E"],
  NYK: ["#006BB6", "#F58426"],
  OKC: ["#007AC1", "#EF3B24"],
  ORL: ["#0077C0", "#C4CED4"],
  PHI: ["#006BB6", "#ED174C"],
  PHX: ["#1D1160", "#E56020"],
  POR: ["#E03A3E", "#000000"],
  SAC: ["#5A2D81", "#63727A"],
  SAS: ["#000000", "#C4CED4"],
  TOR: ["#CE1141", "#000000"],
  UTA: ["#002B5C", "#F9A01B"],
  WAS: ["#002B5C", "#E31837"],
};

/** A ESPN usa siglas curtas para alguns times. */
const ALIAS: Record<string, string> = { GS: "GSW", NY: "NYK", SA: "SAS", NO: "NOP", UTAH: "UTA", WSH: "WAS", PHO: "PHX", BRK: "BKN" };

/** Paleta neutra para quando não há time (ex.: agente livre) nem cor publicada. */
const SPARE: [string, string][] = [
  ["#274C77", "#F2C14E"],
  ["#6A2E35", "#F0E7D8"],
  ["#1B5E4B", "#F4A259"],
  ["#4A3B76", "#9FD8CB"],
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const canonicalAbbr = (abbr: string) => ALIAS[abbr.toUpperCase()] ?? abbr.toUpperCase();

export interface TeamPalette {
  abbr: string;
  name: string;
  primary: string;
  secondary: string;
}

/** Paleta da página antes de haver um jogador em foco (a mesma do protótipo). */
export const DEFAULT_PALETTE: TeamPalette = { abbr: "", name: "Garrafão", primary: "#1D428A", secondary: "#FFC72C" };

export function teamPalette(team: TeamRef | null, fallbackKey = ""): TeamPalette {
  if (team && !team.tbd) {
    const abbr = canonicalAbbr(team.abbr);
    const brand = TEAMS[abbr];
    if (brand) return { abbr, name: team.name, primary: brand[0], secondary: brand[1] };
    if (isHex(team.color)) {
      const primary = `#${team.color.toUpperCase()}`;
      const secondary = isHex(team.altColor) ? `#${team.altColor.toUpperCase()}` : inkOn(primary);
      return { abbr, name: team.name, primary, secondary };
    }
  }
  const [primary, secondary] = SPARE[hash(team?.name ?? fallbackKey) % SPARE.length];
  return { abbr: team?.abbr ?? "", name: team?.name ?? "Sem time", primary, secondary };
}

/** Cor do número sobre a cor primária: a secundária quando contrasta, senão a tinta. */
export function numberColor(palette: TeamPalette): string {
  return contrast(palette.primary, palette.secondary) >= 1.8 ? palette.secondary : inkOn(palette.primary);
}

/** Amostra de cor (chip, lista) legível: texto do número com pelo menos 3:1 sobre a primária (texto grande). */
export function swatch(palette: TeamPalette) {
  const fg = contrast(palette.primary, palette.secondary) >= 3 ? palette.secondary : inkOn(palette.primary);
  return { background: palette.primary, color: fg };
}
