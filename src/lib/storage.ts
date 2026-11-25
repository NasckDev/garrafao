import { useCallback, useSyncExternalStore } from "react";

/**
 * Persistência local com versão de esquema. Leitura sempre validada: dado corrompido ou de versão
 * desconhecida volta ao padrão em vez de quebrar a página. Falha de armazenamento (aba anônima,
 * cota) é tolerada: a página funciona, só não lembra.
 */

export const STORAGE_KEY = "garrafao:state";
export const SCHEMA_VERSION = 1;

export type ThemeMode = "system" | "light" | "dark";

export interface Persisted {
  version: typeof SCHEMA_VERSION;
  favorites: { players: string[]; teams: string[] };
  theme: ThemeMode;
}

export const DEFAULTS: Persisted = { version: SCHEMA_VERSION, favorites: { players: [], teams: [] }, theme: "system" };

const MAX_FAVORITES = 30;
const ID = /^[1-9]\d{0,11}$/;

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === "string" && ID.test(v)))].slice(0, MAX_FAVORITES) : [];

const theme = (value: unknown): ThemeMode => (value === "light" || value === "dark" || value === "system" ? value : "system");

/**
 * Lê o que estiver salvo e devolve sempre um estado válido da versão atual.
 * Versão desconhecida (mais nova ou antiga) volta ao padrão: quando o esquema mudar, a conversão entra aqui.
 */
export function migrate(raw: unknown): Persisted {
  if (typeof raw !== "object" || raw === null) return DEFAULTS;
  const data = raw as Record<string, unknown>;
  if (data.version === SCHEMA_VERSION) {
    const favorites = (typeof data.favorites === "object" && data.favorites !== null ? data.favorites : {}) as Record<string, unknown>;
    return { version: SCHEMA_VERSION, favorites: { players: ids(favorites.players), teams: ids(favorites.teams) }, theme: theme(data.theme) };
  }
  return DEFAULTS;
}

function read(): Persisted {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let state: Persisted | null = null;
const listeners = new Set<() => void>();

export function getPersisted(): Persisted {
  state ??= read();
  return state;
}

export function setPersisted(update: (current: Persisted) => Persisted) {
  state = update(getPersisted());
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* sem armazenamento: mantém só em memória nesta visita */
  }
  listeners.forEach((listener) => listener());
}

/** Só para testes: esquece o estado em memória e relê do armazenamento. */
export function resetPersistedCache() {
  state = null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    state = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePersisted(): Persisted {
  return useSyncExternalStore(subscribe, getPersisted, () => DEFAULTS);
}

export type FavoriteKind = "players" | "teams";

export function toggleFavorite(kind: FavoriteKind, id: string) {
  if (!ID.test(id)) return;
  setPersisted((current) => {
    const list = current.favorites[kind];
    const next = list.includes(id) ? list.filter((item) => item !== id) : [id, ...list].slice(0, MAX_FAVORITES);
    return { ...current, favorites: { ...current.favorites, [kind]: next } };
  });
}

export function useFavorites() {
  const { favorites } = usePersisted();
  const toggle = useCallback((kind: FavoriteKind, id: string) => toggleFavorite(kind, id), []);
  return { players: favorites.players, teams: favorites.teams, toggle };
}

/** Abertura animada: uma vez por sessão do navegador. */
const INTRO_KEY = "garrafao:intro-seen";

export function introSeen(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* sem sessionStorage: a abertura volta na próxima visita, sem prejuízo */
  }
}
