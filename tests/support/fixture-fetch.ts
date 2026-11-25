import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FetchLike } from "../../server/fetch-json";

/**
 * `fetch` de teste: responde cada URL de origem com a resposta real gravada (tests/fixtures/manifest.json).
 * URL fora do manifesto responde 503, como uma origem fora do ar.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

interface Manifest {
  capturedAt: string;
  entries: Record<string, { file: string; capturedAt: string }>;
}

let manifest: Manifest | null = null;
const cache = new Map<string, unknown>();

export function fixtureManifest(): Manifest {
  manifest ??= JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8")) as Manifest;
  return manifest;
}

export function fixtureJson(file: string): unknown {
  if (!cache.has(file)) cache.set(file, JSON.parse(readFileSync(join(ROOT, "espn", file), "utf8")));
  return structuredClone(cache.get(file));
}

export function fixtureFor(url: string): unknown {
  const entry = fixtureManifest().entries[url];
  if (!entry) throw new Error(`sem fixture para ${url}`);
  return fixtureJson(entry.file);
}

function respond(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

export const fixtureFetch: FetchLike = async (url) => {
  const entry = fixtureManifest().entries[url];
  if (!entry) return respond(503, { error: "fixture ausente" });
  return respond(200, fixtureJson(entry.file));
};

/** Instante fixo usado nos testes: 25/11/2026 17:00 em Brasília, dia da gravação das respostas. */
export const FIXTURE_NOW = new Date("2026-11-25T20:00:00Z");
