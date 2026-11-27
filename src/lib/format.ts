import type { Game } from "../../server/types";

/** Tudo é exibido em pt-BR, no horário de Brasília. */
export const TIME_ZONE = "America/Sao_Paulo";
/** A ESPN organiza a rodada pelo dia de Nova York (parâmetro `dates`). */
export const LEAGUE_TIME_ZONE = "America/New_York";

export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  return value === null || value === undefined ? "–" : `${formatNumber(value, decimals)}%`;
}

/** Aproveitamento de 0 a 1 no formato das tabelas americanas: ",778". */
export function formatWinPct(value: number | null): string {
  if (value === null) return "–";
  return value >= 1 ? "1,000" : `,${Math.round(value * 1000).toString().padStart(3, "0")}`;
}

export const heightM = (inches: number | null) => (inches === null ? "–" : `${formatNumber(inches * 0.0254, 2)} m`);
export const weightKg = (lb: number | null) => (lb === null ? "–" : `${Math.round(lb * 0.4536)} kg`);

const dayKeyFormat = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

/** Dia YYYYMMDD de um instante num fuso. */
export function dayKey(date: Date, timeZone = LEAGUE_TIME_ZONE): string {
  return dayKeyFormat(timeZone).format(date).replace(/-/g, "");
}

export const isDayKey = (value: string | undefined): value is string => /^\d{8}$/.test(value ?? "");

/** Soma dias a um YYYYMMDD sem passar por fuso (aritmética de calendário). */
export function shiftDay(key: string, days: number): string {
  const date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)) + days));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

export const dayKeyToIso = (key: string) => `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
export const isoToDayKey = (iso: string) => iso.replace(/-/g, "");

/** "quarta-feira, 25 de novembro de 2026" para um dia de calendário (sem fuso). */
export function formatDayLong(key: string): string {
  const date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)), 12));
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function formatDayShort(key: string): string {
  const date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)), 12));
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" }).format(date);
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatDate(iso: string, withWeekday = false): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withWeekday ? { weekday: "short" as const } : {}),
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Data de um jogo. Sem horário definido pela fonte (`timeValid` falso), a ESPN marca meia-noite de Nova York:
 * mostramos só o dia, calculado no fuso da liga, para não deslocar a data nem inventar horário.
 */
export function formatGameWhen(game: Pick<Game, "date" | "timeValid">): string {
  if (!game.timeValid) {
    const key = dayKey(new Date(game.date), LEAGUE_TIME_ZONE);
    return `${formatDayShort(key)}, horário a definir`;
  }
  return `${formatDate(game.date, true)}, ${formatTime(game.date)}`;
}

/** Dia da rodada (YYYYMMDD) a que um jogo pertence, para montar o link da aba Ao vivo. */
export const gameDayKey = (game: Pick<Game, "date">) => dayKey(new Date(game.date), LEAGUE_TIME_ZONE);

export function periodName(period: number): string {
  if (period <= 0) return "";
  if (period <= 4) return `${period}º quarto`;
  const overtime = period - 4;
  return overtime === 1 ? "Prorrogação" : `${overtime}ª prorrogação`;
}

export const periodShort = (index: number) => (index < 4 ? `${index + 1}º` : index === 4 ? "P" : `P${index - 3}`);

/** Relógio do período. No último minuto a fonte manda só segundos ("53.5"): vira "53,5 s". */
export function clockText(clock: string | null): string | null {
  if (!clock) return null;
  return /^\d+(\.\d+)?$/.test(clock) ? `${clock.replace(".", ",")} s` : clock;
}

/** Texto do status em pt-BR. Nunca depende só de cor: é sempre exibido junto do indicador. */
export function gameStatusText(game: Game): string {
  switch (game.status) {
    case "scheduled":
      return game.timeValid ? formatTime(game.date) : "Horário a definir";
    case "live":
      return [periodName(game.period), clockText(game.clock)].filter(Boolean).join(" · ") || "Em andamento";
    case "halftime":
      return "Intervalo";
    case "end-period":
      return game.period >= 4 ? `Fim do tempo regulamentar` : `Fim do ${game.period}º quarto`;
    case "final":
      return game.period > 4 ? "Final, com prorrogação" : "Final";
    case "postponed":
      return "Adiado";
    case "canceled":
      return "Cancelado";
    case "delayed":
      return "Atrasado";
    default:
      return game.detail || "Situação indisponível";
  }
}

export function ageText(seconds: number): string {
  if (seconds < 5) return "agora";
  if (seconds < 60) return `há ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `há ${minutes} min` : `há ${Math.floor(minutes / 60)} h`;
}

/** Ano da temporada (pelo ano em que termina, como a ESPN numera) que está em curso numa data. */
export function seasonYearAt(date: Date): number {
  const year = Number(dayKey(date).slice(0, 4));
  const month = Number(dayKey(date).slice(4, 6));
  return month >= 9 ? year + 1 : year;
}

/** Última temporada encerrada: a final da NBA termina em junho, então a partir de julho vale a do próprio ano. */
export function lastCompletedSeason(date: Date): number {
  const key = dayKey(date);
  const year = Number(key.slice(0, 4));
  return Number(key.slice(4, 6)) >= 7 ? year : year - 1;
}

export const seasonLabel = (year: number) => `${year - 1}-${String(year).slice(2)}`;

/** Notas oficiais dos jogos (em inglês na fonte) traduzidas; sem mapeamento, o original aparece marcado como inglês. */
const NOTE_PT: [RegExp, string][] = [
  [/^NBA Cup\s*-\s*Group Play$/i, "Copa NBA · fase de grupos"],
  [/^NBA Cup\s*-\s*Quarterfinals?$/i, "Copa NBA · quartas de final"],
  [/^NBA Cup\s*-\s*Semifinals?$/i, "Copa NBA · semifinal"],
  [/^NBA Cup Championship$/i, "Copa NBA · final"],
  [/^NBA All-Star\s*-\s*Round Robin$/i, "All-Star · fase classificatória"],
  [/^NBA All-Star\s*-\s*Championship$/i, "All-Star · final"],
];

export const KIND_PT: Record<Game["kind"], string> = {
  regular: "Temporada regular",
  cup: "Copa NBA",
  allstar: "All-Star",
  preseason: "Pré-temporada",
  playin: "Play-in",
  playoffs: "Playoffs",
};

export function gameLabel(game: Pick<Game, "note" | "kind">): { text: string; lang?: "en" } {
  if (game.note) {
    const match = NOTE_PT.find(([pattern]) => pattern.test(game.note ?? ""));
    return match ? { text: match[1] } : { text: game.note, lang: "en" };
  }
  return { text: KIND_PT[game.kind] };
}
