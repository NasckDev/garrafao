import { useSyncExternalStore } from "react";

/** Roteamento por hash: funciona servido em subpasta estática e recarrega rota interna sem 404. */

export type Tab = "jogadores" | "favoritos" | "ao-vivo" | "classificacao" | "eventos" | "premios" | "noticias";

export const TABS: { id: Tab; label: string }[] = [
  { id: "jogadores", label: "Jogadores" },
  { id: "favoritos", label: "Favoritos" },
  { id: "ao-vivo", label: "Ao vivo" },
  { id: "classificacao", label: "Classificação" },
  { id: "eventos", label: "Eventos" },
  { id: "premios", label: "Prêmios" },
  { id: "noticias", label: "Notícias" },
];

export interface Route {
  tab: Tab;
  /** Segmento após a aba: id do jogador (jogadores), dia YYYYMMDD (ao-vivo) ou temporada AAAA (premios). */
  param: string | null;
  query: URLSearchParams;
}

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [path, search = ""] = raw.split("?");
  const [tab = "", param = ""] = path.split("/").map((part) => decodeURIComponent(part));
  return {
    tab: TAB_IDS.has(tab) ? (tab as Tab) : "jogadores",
    param: param || null,
    query: new URLSearchParams(search),
  };
}

export function buildHash(tab: Tab, param?: string | null, query?: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) if (value) search.set(key, value);
  const qs = search.toString();
  return `#/${tab}${param ? `/${encodeURIComponent(param)}` : ""}${qs ? `?${qs}` : ""}`;
}

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => "");
}

export function useRoute(): Route {
  return parseHash(useHash());
}

/** Troca a rota. `replace` não cria entrada no histórico (ex.: trocar de jogador com as setas). */
export function navigate(hash: string, replace = false) {
  if (window.location.hash === hash) return;
  if (replace) {
    try {
      history.replaceState(null, "", hash);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      return;
    } catch {
      /* ambiente sem history: cai para a atribuição direta */
    }
  }
  window.location.hash = hash;
}
