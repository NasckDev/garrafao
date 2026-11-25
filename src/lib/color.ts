/** Cor, contraste (WCAG 2.x) e a paleta que repinta a página com as cores do time. */

export type Rgb = [number, number, number];

export const isHex = (value: string | null | undefined): value is string => /^#?[0-9a-f]{6}$/i.test(value ?? "");

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as Rgb;
}

export function rgbToHex(rgb: readonly number[]): string {
  return `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Mistura linear de `a` para `b` (t = 0 devolve `a`, t = 1 devolve `b`). */
export function mix(a: string, b: string, t: number): string {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  return rgbToHex(from.map((v, i) => v + (to[i] - v) * t));
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const LIGHT_INK = "#FFFFFF";
export const DARK_INK = "#12151A";

/** Tinta (branca ou quase preta) com mais contraste sobre o fundo. */
export const inkOn = (bg: string) => (contrast(bg, LIGHT_INK) >= contrast(bg, DARK_INK) ? LIGHT_INK : DARK_INK);

export function saturation(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  return max ? (max - Math.min(r, g, b)) / max : 0;
}

export interface TeamColors {
  primary: string;
  secondary: string;
}

/**
 * Cor de destaque legível sobre um fundo (mínimo 3:1, o exigido para elementos gráficos e texto grande).
 * Prefere a cor mais viva do time; se nenhuma passa, puxa a melhor em direção à tinta até passar.
 */
export function pickAccent(team: TeamColors, bg: string): string {
  const ok = [team.secondary, team.primary]
    .filter((c) => contrast(c, bg) >= 3)
    .sort((a, b) => Number(saturation(b) > 0.3) - Number(saturation(a) > 0.3) || contrast(b, bg) - contrast(a, bg));
  if (ok.length) return ok[0];
  const best = contrast(team.primary, bg) >= contrast(team.secondary, bg) ? team.primary : team.secondary;
  const ink = inkOn(bg);
  for (let t = 0.3; t <= 1; t += 0.1) {
    const candidate = mix(best, ink, t);
    if (contrast(candidate, bg) >= 3) return candidate;
  }
  return ink;
}

/** Ajusta uma cor de texto até atingir 4,5:1 sobre o fundo (texto normal, WCAG AA). */
export function readableOn(color: string, bg: string, min = 4.5): string {
  if (contrast(color, bg) >= min) return color;
  const ink = inkOn(bg);
  for (let t = 0.1; t <= 1; t += 0.1) {
    const candidate = mix(color, ink, t);
    if (contrast(candidate, bg) >= min) return candidate;
  }
  return ink;
}

/** Fundo de destaque que aceita texto (branco ou quase preto) com 4,5:1: escurece ou clareia até chegar lá. */
export function withInk(accent: string): string {
  let candidate = accent;
  for (let t = 0.05; contrast(inkOn(candidate), candidate) < 4.5 && t <= 1; t += 0.05) {
    candidate = mix(accent, inkOn(accent) === LIGHT_INK ? "#000000" : "#FFFFFF", t);
  }
  return candidate;
}

export interface ThemeVars {
  "--bg": string;
  "--surface": string;
  "--ink": string;
  "--muted": string;
  "--line": string;
  "--track": string;
  "--accent": string;
  "--accent-ink": string;
  "--accent-text": string;
  "--g1": string;
  "--g2": string;
}

/**
 * A página inteira assume as cores do time: fundo e superfícies tingidos, destaque legível.
 * Função pura (testada): quem aplica no documento é o hook de tema.
 */
export function themeVars(team: TeamColors, dark: boolean): ThemeVars {
  const ink = dark ? "#F3F5F8" : "#11141A";
  const tint = luminance(team.primary) < 0.012 ? "#3A4350" : team.primary;
  const bg = dark ? mix(tint, "#06080B", 0.82) : mix(tint, "#FFFFFF", 0.9);
  const surface = dark ? mix(bg, "#FFFFFF", 0.065) : mix(bg, "#FFFFFF", 0.72);
  const accent = withInk(pickAccent(team, surface));
  // O cinza de apoio precisa de 4,5:1 sobre as duas superfícies: o fundo e os cartões.
  const muted = readableOn(readableOn(mix(ink, bg, 0.36), bg), surface);
  return {
    "--bg": bg,
    "--surface": surface,
    "--ink": ink,
    "--muted": muted,
    "--line": dark ? mix(bg, "#FFFFFF", 0.16) : mix(bg, "#000000", 0.13),
    "--track": dark ? mix(bg, "#FFFFFF", 0.11) : mix(bg, "#000000", 0.08),
    "--accent": accent,
    "--accent-ink": inkOn(accent),
    "--accent-text": readableOn(readableOn(accent, bg), surface),
    "--g1": tint,
    "--g2": saturation(team.secondary) > 0.2 ? team.secondary : tint,
  };
}
