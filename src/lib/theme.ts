import { useEffect, useSyncExternalStore } from "react";
import { themeVars } from "./color";
import { setPersisted, usePersisted, type ThemeMode } from "./storage";
import type { TeamPalette } from "./teams";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeScheme(callback: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function useSystemDark(): boolean {
  return useSyncExternalStore(subscribeScheme, () => window.matchMedia(DARK_QUERY).matches, () => false);
}

export function useThemeMode() {
  const { theme } = usePersisted();
  const systemDark = useSystemDark();
  const dark = theme === "dark" || (theme === "system" && systemDark);
  return { mode: theme, dark, setMode: (mode: ThemeMode) => setPersisted((current) => ({ ...current, theme: mode })) };
}

/** Aplica o modo claro/escuro e as cores do time no documento. */
export function useDocumentTheme(palette: TeamPalette) {
  const { mode, dark } = useThemeMode();
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "system") delete root.dataset.theme;
    else root.dataset.theme = mode;
    root.style.colorScheme = dark ? "dark" : "light";
    for (const [name, value] of Object.entries(themeVars(palette, dark))) root.style.setProperty(name, value);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeVars(palette, dark)["--bg"]);
  }, [palette, mode, dark]);
  return dark;
}

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Web Animations com respeito a `prefers-reduced-motion`: sem movimento, não anima. */
export function animate(node: Element | null | undefined, frames: Keyframe[], options: KeyframeAnimationOptions) {
  if (!node || prefersReducedMotion() || typeof node.animate !== "function") return null;
  return node.animate(frames, options);
}

export const EASE = "cubic-bezier(.2,.7,.2,1)";
