import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  DraftInfo,
  GameDetail,
  NewsItem,
  PlayerProfile,
  Roster,
  Scoreboard,
  SearchHit,
  SeasonEvents,
  Standings,
  TeamRef,
} from "../../server/types";
import { liveRefetchInterval, usePageVisible } from "../lib/polling";
import { apiGet, isOutage } from "./client";
import { loadSnapshot } from "./snapshot";

const MINUTE = 60_000;

export interface PlayersResponse {
  players: PlayerProfile[];
  missing: string[];
}

/** Dado com origem: `live` veio do proxy agora; `snapshot` é o instantâneo offline (com data). */
export interface Sourced<T> {
  data: T;
  source: "live" | "snapshot";
  capturedAt: string | null;
}

/** Jogadores em lote (destaques, favoritos ou um jogador avulso). Se a API cair, usa o instantâneo para os ids que ele tiver. */
export function usePlayers(ids: readonly string[], { fallback = false } = {}) {
  const key = [...ids].join(",");
  return useQuery({
    queryKey: ["players", key],
    enabled: ids.length > 0,
    staleTime: 10 * MINUTE,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<Sourced<PlayersResponse>> => {
      try {
        return { data: await apiGet<PlayersResponse>("players", { ids: key }, signal), source: "live", capturedAt: null };
      } catch (error) {
        if (!fallback || !isOutage(error)) throw error;
        const snapshot = await loadSnapshot();
        const wanted = new Set(ids);
        const players = snapshot.players.filter((profile) => wanted.has(profile.athlete.id));
        if (players.length === 0) throw error;
        return {
          data: { players, missing: ids.filter((id) => !players.some((p) => p.athlete.id === id)) },
          source: "snapshot",
          capturedAt: snapshot.capturedAt,
        };
      }
    },
  });
}

export function useSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["search", q.toLowerCase()],
    enabled: q.length >= 3,
    staleTime: 30 * MINUTE,
    queryFn: ({ signal }) => apiGet<SearchHit[]>("search", { q }, signal),
  });
}

export function useTeams() {
  return useQuery({ queryKey: ["teams"], staleTime: 24 * 60 * MINUTE, queryFn: ({ signal }) => apiGet<TeamRef[]>("teams", {}, signal) });
}

export function useRoster(teamId: string | null) {
  return useQuery({
    queryKey: ["roster", teamId],
    enabled: teamId !== null,
    staleTime: 60 * MINUTE,
    queryFn: ({ signal }) => apiGet<Roster>("roster", { team: teamId ?? "" }, signal),
  });
}

/** Placar do dia. Atualiza sozinho a cada 15 s só se houver jogo ao vivo e a aba estiver visível. */
export function useScoreboard(date: string) {
  const visible = usePageVisible();
  return useQuery({
    queryKey: ["scoreboard", date],
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => apiGet<Scoreboard>("scoreboard", { date }, signal),
    refetchInterval: (query) => liveRefetchInterval(query.state.data?.hasLive, visible),
    refetchIntervalInBackground: false,
  });
}

export function useGameDetail(eventId: string | null) {
  const visible = usePageVisible();
  return useQuery({
    queryKey: ["summary", eventId],
    enabled: eventId !== null,
    staleTime: 15_000,
    queryFn: ({ signal }) => apiGet<GameDetail>("summary", { event: eventId ?? "" }, signal),
    refetchInterval: (query) => liveRefetchInterval(query.state.data?.game.state === "in", visible),
    refetchIntervalInBackground: false,
  });
}

export function useStandings() {
  return useQuery({
    queryKey: ["standings"],
    staleTime: 5 * MINUTE,
    queryFn: async ({ signal }): Promise<Sourced<Standings>> => {
      try {
        return { data: await apiGet<Standings>("standings", {}, signal), source: "live", capturedAt: null };
      } catch (error) {
        if (!isOutage(error)) throw error;
        const snapshot = await loadSnapshot();
        return { data: snapshot.standings, source: "snapshot", capturedAt: snapshot.capturedAt };
      }
    },
  });
}

export function useNews() {
  return useQuery({ queryKey: ["news"], staleTime: 10 * MINUTE, queryFn: ({ signal }) => apiGet<NewsItem[]>("news", {}, signal) });
}

export function useSeasonEvents(season: number) {
  return useQuery({
    queryKey: ["events", season],
    staleTime: 60 * MINUTE,
    queryFn: ({ signal }) => apiGet<SeasonEvents>("events", { season }, signal),
  });
}

export function useDraft(year: number) {
  return useQuery({
    queryKey: ["draft", year],
    staleTime: 60 * MINUTE,
    queryFn: ({ signal }) => apiGet<DraftInfo>("draft", { year }, signal),
  });
}
