/**
 * Grava o instantâneo offline (src/data/snapshot.json) com dados reais da ESPN, passando pelos mesmos
 * normalizadores do proxy. É o único dado embarcado no app, usado só quando a API falha, com a data exibida.
 *
 * Uso: npm run snapshot
 */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OPERATIONS } from "../server/ops.js";
import { FEATURED_IDS } from "../src/config/featured.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "snapshot.json");

async function main() {
  const ctx = { fetch: (input: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => fetch(input, init), now: new Date() };
  const players = (await OPERATIONS.players.run({ ids: FEATURED_IDS.join(",") }, ctx)).body as { players: unknown[]; missing: string[] };
  if (players.missing.length) throw new Error(`jogadores sem resposta: ${players.missing.join(", ")}`);
  const standings = (await OPERATIONS.standings.run({}, ctx)).body;
  const snapshot = { capturedAt: ctx.now.toISOString(), players: players.players, standings };
  await writeFile(OUT, `${JSON.stringify(snapshot)}\n`);
  console.log(`snapshot: ${players.players.length} jogadores, capturado em ${snapshot.capturedAt}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
