import type { PlayerProfile, Standings } from "../../server/types";

/**
 * Instantâneo offline: respostas já normalizadas, gravadas de verdade pelo script `npm run snapshot`.
 * Carregado sob demanda (fora do JS inicial) e só quando a API falha.
 */
export interface Snapshot {
  capturedAt: string;
  players: PlayerProfile[];
  standings: Standings;
}

let pending: Promise<Snapshot> | null = null;

export function loadSnapshot(): Promise<Snapshot> {
  pending ??= import("../data/snapshot.json").then((module) => module.default as unknown as Snapshot);
  return pending;
}
